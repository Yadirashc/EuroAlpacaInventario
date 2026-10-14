BEGIN;
-- Ampliación aditiva: no modifica items, movimientos ni cantidades de prendas.

CREATE TABLE public.textile_suppliers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),
 code text NOT NULL,name text NOT NULL,website text NOT NULL,catalog_url text DEFAULT '',integration_status text NOT NULL DEFAULT 'Pendiente de autorización',
 integration_notes text DEFAULT '',last_checked_at timestamptz,last_catalog_at timestamptz,active boolean NOT NULL DEFAULT true,updated_at timestamptz DEFAULT now(),
 UNIQUE(stage,code),UNIQUE(id,stage)
);
CREATE TABLE public.textile_yarns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),supplier_id uuid NOT NULL,
 reference_key text NOT NULL,code text DEFAULT '',name text NOT NULL,fiber text DEFAULT '',composition text DEFAULT '',title text DEFAULT '',technical_notes text DEFAULT '',collection text DEFAULT '',
 source_url text DEFAULT '',source_note text DEFAULT '',verified_at timestamptz,active boolean NOT NULL DEFAULT true,updated_at timestamptz DEFAULT now(),UNIQUE(stage,supplier_id,reference_key),UNIQUE(id,stage),
 FOREIGN KEY(supplier_id,stage) REFERENCES public.textile_suppliers(id,stage)
);
CREATE TABLE public.textile_colors(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),yarn_id uuid NOT NULL,
 reference_key text NOT NULL,code text DEFAULT '',name text NOT NULL,family text NOT NULL DEFAULT 'Sin clasificar' CHECK(family IN('Cálidos','Fríos','Neutros','Multicolor','Sin clasificar')),
 collection text DEFAULT '',supplier_availability text NOT NULL DEFAULT 'Pendiente de confirmación' CHECK(supplier_availability IN('Pendiente de confirmación','Disponible confirmado','No disponible confirmado')),
 availability_verified_at timestamptz,availability_source text DEFAULT '',active boolean NOT NULL DEFAULT true,updated_at timestamptz DEFAULT now(),UNIQUE(stage,yarn_id,reference_key),UNIQUE(id,stage),
 FOREIGN KEY(yarn_id,stage) REFERENCES public.textile_yarns(id,stage),CHECK(supplier_availability='Pendiente de confirmación' OR (availability_verified_at IS NOT NULL AND length(trim(availability_source))>0))
);
CREATE TABLE public.textile_stock(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),color_id uuid NOT NULL,
 stock_kg numeric(12,3) CHECK(stock_kg>=0),verified_at timestamptz,notes text DEFAULT '',updated_at timestamptz DEFAULT now(),UNIQUE(stage,color_id),
 FOREIGN KEY(color_id,stage) REFERENCES public.textile_colors(id,stage)
);
CREATE TABLE public.textile_requirements(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sequence bigint GENERATED ALWAYS AS IDENTITY,stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),
 requested_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Lima')::date,collection text NOT NULL,model_code text NOT NULL,model_name text NOT NULL,color_id uuid NOT NULL,
 required_kg numeric(12,3) NOT NULL CHECK(required_kg>0),available_kg numeric(12,3) CHECK(available_kg>=0),
 pending_kg numeric(12,3) GENERATED ALWAYS AS(CASE WHEN available_kg IS NULL THEN NULL ELSE greatest(required_kg-available_kg,0) END) STORED,
 expected_on date,responsible text NOT NULL,status text NOT NULL DEFAULT 'Pendiente de evaluación' CHECK(status IN('Pendiente de evaluación','Pendiente de cotización','Pendiente de aprobación','Orden de compra emitida','En tránsito','Recibido parcialmente','Recibido completamente','Cancelado')),
 notes text DEFAULT '',purchase_kg numeric(12,3) CHECK(purchase_kg>=0),received_kg numeric(12,3) NOT NULL DEFAULT 0 CHECK(received_kg>=0),created_by uuid DEFAULT auth.uid() REFERENCES public.profiles(id),updated_at timestamptz DEFAULT now(),UNIQUE(id,stage),
 FOREIGN KEY(color_id,stage) REFERENCES public.textile_colors(id,stage),CHECK(expected_on IS NULL OR expected_on>=requested_on),CHECK(purchase_kg IS NULL OR purchase_kg<=required_kg),CHECK(received_kg<=coalesce(purchase_kg,0)),CHECK(status<>'Recibido parcialmente' OR (received_kg>0 AND received_kg<purchase_kg)),CHECK(status<>'Recibido completamente' OR (purchase_kg IS NOT NULL AND received_kg=purchase_kg))
);
CREATE TABLE public.textile_drive_folders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),folder_id text NOT NULL,name text NOT NULL,
 collection text DEFAULT '',model_code text DEFAULT '',yarn_id uuid,color_id uuid,kind text NOT NULL DEFAULT 'producto' CHECK(kind IN('producto','hilo','color','referencia')),
 visibility text NOT NULL DEFAULT 'admin' CHECK(visibility IN('admin','team')),rights_confirmed boolean NOT NULL DEFAULT false,active boolean NOT NULL DEFAULT true,
 last_synced_at timestamptz,last_error text DEFAULT '',updated_at timestamptz DEFAULT now(),UNIQUE(stage,folder_id),UNIQUE(id,stage),
 FOREIGN KEY(yarn_id,stage) REFERENCES public.textile_yarns(id,stage),FOREIGN KEY(color_id,stage) REFERENCES public.textile_colors(id,stage)
);
CREATE TABLE public.textile_photos(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL DEFAULT 'preview' CHECK(stage IN('preview','production')),folder_id uuid,drive_file_id text,drive_modified_at timestamptz,
 name text NOT NULL,kind text NOT NULL DEFAULT 'producto' CHECK(kind IN('producto','hilo','color','referencia')),collection text DEFAULT '',model_code text DEFAULT '',yarn_id uuid,color_id uuid,
 visibility text NOT NULL DEFAULT 'admin' CHECK(visibility IN('admin','team')),rights_confirmed boolean NOT NULL DEFAULT false,
 storage_thumb text,storage_full text,mime_type text,active boolean NOT NULL DEFAULT true,updated_at timestamptz DEFAULT now(),UNIQUE(stage,drive_file_id),
 FOREIGN KEY(folder_id,stage) REFERENCES public.textile_drive_folders(id,stage),FOREIGN KEY(yarn_id,stage) REFERENCES public.textile_yarns(id,stage),FOREIGN KEY(color_id,stage) REFERENCES public.textile_colors(id,stage)
);
CREATE TABLE public.textile_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,stage text NOT NULL,entity text NOT NULL,entity_id uuid NOT NULL,operation text NOT NULL,previous jsonb,current jsonb,actor uuid REFERENCES public.profiles(id),created_at timestamptz DEFAULT now());
CREATE TABLE public.textile_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL,title text NOT NULL,message text NOT NULL,color_id uuid REFERENCES public.textile_colors(id),read_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE public.textile_sync_runs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stage text NOT NULL,source text NOT NULL,status text NOT NULL,details text DEFAULT '',created_at timestamptz DEFAULT now());
CREATE TABLE public.textile_receipts(id uuid PRIMARY KEY,stage text NOT NULL,requirement_id uuid NOT NULL REFERENCES public.textile_requirements(id),amount_kg numeric(12,3) NOT NULL CHECK(amount_kg>0),actor uuid NOT NULL REFERENCES public.profiles(id),created_at timestamptz DEFAULT now());

