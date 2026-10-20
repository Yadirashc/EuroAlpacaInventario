-- Gestión de clientes, envíos y ubicación. Migración aditiva y repetible.
BEGIN;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS production_lot text NOT NULL DEFAULT '';
GRANT UPDATE(production_lot) ON public.items TO authenticated;
CREATE SEQUENCE IF NOT EXISTS public.logistics_client_seq;
CREATE SEQUENCE IF NOT EXISTS public.logistics_shipment_seq;
CREATE SEQUENCE IF NOT EXISTS public.logistics_lot_seq;
CREATE TABLE IF NOT EXISTS public.logistics_clients (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL DEFAULT ('CLI-'||lpad(nextval('public.logistics_client_seq')::text,6,'0')),
 name text NOT NULL CHECK(length(trim(name))>0), company text NOT NULL DEFAULT '', country text NOT NULL DEFAULT '', city text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', email text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.logistics_shipments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL DEFAULT ('ENV-'||lpad(nextval('public.logistics_shipment_seq')::text,7,'0')),
 kind text NOT NULL CHECK(kind IN ('envio','traslado')), client_id uuid REFERENCES public.logistics_clients(id), client_snapshot jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'Pendiente' CHECK(status IN ('Pendiente','En preparación','Listo para despacho','En tránsito','Entregado','Recepción confirmada','Cancelado')),
 details jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1, dispatched_at timestamptz, received_at timestamptz,
 created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(kind<>'envio' OR client_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.logistics_lots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id uuid NOT NULL REFERENCES public.logistics_shipments(id),
 code text NOT NULL UNIQUE DEFAULT ('LEN-'||lpad(nextval('public.logistics_lot_seq')::text,8,'0')), label text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS public.logistics_lines (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id uuid NOT NULL REFERENCES public.logistics_shipments(id), lot_id uuid NOT NULL REFERENCES public.logistics_lots(id),
 item_id uuid NOT NULL REFERENCES public.items(id), destination_item_id uuid REFERENCES public.items(id), quantity integer NOT NULL CHECK(quantity>0),
 production_lot text NOT NULL DEFAULT '', materials jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(materials)='array'), snapshot jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS public.logistics_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, shipment_id uuid NOT NULL REFERENCES public.logistics_shipments(id), actor uuid NOT NULL REFERENCES public.profiles(id), actor_name text NOT NULL,
 action text NOT NULL, previous_status text, status text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.logistics_documents (
 id uuid PRIMARY KEY, shipment_id uuid NOT NULL REFERENCES public.logistics_shipments(id), name text NOT NULL, mime text NOT NULL, size integer NOT NULL CHECK(size>0 AND size<=10485760),
 path text NOT NULL UNIQUE, actor uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS logistics_lines_item ON public.logistics_lines(item_id);
CREATE INDEX IF NOT EXISTS logistics_events_shipment ON public.logistics_events(shipment_id,created_at);
CREATE INDEX IF NOT EXISTS logistics_shipments_client ON public.logistics_shipments(client_id);
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['logistics_clients','logistics_shipments','logistics_lots','logistics_lines','logistics_events','logistics_documents'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('DROP POLICY IF EXISTS team_read ON public.%I',t);
 EXECUTE format('CREATE POLICY team_read ON public.%I FOR SELECT TO authenticated USING(public.user_role() IS NOT NULL)',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.logistics_save_client(p_id uuid,p_data jsonb,p_version integer DEFAULT 0) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c public.logistics_clients;
BEGIN
 IF coalesce(public.user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF length(trim(coalesce(p_data->>'name','')))=0 THEN RAISE EXCEPTION 'Ingresa el nombre del cliente'; END IF;
 SELECT * INTO c FROM logistics_clients WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF c.version<>p_version THEN RAISE EXCEPTION 'El cliente cambió. Recarga su ficha'; END IF;
  UPDATE logistics_clients SET name=trim(p_data->>'name'),company=coalesce(p_data->>'company',''),country=coalesce(p_data->>'country',''),city=coalesce(p_data->>'city',''),address=coalesce(p_data->>'address',''),phone=coalesce(p_data->>'phone',''),email=coalesce(p_data->>'email',''),notes=coalesce(p_data->>'notes',''),version=version+1,updated_at=now() WHERE id=p_id;
 ELSE
  IF p_version<>0 THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;
  INSERT INTO logistics_clients(id,name,company,country,city,address,phone,email,notes) VALUES(p_id,trim(p_data->>'name'),coalesce(p_data->>'company',''),coalesce(p_data->>'country',''),coalesce(p_data->>'city',''),coalesce(p_data->>'address',''),coalesce(p_data->>'phone',''),coalesce(p_data->>'email',''),coalesce(p_data->>'notes',''));
 END IF;
 RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.logistics_save_shipment(p_id uuid,p_data jsonb,p_lines jsonb,p_version integer DEFAULT 0) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.logistics_shipments; c public.logistics_clients; i public.items; entry jsonb; mat jsonb; lot uuid; lot_label text; d jsonb; k text; cid uuid; was_new boolean;
BEGIN
 IF coalesce(public.user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)<1 OR jsonb_array_length(p_lines)>500 THEN RAISE EXCEPTION 'Incluye entre 1 y 500 líneas'; END IF;
 d=coalesce(p_data->'details','{}'); k=p_data->>'kind'; cid=nullif(p_data->>'client_id','')::uuid;
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos de envío inválidos'; END IF;
 IF k NOT IN ('envio','traslado') OR k IS NULL THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
 IF k='envio' THEN SELECT * INTO c FROM logistics_clients WHERE id=cid; IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona un cliente'; END IF; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['origin','country','city','address','prepared_by','carrier','authorized_by','issued_on']) key WHERE length(trim(coalesce(d->>key,'')))=0) THEN RAISE EXCEPTION 'Completa origen, destino, emisión y responsables'; END IF;
 PERFORM (d->>'issued_on')::date;
 IF nullif(d->>'estimated_on','') IS NOT NULL AND (d->>'estimated_on')::date<(d->>'issued_on')::date THEN RAISE EXCEPTION 'La llegada estimada es anterior a la emisión'; END IF;
 IF d->>'origin'=concat_ws(' · ',d->>'country',d->>'city',d->>'address') THEN RAISE EXCEPTION 'El destino debe ser diferente del origen'; END IF;
 SELECT * INTO s FROM logistics_shipments WHERE id=p_id FOR UPDATE; was_new=NOT FOUND;
 IF NOT was_new THEN
  IF s.version<>p_version THEN RAISE EXCEPTION 'El envío cambió. Recarga antes de editar'; END IF;
  IF s.status NOT IN ('Pendiente','En preparación','Listo para despacho') THEN RAISE EXCEPTION 'Solo se editan envíos sin despachar'; END IF;
  INSERT INTO logistics_events(shipment_id,actor,actor_name,action,previous_status,status,details) SELECT p_id,auth.uid(),full_name,'Edición',s.status,s.status,jsonb_build_object('previous',to_jsonb(s),'previous_lines',(SELECT jsonb_agg(to_jsonb(l)) FROM logistics_lines l WHERE shipment_id=p_id),'previous_lots',(SELECT jsonb_agg(to_jsonb(l)) FROM logistics_lots l WHERE shipment_id=p_id)) FROM profiles WHERE id=auth.uid();
  DELETE FROM logistics_lines WHERE shipment_id=p_id;
  UPDATE logistics_shipments SET kind=k,client_id=cid,client_snapshot=coalesce(to_jsonb(c),'{}'),details=d,version=version+1,updated_at=now() WHERE id=p_id;
 ELSE
  IF p_version<>0 THEN RAISE EXCEPTION 'Envío no encontrado'; END IF;
  INSERT INTO logistics_shipments(id,kind,client_id,client_snapshot,details,created_by) VALUES(p_id,k,cid,coalesce(to_jsonb(c),'{}'),d,auth.uid());
 END IF;
 -- Stable row ordering serializes this operation with dispatches and stock adjustments.
 PERFORM id FROM items WHERE id IN(SELECT (value->>'item_id')::uuid FROM jsonb_array_elements(p_lines)) ORDER BY id FOR UPDATE;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO i FROM items WHERE id=(entry->>'item_id')::uuid AND NOT archived;
  IF NOT FOUND OR i.quantity IS NULL OR i.location<>d->>'origin' THEN RAISE EXCEPTION 'Confirma stock y ubicación de origen de cada prenda'; END IF;
  IF coalesce((entry->>'quantity')::integer,0)<=0 THEN RAISE EXCEPTION 'La cantidad debe ser positiva'; END IF;
  IF i.quantity<(SELECT sum((value->>'quantity')::integer) FROM jsonb_array_elements(p_lines) WHERE value->>'item_id'=i.id::text) THEN RAISE EXCEPTION 'Existencias insuficientes para %',i.name; END IF;
  IF jsonb_typeof(entry->'materials') IS DISTINCT FROM 'array' OR jsonb_array_length(entry->'materials')=0 THEN RAISE EXCEPTION 'Registra al menos un material y proveedor'; END IF;
  FOR mat IN SELECT value FROM jsonb_array_elements(entry->'materials') LOOP
   IF EXISTS(SELECT 1 FROM unnest(ARRAY['supplier','material','yarn','composition']) key WHERE length(trim(coalesce(mat->>key,'')))=0) THEN RAISE EXCEPTION 'Completa proveedor, material, hilo y composición'; END IF;
  END LOOP;
  lot_label=trim(coalesce(entry->>'shipping_lot','1'));
  IF lot_label='' THEN RAISE EXCEPTION 'Identifica el lote de envío'; END IF;
  SELECT id INTO lot FROM logistics_lots WHERE shipment_id=p_id AND label=lot_label;
  IF NOT FOUND THEN INSERT INTO logistics_lots(shipment_id,label) VALUES(p_id,lot_label) RETURNING id INTO lot; END IF;
  INSERT INTO logistics_lines(shipment_id,lot_id,item_id,quantity,production_lot,materials,snapshot) VALUES(p_id,lot,i.id,(entry->>'quantity')::integer,coalesce(entry->>'production_lot',''),entry->'materials',to_jsonb(i));
 END LOOP;
 DELETE FROM logistics_lots lot WHERE lot.shipment_id=p_id AND NOT EXISTS(SELECT 1 FROM logistics_lines l WHERE l.lot_id=lot.id);
 IF was_new THEN INSERT INTO logistics_events(shipment_id,actor,actor_name,action,status,details) SELECT p_id,auth.uid(),full_name,'Registro','Pendiente',d FROM profiles WHERE id=auth.uid(); END IF;
 RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION public.logistics_transition(p_id uuid,p_status text,p_version integer,p_details jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.logistics_shipments; l public.logistics_lines; i public.items; target public.items; dest text; destid uuid; d jsonb; n integer;
BEGIN
 IF coalesce(public.user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 SELECT * INTO s FROM logistics_shipments WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Envío no encontrado'; END IF;
 -- Repeated successful confirmations cannot deduct or receive twice.
 IF s.status=p_status THEN RETURN; END IF;
 IF s.version<>p_version THEN RAISE EXCEPTION 'El envío cambió. Recarga su ficha'; END IF;
 IF NOT ((s.status='Pendiente' AND p_status='En preparación') OR (s.status='En preparación' AND p_status='Listo para despacho') OR (s.status='Listo para despacho' AND p_status='En tránsito') OR (s.status='En tránsito' AND p_status='Entregado') OR (s.status IN ('En tránsito','Entregado') AND p_status='Recepción confirmada') OR (s.status IN ('Pendiente','En preparación','Listo para despacho') AND p_status='Cancelado')) THEN RAISE EXCEPTION 'Cambio de estado no permitido'; END IF;
 d=s.details||jsonb_strip_nulls(jsonb_build_object('departed_on',nullif(p_details->>'departed_on',''),'received_on',nullif(p_details->>'received_on',''),'received_by',nullif(trim(p_details->>'received_by'),'')));
 IF p_status='Cancelado' AND length(trim(coalesce(p_details->>'notes','')))<3 THEN RAISE EXCEPTION 'Indica el motivo de cancelación'; END IF;
 IF p_status='En tránsito' THEN
  IF NOT EXISTS(SELECT 1 FROM logistics_lines WHERE shipment_id=p_id) THEN RAISE EXCEPTION 'El envío no contiene prendas'; END IF;
  IF nullif(d->>'departed_on','') IS NULL OR (d->>'departed_on')::date<(d->>'issued_on')::date OR (d->>'departed_on')::date>(now() AT TIME ZONE 'America/Lima')::date THEN RAISE EXCEPTION 'Revisa la fecha real de salida'; END IF;
  IF nullif(d->>'estimated_on','') IS NOT NULL AND (d->>'estimated_on')::date<(d->>'departed_on')::date THEN RAISE EXCEPTION 'La llegada estimada es anterior a la salida'; END IF;
  PERFORM id FROM items WHERE id IN(SELECT item_id FROM logistics_lines WHERE shipment_id=p_id) ORDER BY id FOR UPDATE;
  FOR i IN SELECT * FROM items WHERE id IN(SELECT item_id FROM logistics_lines WHERE shipment_id=p_id) ORDER BY id LOOP
   SELECT sum(quantity) INTO n FROM logistics_lines WHERE shipment_id=p_id AND item_id=i.id;
   IF i.archived OR i.quantity IS NULL OR i.quantity<n OR i.location<>d->>'origin' OR EXISTS(SELECT 1 FROM logistics_lines ll WHERE ll.shipment_id=p_id AND ll.item_id=i.id AND (ll.snapshot->>'model_code',ll.snapshot->>'category',ll.snapshot->>'material',ll.snapshot->>'composition',ll.snapshot->>'color',ll.snapshot->>'size',ll.snapshot->>'supplier',ll.snapshot->>'commercial_name',ll.snapshot->>'material_code') IS DISTINCT FROM (i.model_code,i.category,i.material,i.composition,i.color,i.size,i.supplier,i.commercial_name,i.material_code)) THEN RAISE EXCEPTION 'Stock o ficha cambiaron para %. Revisa el envío',i.name; END IF;
   PERFORM record_movement(i.id,'salida',n,'Despacho '||s.code,s.code,gen_random_uuid());
  END LOOP;
 END IF;
 IF p_status='Recepción confirmada' THEN
  IF length(trim(coalesce(d->>'received_by','')))=0 OR nullif(d->>'received_on','') IS NULL OR (d->>'received_on')::date<(d->>'departed_on')::date OR (d->>'received_on')::date>(now() AT TIME ZONE 'America/Lima')::date THEN RAISE EXCEPTION 'Indica receptor y fecha real de llegada válida'; END IF;
  dest=concat_ws(' · ',d->>'country',d->>'city',d->>'address');
  -- Per-shipment destination rows retain production-lot and source identity, including WAYRA pieces.
  FOR l IN SELECT * FROM logistics_lines WHERE shipment_id=p_id ORDER BY item_id,id LOOP
   destid=gen_random_uuid();
   target=jsonb_populate_record(NULL::public.items,l.snapshot||jsonb_build_object('id',destid,'sku','REC-'||l.id::text,'location',dest,'quantity',0,'production_lot',l.production_lot,'archived',false,'updated_at',now(),'notes',coalesce(l.snapshot->>'notes','')||E'\nRecepción '||s.code||' · lote producción: '||l.production_lot));
   INSERT INTO items SELECT target.*;
   PERFORM record_movement(destid,'entrada',l.quantity,'Recepción '||s.code,s.code,gen_random_uuid());
   UPDATE logistics_lines SET destination_item_id=destid WHERE id=l.id;
  END LOOP;
 END IF;
 UPDATE logistics_shipments SET status=p_status,details=d,version=version+1,updated_at=now(),dispatched_at=CASE WHEN p_status='En tránsito' THEN now() ELSE dispatched_at END,received_at=CASE WHEN p_status='Recepción confirmada' THEN now() ELSE received_at END WHERE id=p_id;
 INSERT INTO logistics_events(shipment_id,actor,actor_name,action,previous_status,status,details) SELECT p_id,auth.uid(),full_name,'Estado',s.status,p_status,d||jsonb_build_object('change_notes',coalesce(p_details->>'notes','')) FROM profiles WHERE id=auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.logistics_register_document(p_id uuid,p_shipment uuid,p_name text,p_mime text,p_size integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(public.user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 INSERT INTO logistics_documents(id,shipment_id,name,mime,size,path,actor) VALUES(p_id,p_shipment,p_name,p_mime,p_size,p_shipment::text||'/'||p_id::text,auth.uid());
 INSERT INTO logistics_events(shipment_id,actor,actor_name,action,status,details) SELECT s.id,auth.uid(),p.full_name,'Documento adjunto',s.status,jsonb_build_object('name',p_name,'document',p_id) FROM logistics_shipments s JOIN profiles p ON p.id=auth.uid() WHERE s.id=p_shipment;
END $$;
REVOKE ALL ON FUNCTION public.logistics_save_client(uuid,jsonb,integer),public.logistics_save_shipment(uuid,jsonb,jsonb,integer),public.logistics_transition(uuid,text,integer,jsonb),public.logistics_register_document(uuid,uuid,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.logistics_save_client(uuid,jsonb,integer),public.logistics_save_shipment(uuid,jsonb,jsonb,integer),public.logistics_transition(uuid,text,integer,jsonb),public.logistics_register_document(uuid,uuid,text,text,integer) TO authenticated;
COMMIT;
