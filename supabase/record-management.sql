-- Eliminación recuperable para los registros editables. No borra stock ni auditorías.
BEGIN;
CREATE TABLE IF NOT EXISTS public.record_trash(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entity text NOT NULL,entries jsonb NOT NULL,reason text NOT NULL,
 actor uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),restored_at timestamptz,restored_by uuid REFERENCES public.profiles(id)
);
ALTER TABLE public.record_trash ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trash_admin ON public.record_trash;
CREATE POLICY trash_admin ON public.record_trash FOR SELECT TO authenticated USING(public.user_role()='admin');
REVOKE ALL ON public.record_trash FROM anon,authenticated;
GRANT SELECT ON public.record_trash TO authenticated;
GRANT ALL ON public.record_trash TO service_role;
CREATE OR REPLACE FUNCTION public.guard_record_deletion() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF current_setting('ea.record_management',true)='1' THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.deleted_at IS NOT NULL OR NEW.deleted_by IS NOT NULL THEN RAISE EXCEPTION 'Usa la función de eliminación'; END IF;
 ELSE
  IF (NEW.deleted_at,NEW.deleted_by) IS DISTINCT FROM (OLD.deleted_at,OLD.deleted_by) THEN RAISE EXCEPTION 'Usa la función de eliminación o restauración'; END IF;
  IF OLD.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'El registro está eliminado. Restáuralo antes de modificarlo'; END IF;
 END IF;
 IF TG_TABLE_NAME='logistics_shipments' AND EXISTS(SELECT 1 FROM logistics_clients WHERE id=nullif(to_jsonb(NEW)->>'client_id','')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el cliente'; END IF;
 IF TG_TABLE_NAME='logistics_documents' AND EXISTS(SELECT 1 FROM logistics_shipments WHERE id=nullif(to_jsonb(NEW)->>'shipment_id','')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el envío'; END IF;
 IF TG_TABLE_NAME='textile_yarns' AND EXISTS(SELECT 1 FROM textile_suppliers WHERE id=nullif(to_jsonb(NEW)->>'supplier_id','')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el proveedor'; END IF;
 IF TG_TABLE_NAME IN ('textile_colors','textile_photos','textile_drive_folders') AND EXISTS(SELECT 1 FROM textile_yarns WHERE id=nullif(to_jsonb(NEW)->>'yarn_id','')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el hilo'; END IF;
 IF TG_TABLE_NAME IN ('textile_stock','textile_requirements','textile_photos','textile_drive_folders') AND EXISTS(SELECT 1 FROM textile_colors WHERE id=nullif(to_jsonb(NEW)->>'color_id','')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el color'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.textile_stock_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE textile_requirements SET available_kg=CASE WHEN NEW.deleted_at IS NULL THEN NEW.stock_kg ELSE NULL END WHERE stage=NEW.stage AND color_id=NEW.color_id AND deleted_at IS NULL AND status NOT IN('Cancelado','Recibido completamente');RETURN NEW;END; $$;
CREATE OR REPLACE FUNCTION public.textile_requirement_stock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN SELECT stock_kg INTO NEW.available_kg FROM textile_stock WHERE color_id=NEW.color_id AND stage=NEW.stage AND deleted_at IS NULL;
 IF NEW.status IN('Orden de compra emitida','En tránsito','Recibido parcialmente','Recibido completamente') AND NEW.purchase_kg IS NULL THEN
 IF NEW.available_kg IS NULL THEN RAISE EXCEPTION 'Confirma el stock interno antes de emitir la orden';END IF;
 NEW.purchase_kg=greatest(NEW.required_kg-NEW.available_kg,0);END IF;RETURN NEW;END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['items','profiles','textile_suppliers','textile_yarns','textile_colors','textile_stock','textile_requirements','textile_photos','textile_drive_folders','textile_notifications','textile_sync_runs','logistics_clients','logistics_shipments','logistics_documents'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz,ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id)',t);
  EXECUTE format('DROP TRIGGER IF EXISTS guard_deletion ON public.%I',t);
  EXECUTE format('CREATE TRIGGER guard_deletion BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_record_deletion()',t);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.manage_records(p_entity text,p_ids text[],p_reason text,p_stage text DEFAULT 'production') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry jsonb; all_entries jsonb='[]'; stamp timestamptz=clock_timestamp(); batch_id uuid=gen_random_uuid(); assignment text; n integer; old_guard text;
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora puede eliminar'; END IF;
 IF p_entity IS NULL OR p_entity<>ALL(ARRAY['items','profiles','textile_suppliers','textile_yarns','textile_colors','textile_stock','textile_requirements','textile_photos','textile_drive_folders','textile_notifications','textile_sync_runs','logistics_clients','logistics_shipments','logistics_documents']) THEN RAISE EXCEPTION 'Este tipo de registro conserva su historial y no admite eliminación'; END IF;
 IF coalesce(array_length(p_ids,1),0) NOT BETWEEN 1 AND 500 OR length(trim(coalesce(p_reason,'')))<3 OR p_stage NOT IN ('preview','production') THEN RAISE EXCEPTION 'Indica los registros y un motivo de al menos tres caracteres'; END IF;
 IF (SELECT count(DISTINCT v) FROM unnest(p_ids) v)<>array_length(p_ids,1) THEN RAISE EXCEPTION 'No repitas registros'; END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE id::text=ANY($1)',p_entity) INTO n USING p_ids;
 IF n<>array_length(p_ids,1) THEN RAISE EXCEPTION 'Un registro ya no existe'; END IF;
 old_guard=current_setting('ea.record_management',true);PERFORM set_config('ea.record_management','1',true);
 FOR entry IN EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=ANY($1) ORDER BY id FOR UPDATE',p_entity) USING p_ids LOOP
  IF entry->>'deleted_at' IS NOT NULL THEN RAISE EXCEPTION 'Un registro ya está eliminado'; END IF;
  IF p_entity LIKE 'textile_%' AND entry->>'stage'<>p_stage THEN RAISE EXCEPTION 'El registro pertenece a otro entorno'; END IF;
  IF p_entity='profiles' AND entry->>'id'=auth.uid()::text THEN RAISE EXCEPTION 'No puedes eliminar tu propia cuenta'; END IF;
  IF p_entity='items' AND EXISTS(SELECT 1 FROM logistics_lines l JOIN logistics_shipments s ON s.id=l.shipment_id WHERE l.item_id=(entry->>'id')::uuid AND s.deleted_at IS NULL AND s.status NOT IN ('Cancelado','Recepción confirmada')) THEN RAISE EXCEPTION 'La prenda tiene un envío pendiente. Cancélalo o confirma la recepción primero'; END IF;
  IF p_entity='textile_suppliers' AND EXISTS(SELECT 1 FROM textile_yarns WHERE supplier_id=(entry->>'id')::uuid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'El proveedor tiene hilos vinculados. Elimina o reasigna esos hilos primero'; END IF;
  IF p_entity='textile_yarns' AND EXISTS(SELECT 1 FROM textile_colors WHERE yarn_id=(entry->>'id')::uuid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'El hilo tiene colores vinculados. Elimina o reasigna esos colores primero'; END IF;
  IF p_entity='textile_colors' AND (EXISTS(SELECT 1 FROM textile_stock WHERE color_id=(entry->>'id')::uuid AND coalesce(stock_kg,0)>0) OR EXISTS(SELECT 1 FROM textile_requirements WHERE color_id=(entry->>'id')::uuid AND deleted_at IS NULL AND status NOT IN ('Cancelado','Recibido completamente'))) THEN RAISE EXCEPTION 'El color tiene stock o requerimientos pendientes. Resuélvelos primero'; END IF;
  IF p_entity='textile_stock' AND coalesce((entry->>'stock_kg')::numeric,0)>0 THEN RAISE EXCEPTION 'Registra el ajuste de stock antes de eliminar este conteo'; END IF;
  IF p_entity='textile_requirements' AND entry->>'status' IN ('Orden de compra emitida','En tránsito','Recibido parcialmente') THEN RAISE EXCEPTION 'Finaliza o cancela el requerimiento antes de eliminarlo'; END IF;
  IF p_entity='logistics_clients' AND EXISTS(SELECT 1 FROM logistics_shipments WHERE client_id=(entry->>'id')::uuid AND deleted_at IS NULL AND status NOT IN ('Cancelado','Recepción confirmada')) THEN RAISE EXCEPTION 'El cliente tiene envíos pendientes. Resuélvelos antes de eliminarlo'; END IF;
  IF p_entity='logistics_shipments' AND entry->>'status' IN ('En tránsito','Entregado') THEN RAISE EXCEPTION 'Confirma la recepción antes de eliminar este envío o traslado'; END IF;
  all_entries=all_entries||jsonb_build_array(entry);
  assignment='deleted_at=$2,deleted_by=$3';
  IF p_entity='items' THEN assignment=assignment||',archived=true';
  ELSIF p_entity IN ('profiles','textile_suppliers','textile_yarns','textile_colors','textile_photos','textile_drive_folders') THEN assignment=assignment||',active=false';
  ELSIF p_entity='logistics_shipments' AND entry->>'status' IN ('Pendiente','En preparación','Listo para despacho') THEN assignment=assignment||',status=''Cancelado'',version=version+1';
  END IF;
  EXECUTE format('UPDATE public.%I SET %s WHERE id::text=$1',p_entity,assignment) USING entry->>'id',stamp,auth.uid();
  IF p_entity='logistics_shipments' THEN
   INSERT INTO logistics_events(shipment_id,actor,actor_name,action,previous_status,status,details) SELECT (entry->>'id')::uuid,auth.uid(),full_name,'Eliminación recuperable',entry->>'status',CASE WHEN entry->>'status' IN ('Pendiente','En preparación','Listo para despacho') THEN 'Cancelado' ELSE entry->>'status' END,jsonb_build_object('reason',p_reason,'batch',batch_id) FROM profiles WHERE id=auth.uid();
  END IF;
 END LOOP;
 INSERT INTO record_trash(id,entity,entries,reason,actor,created_at) VALUES(batch_id,p_entity,all_entries,trim(p_reason),auth.uid(),stamp);
 PERFORM set_config('ea.record_management',coalesce(old_guard,''),true);RETURN batch_id;
END $$;
CREATE OR REPLACE FUNCTION public.restore_records(p_batch uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE batch public.record_trash; entry jsonb; current_row jsonb; assignment text; old_guard text;
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora puede restaurar'; END IF;
 SELECT * INTO batch FROM record_trash WHERE id=p_batch FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Registro de papelera no encontrado'; END IF;
 IF batch.restored_at IS NOT NULL THEN RETURN; END IF;
 old_guard=current_setting('ea.record_management',true);PERFORM set_config('ea.record_management','1',true);
 FOR entry IN SELECT value FROM jsonb_array_elements(batch.entries) LOOP
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id::text=$1 FOR UPDATE',batch.entity) INTO current_row USING entry->>'id';
  IF current_row IS NULL OR (current_row->>'deleted_at')::timestamptz IS DISTINCT FROM batch.created_at THEN RAISE EXCEPTION 'El registro cambió desde su eliminación'; END IF;
  IF batch.entity='textile_yarns' AND EXISTS(SELECT 1 FROM textile_suppliers WHERE id=(entry->>'supplier_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el proveedor'; END IF;
  IF batch.entity IN ('textile_colors','textile_photos','textile_drive_folders') AND nullif(entry->>'yarn_id','') IS NOT NULL AND EXISTS(SELECT 1 FROM textile_yarns WHERE id=(entry->>'yarn_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el hilo'; END IF;
  IF batch.entity IN ('textile_stock','textile_requirements') AND EXISTS(SELECT 1 FROM textile_colors WHERE id=(entry->>'color_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el color'; END IF;
  IF batch.entity='logistics_shipments' AND nullif(entry->>'client_id','') IS NOT NULL AND EXISTS(SELECT 1 FROM logistics_clients WHERE id=(entry->>'client_id')::uuid AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Restaura primero el cliente'; END IF;
  assignment='deleted_at=NULL,deleted_by=NULL';
  IF batch.entity='items' THEN assignment=assignment||',archived='||coalesce(entry->>'archived','false');
  ELSIF batch.entity IN ('profiles','textile_suppliers','textile_yarns','textile_colors','textile_photos','textile_drive_folders') THEN assignment=assignment||',active='||coalesce(entry->>'active','true');
  ELSIF batch.entity='logistics_shipments' THEN assignment=assignment||',status='||quote_literal(entry->>'status')||',version=version+1'; END IF;
  EXECUTE format('UPDATE public.%I SET %s WHERE id::text=$1',batch.entity,assignment) USING entry->>'id';
 END LOOP;
 UPDATE record_trash SET restored_at=now(),restored_by=auth.uid() WHERE id=p_batch;
 PERFORM set_config('ea.record_management',coalesce(old_guard,''),true);
END $$;
REVOKE ALL ON FUNCTION public.guard_record_deletion(),public.manage_records(text,text[],text,text),public.restore_records(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_records(text,text[],text,text),public.restore_records(uuid) TO authenticated;
-- Un documento eliminado deja de estar accesible por almacenamiento; su archivo se conserva para restaurarlo.
DROP POLICY IF EXISTS logistics_document_read ON storage.objects;
CREATE POLICY logistics_document_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='logistics-private' AND public.user_role() IS NOT NULL AND EXISTS(SELECT 1 FROM public.logistics_documents d WHERE d.path=storage.objects.name AND d.deleted_at IS NULL));
DROP POLICY IF EXISTS logistics_document_insert ON storage.objects;
CREATE POLICY logistics_document_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='logistics-private' AND public.user_role() IN ('admin','operadora') AND EXISTS(SELECT 1 FROM public.logistics_shipments s WHERE s.id::text=split_part(storage.objects.name,'/',1) AND s.deleted_at IS NULL) AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$');
COMMIT;