CREATE FUNCTION public.textile_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO textile_history(stage,entity,entity_id,operation,previous,current,actor) VALUES(NEW.stage,TG_TABLE_NAME,NEW.id,TG_OP,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),auth.uid());RETURN NEW;END; $$;
CREATE FUNCTION public.textile_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now();RETURN NEW;END; $$;
CREATE FUNCTION public.textile_requirement_stock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN SELECT stock_kg INTO NEW.available_kg FROM textile_stock WHERE color_id=NEW.color_id AND stage=NEW.stage;
 IF NEW.status IN('Orden de compra emitida','En tránsito','Recibido parcialmente','Recibido completamente') AND NEW.purchase_kg IS NULL THEN
 IF NEW.available_kg IS NULL THEN RAISE EXCEPTION 'Confirma el stock interno antes de emitir la orden';END IF;
 NEW.purchase_kg=greatest(NEW.required_kg-NEW.available_kg,0);END IF;RETURN NEW;END; $$;
CREATE TRIGGER requirement_stock BEFORE INSERT OR UPDATE ON public.textile_requirements FOR EACH ROW EXECUTE FUNCTION public.textile_requirement_stock();
CREATE FUNCTION public.textile_stock_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN UPDATE textile_requirements SET available_kg=NEW.stock_kg WHERE stage=NEW.stage AND color_id=NEW.color_id AND status NOT IN('Cancelado','Recibido completamente');RETURN NEW;END; $$;
CREATE TRIGGER stock_requirements AFTER INSERT OR UPDATE ON public.textile_stock FOR EACH ROW EXECUTE FUNCTION public.textile_stock_changes();
CREATE FUNCTION public.textile_color_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.supplier_availability IS DISTINCT FROM NEW.supplier_availability AND (length(trim(NEW.collection))>0 OR EXISTS(SELECT 1 FROM textile_yarns WHERE id=NEW.yarn_id AND length(trim(collection))>0) OR EXISTS(SELECT 1 FROM textile_requirements WHERE color_id=NEW.id AND stage=NEW.stage AND status NOT IN('Cancelado','Recibido completamente'))) THEN
 INSERT INTO textile_notifications(stage,title,message,color_id) VALUES(NEW.stage,'Cambio de disponibilidad',NEW.name||' · '||NEW.supplier_availability,NEW.id);
 END IF;RETURN NEW;
