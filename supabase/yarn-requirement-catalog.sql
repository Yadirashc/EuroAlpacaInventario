BEGIN;
ALTER TABLE public.textile_requirements ALTER COLUMN color_id DROP NOT NULL;
ALTER TABLE public.textile_requirements ADD COLUMN IF NOT EXISTS proposed_yarn jsonb,ADD COLUMN IF NOT EXISTS catalog_registered_at timestamptz;
ALTER TABLE public.textile_requirements DROP COLUMN pending_kg;
ALTER TABLE public.textile_requirements ADD COLUMN pending_kg numeric(12,3) GENERATED ALWAYS AS(CASE WHEN available_kg IS NULL THEN NULL ELSE greatest(required_kg-available_kg-CASE WHEN color_id IS NULL THEN received_kg ELSE 0 END,0) END) STORED;
CREATE OR REPLACE FUNCTION public.textile_proposal(p jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT jsonb_object_agg(key,value) FROM jsonb_each(CASE WHEN jsonb_typeof(p)='object' THEN p ELSE '{}'::jsonb END) WHERE key=ANY(ARRAY['supplier_id','supplier_name','yarn_name','yarn_code','fiber','composition','title','name','code','family']) $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='requirement_material_reference') THEN ALTER TABLE public.textile_requirements ADD CONSTRAINT requirement_material_reference CHECK(color_id IS NOT NULL OR (proposed_yarn IS NOT NULL AND jsonb_typeof(proposed_yarn)='object'));END IF;END $$;
CREATE OR REPLACE FUNCTION public.textile_requirement_stock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.color_id IS NULL THEN
  IF NEW.proposed_yarn IS NULL THEN RAISE EXCEPTION 'Selecciona un hilo existente o completa el hilo nuevo';END IF;
  NEW.available_kg=0;
 ELSE SELECT stock_kg INTO NEW.available_kg FROM textile_stock WHERE color_id=NEW.color_id AND stage=NEW.stage AND deleted_at IS NULL;END IF;
 IF NEW.status IN('Orden de compra emitida','En tránsito','Recibido parcialmente','Recibido completamente') AND NEW.purchase_kg IS NULL THEN
  IF NEW.available_kg IS NULL THEN RAISE EXCEPTION 'Confirma el stock interno antes de emitir la orden';END IF;
  NEW.purchase_kg=greatest(NEW.required_kg-NEW.available_kg,0);
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.save_yarn_requirement(p_stage text,p_id uuid,p_data jsonb,p_expected timestamptz DEFAULT NULL) RETURNS public.textile_requirements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous public.textile_requirements;result public.textile_requirements;proposal jsonb;cid uuid;required numeric;state text;changed boolean;k text;
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora puede guardar requerimientos';END IF;
 IF p_stage NOT IN('production','preview') OR p_id IS NULL OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Revisa el requerimiento';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('yarn-requirement:'||p_id,0));
 SELECT * INTO previous FROM textile_requirements WHERE id=p_id FOR UPDATE;
 IF FOUND AND (previous.stage<>p_stage OR previous.deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'El requerimiento no está disponible';END IF;
 IF previous.id IS NOT NULL AND (p_expected IS NULL OR previous.updated_at IS DISTINCT FROM p_expected) THEN RAISE EXCEPTION 'El requerimiento cambió. Recarga antes de guardar';END IF;
 IF previous.id IS NULL AND p_expected IS NOT NULL THEN RAISE EXCEPTION 'El requerimiento ya no existe';END IF;
 state=coalesce(p_data->>'status','Pendiente de evaluación');required=(p_data->>'required_kg')::numeric;cid=nullif(p_data->>'color_id','')::uuid;
 proposal=public.textile_proposal(p_data->'proposed_yarn');
 IF previous.catalog_registered_at IS NOT NULL THEN proposal=previous.proposed_yarn;END IF;
 IF required IS NULL OR required<=0 OR required<>round(required,3) OR state NOT IN('Pendiente de evaluación','Pendiente de cotización','Pendiente de aprobación','Orden de compra emitida','En tránsito','Recibido parcialmente','Recibido completamente','Cancelado') THEN RAISE EXCEPTION 'Revisa la cantidad y el estado';END IF;
 IF cid IS NULL THEN
  FOREACH k IN ARRAY ARRAY['yarn_name','name','fiber','composition'] LOOP IF trim(coalesce(proposal->>k,''))='' THEN RAISE EXCEPTION 'Completa nombre, material, composición y color del hilo nuevo';END IF;END LOOP;
  IF proposal->>'supplier_id'='__new' THEN IF trim(coalesce(proposal->>'supplier_name',''))='' THEN RAISE EXCEPTION 'Ingresa el nuevo proveedor';END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM textile_suppliers WHERE id=nullif(proposal->>'supplier_id','')::uuid AND stage=p_stage AND active AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Selecciona el proveedor del hilo';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM textile_colors WHERE id=cid AND stage=p_stage AND active AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Selecciona un color disponible de Gestión textil';END IF;
 END IF;
 changed=previous.id IS NOT NULL AND (previous.color_id,previous.required_kg,previous.proposed_yarn) IS DISTINCT FROM (cid,required,proposal);
 IF previous.received_kg>0 AND changed THEN RAISE EXCEPTION 'El requerimiento tiene recepciones: conserva el hilo y la cantidad solicitada';END IF;
 IF previous.color_id IS NULL AND previous.received_kg>0 AND state='Cancelado' THEN RAISE EXCEPTION 'Completa la recepción del hilo nuevo antes de cancelar su registro';END IF;
 IF state IN('Recibido parcialmente','Recibido completamente') AND state IS DISTINCT FROM previous.status THEN RAISE EXCEPTION 'Usa Registrar recepción para confirmar los kilos recibidos';END IF;
 IF previous.status='Recibido completamente' AND state<>previous.status THEN RAISE EXCEPTION 'Conserva el estado de una recepción completada';END IF;
 FOREACH k IN ARRAY ARRAY['collection','model_code','model_name','responsible'] LOOP IF trim(coalesce(p_data->>k,''))='' THEN RAISE EXCEPTION 'Completa colección, modelo y responsable';END IF;END LOOP;
 IF nullif(p_data->>'expected_on','')::date<(p_data->>'requested_on')::date THEN RAISE EXCEPTION 'La entrega no puede ser anterior a la solicitud';END IF;
 IF previous.id IS NULL THEN
  INSERT INTO textile_requirements(id,stage,requested_on,collection,model_code,model_name,color_id,proposed_yarn,required_kg,expected_on,responsible,status,notes)
  VALUES(p_id,p_stage,(p_data->>'requested_on')::date,trim(p_data->>'collection'),p_data->>'model_code',p_data->>'model_name',cid,proposal,required,nullif(p_data->>'expected_on','')::date,trim(p_data->>'responsible'),state,coalesce(p_data->>'notes','')) RETURNING * INTO result;
 ELSE
  UPDATE textile_requirements SET requested_on=(p_data->>'requested_on')::date,collection=trim(p_data->>'collection'),model_code=p_data->>'model_code',model_name=p_data->>'model_name',color_id=cid,proposed_yarn=proposal,required_kg=required,expected_on=nullif(p_data->>'expected_on','')::date,responsible=trim(p_data->>'responsible'),status=state,notes=coalesce(p_data->>'notes',''),purchase_kg=CASE WHEN changed THEN NULL ELSE purchase_kg END WHERE id=p_id RETURNING * INTO result;
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_yarn_requirement(text,uuid,jsonb,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_yarn_requirement(text,uuid,jsonb,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.textile_receive(p_requirement uuid,p_amount numeric,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE req public.textile_requirements;balance public.textile_stock;receipt public.textile_receipts;saved jsonb;colors_before uuid[];cid uuid;total numeric;new_material boolean;
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora puede registrar recepciones';END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,3) OR p_request IS NULL THEN RAISE EXCEPTION 'Cantidad inválida';END IF;
 SELECT * INTO req FROM textile_requirements WHERE id=p_requirement AND deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'El requerimiento no está disponible';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('shared-textile:'||req.stage,0));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO receipt FROM textile_receipts WHERE id=p_request;
 IF FOUND THEN IF (receipt.requirement_id,receipt.amount_kg,receipt.actor) IS DISTINCT FROM (p_requirement,p_amount,auth.uid()) THEN RAISE EXCEPTION 'Solicitud reutilizada';END IF;RETURN;END IF;
 -- Para materiales existentes se mantiene el orden stock → requerimiento.
 IF req.color_id IS NOT NULL THEN SELECT * INTO balance FROM textile_stock WHERE color_id=req.color_id AND stage=req.stage AND deleted_at IS NULL FOR UPDATE;END IF;
 SELECT * INTO req FROM textile_requirements WHERE id=p_requirement AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR req.status NOT IN('Orden de compra emitida','En tránsito','Recibido parcialmente') OR req.purchase_kg IS NULL THEN RAISE EXCEPTION 'Emite la orden de compra antes de registrar recepciones';END IF;
 total=req.received_kg+p_amount;
 IF total>req.purchase_kg THEN RAISE EXCEPTION 'La recepción supera la cantidad de la orden';END IF;
 new_material=req.color_id IS NULL;
 IF new_material AND total=req.purchase_kg THEN
  SELECT array_agg(id) INTO colors_before FROM textile_colors WHERE stage=req.stage;
  saved=save_shared_textile_color(req.stage,public.textile_proposal(req.proposed_yarn)||jsonb_build_object('family',coalesce(req.proposed_yarn->>'family','Sólidos'),'preserve_family',true));cid=(saved->>'color_id')::uuid;
  SELECT * INTO balance FROM textile_stock WHERE color_id=cid AND stage=req.stage AND deleted_at IS NULL FOR UPDATE;
  IF cid=ANY(coalesce(colors_before,'{}'::uuid[])) AND (balance.id IS NULL OR balance.stock_kg IS NULL) THEN RAISE EXCEPTION 'El hilo ya existe en Gestión textil. Confirma su stock interno antes de completar la recepción';END IF;
  IF balance.id IS NULL THEN INSERT INTO textile_stock(stage,color_id,stock_kg,verified_at,notes) VALUES(req.stage,cid,0,now(),'Alta de hilo recibido') RETURNING * INTO balance;END IF;
 ELSIF NOT new_material THEN
  IF balance.id IS NULL OR balance.color_id<>req.color_id OR balance.stock_kg IS NULL THEN RAISE EXCEPTION 'Confirma primero el stock interno del hilo';END IF;cid=req.color_id;
 END IF;
 INSERT INTO textile_receipts(id,stage,requirement_id,amount_kg,actor) VALUES(p_request,req.stage,req.id,p_amount,auth.uid());
 IF NOT new_material OR total=req.purchase_kg THEN
  UPDATE textile_stock SET stock_kg=stock_kg+CASE WHEN new_material THEN total ELSE p_amount END,verified_at=now(),notes='Recepción de requerimiento '||req.sequence WHERE id=balance.id;
 END IF;
 UPDATE textile_requirements SET received_kg=total,status=CASE WHEN total=purchase_kg THEN 'Recibido completamente' ELSE 'Recibido parcialmente' END,color_id=coalesce(cid,color_id),catalog_registered_at=CASE WHEN new_material AND total=purchase_kg THEN now() ELSE catalog_registered_at END WHERE id=req.id;
END $$;
REVOKE ALL ON FUNCTION public.textile_receive(uuid,numeric,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.textile_receive(uuid,numeric,uuid) TO authenticated;
COMMIT;