END; $$;
CREATE TRIGGER color_availability AFTER UPDATE ON public.textile_colors FOR EACH ROW EXECUTE FUNCTION public.textile_color_changes();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['textile_suppliers','textile_yarns','textile_colors','textile_stock','textile_requirements','textile_drive_folders','textile_photos'] LOOP
 EXECUTE format('CREATE TRIGGER audit_textile AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.textile_audit()',t);
 EXECUTE format('CREATE TRIGGER touch_textile BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.textile_touch()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['textile_suppliers','textile_yarns','textile_colors','textile_stock','textile_requirements','textile_drive_folders','textile_photos','textile_history','textile_notifications','textile_sync_runs','textile_receipts'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['textile_suppliers','textile_yarns','textile_colors','textile_stock'] LOOP
 EXECUTE format('CREATE POLICY textile_read ON public.%I FOR SELECT TO authenticated USING(public.user_role() IS NOT NULL)',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY textile_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.user_role()=''admin'')',t);
 EXECUTE format('CREATE POLICY textile_update ON public.%I FOR UPDATE TO authenticated USING(public.user_role()=''admin'') WITH CHECK(public.user_role()=''admin'')',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['textile_requirements','textile_drive_folders','textile_history','textile_notifications','textile_sync_runs','textile_receipts'] LOOP
 EXECUTE format('CREATE POLICY textile_admin_read ON public.%I FOR SELECT TO authenticated USING(public.user_role()=''admin'')',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['textile_requirements','textile_drive_folders'] LOOP
 EXECUTE format('GRANT INSERT,UPDATE ON public.%I TO authenticated',t);
 EXECUTE format('CREATE POLICY textile_admin_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(public.user_role()=''admin'')',t);
 EXECUTE format('CREATE POLICY textile_admin_update ON public.%I FOR UPDATE TO authenticated USING(public.user_role()=''admin'') WITH CHECK(public.user_role()=''admin'')',t);
 END LOOP;
END; $$;
CREATE POLICY photos_read ON public.textile_photos FOR SELECT TO authenticated USING(public.user_role()='admin' OR (public.user_role() IS NOT NULL AND visibility='team' AND active AND rights_confirmed));
CREATE POLICY photos_insert ON public.textile_photos FOR INSERT TO authenticated WITH CHECK(public.user_role()='admin' AND rights_confirmed);
CREATE POLICY photos_update ON public.textile_photos FOR UPDATE TO authenticated USING(public.user_role()='admin') WITH CHECK(public.user_role()='admin');
GRANT SELECT,INSERT,UPDATE ON public.textile_photos TO authenticated;
CREATE POLICY notifications_update ON public.textile_notifications FOR UPDATE TO authenticated USING(public.user_role()='admin') WITH CHECK(public.user_role()='admin');
GRANT UPDATE(read_at) ON public.textile_notifications TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.textile_requirements_sequence_seq TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.textile_audit(),public.textile_touch(),public.textile_requirement_stock(),public.textile_stock_changes(),public.textile_color_changes() FROM PUBLIC;

CREATE FUNCTION public.textile_receive(p_requirement uuid,p_amount numeric,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE req textile_requirements; stock textile_stock; previous textile_receipts;BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora';END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,3) OR p_request IS NULL THEN RAISE EXCEPTION 'Cantidad inválida';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO previous FROM textile_receipts WHERE id=p_request;
 IF FOUND THEN IF previous.requirement_id<>p_requirement OR previous.amount_kg<>p_amount OR previous.actor<>auth.uid() THEN RAISE EXCEPTION 'Solicitud reutilizada';END IF;RETURN;END IF;
 SELECT * INTO req FROM textile_requirements WHERE id=p_requirement;
 IF NOT FOUND OR req.status NOT IN('Orden de compra emitida','En tránsito','Recibido parcialmente') THEN RAISE EXCEPTION 'Emite la orden de compra antes de registrar recepciones';END IF;
 SELECT * INTO stock FROM textile_stock WHERE color_id=req.color_id AND stage=req.stage FOR UPDATE;
 IF NOT FOUND OR stock.stock_kg IS NULL THEN RAISE EXCEPTION 'Confirma primero el stock interno';END IF;
 SELECT * INTO req FROM textile_requirements WHERE id=p_requirement FOR UPDATE;
 IF req.color_id<>stock.color_id OR req.stage<>stock.stage OR req.status NOT IN('Orden de compra emitida','En tránsito','Recibido parcialmente') THEN RAISE EXCEPTION 'El requerimiento cambió. Recarga y revisa la recepción.';END IF;
 IF req.received_kg+p_amount>req.purchase_kg THEN RAISE EXCEPTION 'La recepción supera la cantidad de la orden';END IF;
 INSERT INTO textile_receipts(id,stage,requirement_id,amount_kg,actor) VALUES(p_request,req.stage,req.id,p_amount,auth.uid());
 UPDATE textile_stock SET stock_kg=stock_kg+p_amount,verified_at=now(),notes='Recepción de requerimiento '||req.sequence WHERE id=stock.id;
 UPDATE textile_requirements SET received_kg=received_kg+p_amount,status=CASE WHEN received_kg+p_amount=purchase_kg THEN 'Recibido completamente' ELSE 'Recibido parcialmente' END WHERE id=req.id;
END; $$;
REVOKE ALL ON FUNCTION public.textile_receive(uuid,numeric,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.textile_receive(uuid,numeric,uuid) TO authenticated;
CREATE INDEX textile_colors_yarn ON public.textile_colors(stage,yarn_id);
CREATE INDEX textile_requirements_color ON public.textile_requirements(stage,color_id);
CREATE INDEX textile_photos_links ON public.textile_photos(stage,model_code,yarn_id,color_id);
CREATE INDEX textile_history_date ON public.textile_history(stage,created_at DESC);


-- Solo el proceso del servidor puede ejecutar una importación programada.
CREATE FUNCTION public.textile_import_server(p_actor uuid,p_stage text,p_supplier uuid,p_rows jsonb,p_verified boolean,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM profiles WHERE id=p_actor AND role='admin' AND active) THEN RAISE EXCEPTION 'Responsable no autorizado';END IF;
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
 PERFORM public.textile_import(p_stage,p_supplier,p_rows,p_verified,p_request);
END; $$;
REVOKE ALL ON FUNCTION public.textile_import_server(uuid,text,uuid,jsonb,boolean,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.textile_import_server(uuid,text,uuid,jsonb,boolean,uuid) TO service_role;


CREATE TABLE public.textile_import_batches(id uuid PRIMARY KEY,stage text NOT NULL,supplier_id uuid NOT NULL REFERENCES public.textile_suppliers(id),actor uuid NOT NULL REFERENCES public.profiles(id),payload jsonb NOT NULL,verified boolean NOT NULL,created_at timestamptz DEFAULT now());
ALTER TABLE public.textile_import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.textile_import_batches FROM anon,authenticated;
GRANT ALL ON public.textile_import_batches TO service_role;
CREATE FUNCTION public.textile_import(p_stage text,p_supplier uuid,p_rows jsonb,p_verified boolean,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;y uuid;c uuid;b textile_import_batches;BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora';END IF;
 IF p_stage NOT IN('preview','production') OR NOT EXISTS(SELECT 1 FROM textile_suppliers WHERE id=p_supplier AND stage=p_stage) OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR p_request IS NULL THEN RAISE EXCEPTION 'Importación inválida';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));SELECT * INTO b FROM textile_import_batches WHERE id=p_request;
 IF FOUND THEN IF b.actor<>auth.uid() OR b.stage<>p_stage OR b.supplier_id<>p_supplier OR b.payload<>p_rows OR b.verified<>p_verified THEN RAISE EXCEPTION 'Solicitud reutilizada';END IF;RETURN;END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
 IF length(trim(coalesce(r->>'name','')))=0 OR length(trim(coalesce(r->>'reference_key','')))=0 THEN RAISE EXCEPTION 'Falta nombre o referencia de hilo';END IF;
 INSERT INTO textile_yarns(stage,supplier_id,reference_key,code,name,fiber,composition,title,technical_notes,collection,source_url,source_note,verified_at)
 VALUES(p_stage,p_supplier,r->>'reference_key',coalesce(r->>'code',''),r->>'name',coalesce(r->>'fiber',''),coalesce(r->>'composition',''),coalesce(r->>'title',''),coalesce(r->>'technical_notes',''),coalesce(r->>'collection',''),coalesce(r->>'source_url',''),coalesce(r->>'source_note','Importación revisada'),CASE WHEN p_verified THEN now() END)
 ON CONFLICT(stage,supplier_id,reference_key) DO UPDATE SET code=excluded.code,name=excluded.name,fiber=excluded.fiber,composition=excluded.composition,title=excluded.title,technical_notes=excluded.technical_notes,collection=excluded.collection,source_url=excluded.source_url,source_note=excluded.source_note,verified_at=coalesce(excluded.verified_at,textile_yarns.verified_at) RETURNING id INTO y;
 IF length(trim(coalesce(r->>'color_name','')))>0 THEN
 INSERT INTO textile_colors(stage,yarn_id,reference_key,code,name,family,collection) VALUES(p_stage,y,r->>'color_key',coalesce(r->>'color_code',''),r->>'color_name',coalesce(nullif(r->>'family',''),'Sin clasificar'),coalesce(r->>'collection',''))
 ON CONFLICT(stage,yarn_id,reference_key) DO UPDATE SET code=excluded.code,name=excluded.name,family=excluded.family,collection=excluded.collection RETURNING id INTO c;
 INSERT INTO textile_stock(stage,color_id) VALUES(p_stage,c) ON CONFLICT(stage,color_id) DO NOTHING;
 IF p_verified AND r ? 'supplier_availability' THEN
 UPDATE textile_colors SET supplier_availability=r->>'supplier_availability',availability_verified_at=CASE WHEN r->>'supplier_availability'='Pendiente de confirmación' THEN NULL ELSE (r->>'availability_verified_at')::timestamptz END,availability_source=coalesce(r->>'availability_source','') WHERE id=c;
 END IF;END IF;
 END LOOP;
 INSERT INTO textile_import_batches(id,stage,supplier_id,actor,payload,verified) VALUES(p_request,p_stage,p_supplier,auth.uid(),p_rows,p_verified);
 UPDATE textile_suppliers SET last_catalog_at=now() WHERE id=p_supplier;
END; $$;
REVOKE ALL ON FUNCTION public.textile_import(text,uuid,jsonb,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.textile_import(text,uuid,jsonb,boolean,uuid) TO authenticated;
COMMIT;
