-- Run after stock-control.sql. Existing stock and original sale records are preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.distribution_key(i public.items) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_array(i.model_code,i.name,i.category,i.material,i.composition,i.color,i.color_code,i.size,i.material_code,i.threads,i.yarn_title,i.gender,i.production_state);
$$;
CREATE OR REPLACE FUNCTION public.distribution_destination(p_source public.items,p_location text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE dest public.items; payload jsonb;
BEGIN
 SELECT * INTO dest FROM items WHERE NOT archived AND location=p_location
 AND distribution_key(items)=distribution_key(p_source) ORDER BY id LIMIT 1 FOR UPDATE;
 IF FOUND THEN
  IF dest.quantity IS NULL THEN RAISE EXCEPTION 'Confirma las existencias del destino'; END IF;
  RETURN dest.id;
 END IF;
 payload=to_jsonb(p_source)||jsonb_build_object('id',gen_random_uuid(),'sku','MOV-'||gen_random_uuid()::text,'location',p_location,'quantity',0,'archived',false,'updated_at',now());
 INSERT INTO items SELECT (jsonb_populate_record(NULL::public.items,payload)).* RETURNING * INTO dest;
 RETURN dest.id;
END $$;
REVOKE ALL ON FUNCTION public.distribution_destination(public.items,text) FROM PUBLIC,anon,authenticated;

ALTER TABLE stock_operations DROP CONSTRAINT stock_operations_kind_check;
ALTER TABLE stock_operations ADD CONSTRAINT stock_operations_kind_check CHECK(kind IN ('venta','entrega','devolucion','produccion','conteo_produccion','reversion','traslado'));

CREATE OR REPLACE FUNCTION public.distribute_stock(p_id uuid,p_item uuid,p_destination text,p_quantity integer,p_details jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.items; dest uuid; old public.stock_operations;
BEGIN
 IF coalesce(user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_id IS NULL OR p_quantity IS NULL OR p_quantity<=0 OR p_destination IS NULL OR p_destination NOT IN ('Lima','España','Muestras / revisión') OR p_details IS NULL OR jsonb_typeof(p_details)<>'object' THEN RAISE EXCEPTION 'Traslado inválido'; END IF;
 IF nullif(trim(p_details->>'person'),'') IS NULL OR nullif(trim(p_details->>'responsible'),'') IS NULL OR nullif(p_details->>'date','') IS NULL OR (p_details->>'date')::date>(now() AT TIME ZONE 'America/Lima')::date THEN RAISE EXCEPTION 'Indica fecha, persona y responsable'; END IF;
 PERFORM pg_advisory_xact_lock(64120261022);
 SELECT * INTO old FROM stock_operations WHERE id=p_id;
 IF FOUND THEN
  IF (old.item_id,old.kind,old.quantity,old.details,old.actor) IS DISTINCT FROM (p_item,'traslado',p_quantity,p_details||jsonb_build_object('destination',p_destination),auth.uid()) THEN RAISE EXCEPTION 'Solicitud reutilizada con otros datos'; END IF;
  RETURN (SELECT id FROM items WHERE NOT archived AND location=p_destination AND distribution_key(items)=distribution_key(jsonb_populate_record(NULL::items,old.snapshot)) ORDER BY id LIMIT 1);
 END IF;
 SELECT * INTO i FROM items WHERE id=p_item AND NOT archived FOR UPDATE;
 IF EXISTS(SELECT 1 FROM movements WHERE id=p_id) THEN RAISE EXCEPTION 'Identificador ya utilizado'; END IF;
 IF NOT FOUND OR i.quantity IS NULL OR i.quantity<p_quantity THEN RAISE EXCEPTION 'Existencias insuficientes o sin confirmar'; END IF;
 IF i.location='Vendida' OR i.location=p_destination THEN RAISE EXCEPTION 'Selecciona otra ubicación disponible'; END IF;
 dest=distribution_destination(i,p_destination);
 PERFORM record_movement(i.id,'salida',p_quantity,'Distribuir stock',p_id::text,p_id);
 PERFORM record_movement(dest,'entrada',p_quantity,'Distribuir stock',p_id::text,gen_random_uuid());
 INSERT INTO stock_operations(id,item_id,kind,quantity,details,snapshot,actor) VALUES(p_id,i.id,'traslado',p_quantity,p_details||jsonb_build_object('destination',p_destination),to_jsonb(i),auth.uid());
 RETURN dest;
END $$;
REVOKE ALL ON FUNCTION public.distribute_stock(uuid,uuid,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distribute_stock(uuid,uuid,text,integer,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_sold_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE src public.items; dest uuid; q integer; delta integer;
BEGIN
 IF NEW.kind NOT IN ('venta','reversion') THEN RETURN NEW; END IF;
 IF NEW.kind='reversion' THEN
  SELECT (jsonb_populate_record(NULL::items,snapshot)).* INTO src FROM stock_operations WHERE id=NEW.related_id;
 ELSE
  src=jsonb_populate_record(NULL::items,NEW.snapshot);
 END IF;
 dest=distribution_destination(src,'Vendida');
 SELECT quantity INTO q FROM items WHERE id=dest FOR UPDATE;
 delta=CASE WHEN NEW.kind='venta' THEN NEW.quantity ELSE -NEW.quantity END;
 IF q+delta<0 THEN RAISE EXCEPTION 'Saldo vendido inconsistente'; END IF;
 UPDATE items SET quantity=q+delta,updated_at=now() WHERE id=dest;
 INSERT INTO movements(item_id,kind,amount,before_quantity,after_quantity,reason,reference,actor)
 VALUES(dest,CASE WHEN delta>0 THEN 'entrada' ELSE 'salida' END,NEW.quantity,q,q+delta,'Vendida · '||NEW.kind,NEW.id::text,NEW.actor);
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sync_sold_stock ON stock_operations;
CREATE TRIGGER sync_sold_stock AFTER INSERT ON stock_operations FOR EACH ROW EXECUTE FUNCTION sync_sold_stock();
REVOKE ALL ON FUNCTION public.sync_sold_stock() FROM PUBLIC;

-- Materialize historical net sales without touching the source quantities or history.
DO $$ DECLARE o public.stock_operations; src public.items; dest uuid; net integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM items WHERE sku LIKE 'SOLD-MIGRATION-%') AND NOT EXISTS(SELECT 1 FROM items WHERE location='Vendida') THEN
 FOR o IN SELECT * FROM stock_operations WHERE kind='venta' ORDER BY created_at,id LOOP
  src=jsonb_populate_record(NULL::items,o.snapshot); dest=distribution_destination(src,'Vendida');
  SELECT o.quantity-coalesce(sum(quantity),0) INTO net FROM stock_operations WHERE kind='reversion' AND related_id=o.id;
  UPDATE items SET quantity=quantity+net WHERE id=dest;
 END LOOP;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_location_edit() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.location IS DISTINCT FROM OLD.location AND (coalesce(OLD.quantity,0)>0 OR OLD.location='Vendida' OR NEW.location='Vendida') THEN RAISE EXCEPTION 'Usa Distribuir stock o Registrar venta para cambiar la ubicación'; END IF;
 IF OLD.location='Vendida' AND (NEW.archived OR distribution_key(NEW) IS DISTINCT FROM distribution_key(OLD)) THEN RAISE EXCEPTION 'Conserva la variante vendida; usa su historial para corregir ventas'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_location_edit ON items;
CREATE TRIGGER guard_location_edit BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION guard_location_edit();
REVOKE ALL ON FUNCTION public.guard_location_edit() FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.stock_operate(p_id uuid,p_item uuid,p_kind text,p_quantity integer,p_details jsonb,p_related uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.items; old public.stock_operations; delivery public.stock_operations; returned integer; outgoing boolean;
BEGIN
 IF coalesce(public.user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_id IS NULL OR p_quantity IS NULL OR p_quantity<=0 OR p_kind IS NULL OR p_kind NOT IN ('venta','entrega','devolucion','produccion','conteo_produccion','reversion') OR p_details IS NULL OR jsonb_typeof(p_details)<>'object' THEN RAISE EXCEPTION 'Operación inválida'; END IF;
 PERFORM pg_advisory_xact_lock(64120261022);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO old FROM stock_operations WHERE id=p_id;
 IF FOUND THEN
  IF (old.item_id,old.kind,old.quantity,old.details,old.related_id,old.actor) IS DISTINCT FROM (p_item,p_kind,p_quantity,p_details,p_related,auth.uid()) THEN RAISE EXCEPTION 'Solicitud reutilizada con otros datos'; END IF;
  RETURN;
 END IF;
 IF nullif(trim(p_details->>'date'),'') IS NULL OR (p_details->>'date')::date>(now() AT TIME ZONE 'America/Lima')::date OR length(trim(coalesce(p_details->>'responsible','')))=0 THEN RAISE EXCEPTION 'Indica fecha válida y responsable'; END IF;
 IF EXISTS(SELECT 1 FROM movements WHERE id=p_id) THEN RAISE EXCEPTION 'Identificador ya utilizado'; END IF;
 IF p_kind='conteo_produccion' AND (public.user_role()<>'admin' OR length(trim(coalesce(p_details->>'reason','')))<3) THEN RAISE EXCEPTION 'Solo administradora puede confirmar producción con un motivo'; END IF;
 IF p_kind IN ('venta','entrega') AND length(trim(coalesce(p_details->>'person','')))=0 THEN RAISE EXCEPTION 'Indica quién retiró o recibió'; END IF;
 IF p_kind='venta' THEN
  IF nullif(p_details->>'price','') IS NOT NULL AND (p_details->>'price') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Precio inválido'; END IF;
  IF coalesce(p_details->>'currency','') NOT IN ('PEN','EUR','USD') THEN RAISE EXCEPTION 'Moneda inválida'; END IF;
  IF nullif(p_details->>'price','') IS NOT NULL THEN IF (p_details->>'total')::numeric IS DISTINCT FROM round((p_details->>'price')::numeric*p_quantity,2) THEN RAISE EXCEPTION 'Importe inválido'; END IF; END IF;
 END IF;
 IF p_kind='venta' AND (length(trim(coalesce(p_details->>'client','')))=0 OR (nullif(p_details->>'price','') IS NOT NULL AND (p_details->>'price')::numeric<=0)) THEN RAISE EXCEPTION 'Revisa cliente y precio'; END IF;
 IF p_kind='entrega' AND (coalesce(p_details->>'reason','') NOT IN ('muestra','préstamo','exhibición','otro') OR length(trim(coalesce(p_details->>'destination','')))=0) THEN RAISE EXCEPTION 'Indica motivo y destino de la custodia'; END IF;
 IF p_kind NOT IN ('devolucion','reversion') AND p_related IS NOT NULL THEN RAISE EXCEPTION 'Referencia inválida'; END IF;
 IF p_kind='reversion' THEN
  IF length(trim(coalesce(p_details->>'reason','')))<3 THEN RAISE EXCEPTION 'Explica el motivo de la corrección'; END IF;
  SELECT * INTO delivery FROM stock_operations WHERE id=p_related FOR UPDATE;
  IF NOT FOUND OR delivery.kind<>'venta' OR delivery.item_id<>p_item THEN RAISE EXCEPTION 'Venta de origen inválida'; END IF;
  SELECT coalesce(sum(quantity),0) INTO returned FROM stock_operations WHERE related_id=p_related AND kind='reversion';
  IF returned+p_quantity>delivery.quantity OR (p_details->>'date')::date<(delivery.details->>'date')::date THEN RAISE EXCEPTION 'Cantidad o fecha de corrección inválida'; END IF;
 END IF;
 -- Lock delivery before item consistently; partial returns cannot exceed outstanding custody.
 IF p_kind='devolucion' THEN
  SELECT * INTO delivery FROM stock_operations WHERE id=p_related FOR UPDATE;
  IF NOT FOUND OR delivery.kind<>'entrega' OR delivery.item_id<>p_item THEN RAISE EXCEPTION 'Entrega de origen inválida'; END IF;
  SELECT coalesce(sum(quantity),0) INTO returned FROM stock_operations WHERE related_id=p_related AND kind='devolucion';
  IF returned+p_quantity>delivery.quantity OR (p_details->>'date')::date<(delivery.details->>'date')::date THEN RAISE EXCEPTION 'Cantidad o fecha de devolución inválida'; END IF;
 END IF;
 SELECT * INTO i FROM items WHERE id=p_item AND NOT archived FOR UPDATE;
 IF NOT FOUND OR i.quantity IS NULL THEN RAISE EXCEPTION 'Confirma existencias y ubicación primero'; END IF;
 IF i.location='Vendida' THEN RAISE EXCEPTION 'Las prendas vendidas no están disponibles'; END IF;
 outgoing=p_kind IN ('venta','entrega');
 IF outgoing AND i.quantity<p_quantity THEN RAISE EXCEPTION 'Existencias insuficientes'; END IF;
 IF outgoing AND i.location NOT IN ('Lima','España') AND i.location NOT LIKE 'Lima · %' AND i.location NOT LIKE 'España · %' AND i.location<>'Muestras / revisión' THEN RAISE EXCEPTION 'Verifica la ubicación antes de retirar prendas'; END IF;
 INSERT INTO stock_operations(id,item_id,kind,quantity,details,related_id,snapshot,actor) VALUES(p_id,p_item,p_kind,p_quantity,p_details,p_related,to_jsonb(i),auth.uid());
 IF p_kind<>'conteo_produccion' THEN
 PERFORM record_movement(p_item,CASE WHEN outgoing THEN 'salida' ELSE 'entrada' END,p_quantity,p_kind||' · '||coalesce(p_details->>'reason',p_details->>'client','Registro'),p_id::text,p_id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.record_movement(p_item uuid,p_kind text,p_amount integer,p_reason text,p_reference text DEFAULT '',p_request uuid DEFAULT gen_random_uuid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_item public.items; next_qty integer;
BEGIN
 IF public.user_role() NOT IN ('admin','operadora') OR public.user_role() IS NULL THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_kind NOT IN ('entrada','salida','ajuste') OR p_amount IS NULL OR p_amount<0 OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Movimiento inválido'; END IF;
 IF p_kind='ajuste' AND public.user_role()<>'admin' THEN RAISE EXCEPTION 'Solo administradora puede ajustar'; END IF;
 SELECT * INTO current_item FROM public.items WHERE id=p_item AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prenda no encontrada'; END IF;
 IF current_item.location='Vendida' THEN RAISE EXCEPTION 'Las prendas vendidas se corrigen desde su historial de ventas'; END IF;
 IF EXISTS(SELECT 1 FROM public.movements WHERE id=p_request) THEN RETURN; END IF;
 IF p_kind<>'ajuste' AND (current_item.quantity IS NULL OR p_amount=0) THEN RAISE EXCEPTION 'Confirma el stock inicial y una cantidad positiva'; END IF;
 next_qty=CASE p_kind WHEN 'ajuste' THEN p_amount WHEN 'entrada' THEN current_item.quantity+p_amount ELSE current_item.quantity-p_amount END;
 IF next_qty<0 THEN RAISE EXCEPTION 'Existencias insuficientes'; END IF;
 UPDATE public.items SET quantity=next_qty,updated_at=now() WHERE id=p_item;
 INSERT INTO public.movements(id,item_id,kind,amount,before_quantity,after_quantity,reason,reference,actor) VALUES(p_request,p_item,p_kind,p_amount,current_item.quantity,next_qty,trim(p_reason),p_reference,auth.uid());
END; $$;
CREATE OR REPLACE FUNCTION public.transfer_stock(p_from uuid,p_to uuid,p_amount integer,p_reason text,p_request uuid DEFAULT gen_random_uuid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.items; b public.items;
BEGIN
 IF public.user_role() NOT IN ('admin','operadora') OR public.user_role() IS NULL THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_from=p_to OR p_amount IS NULL OR p_amount<=0 OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Traslado inválido'; END IF;
 PERFORM id FROM public.items WHERE id IN(p_from,p_to) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.movements WHERE id=p_request) THEN RETURN; END IF;
 SELECT * INTO a FROM public.items WHERE id=p_from AND NOT archived; SELECT * INTO b FROM public.items WHERE id=p_to AND NOT archived;
 IF a.location='Vendida' OR b.location='Vendida' THEN RAISE EXCEPTION 'Usa el historial de ventas'; END IF;
 IF a.id IS NULL OR b.id IS NULL OR a.quantity IS NULL OR b.quantity IS NULL OR a.quantity<p_amount THEN RAISE EXCEPTION 'Revisa existencias de origen y destino'; END IF;
 IF distribution_key(a) IS DISTINCT FROM distribution_key(b) OR (a.model_code='CR09' AND lower(trim(a.category)) IS DISTINCT FROM lower(trim(b.category))) OR a.location=b.location THEN RAISE EXCEPTION 'Selecciona la misma variante en otra ubicación'; END IF;
 UPDATE public.items SET quantity=quantity-p_amount,updated_at=now() WHERE id=p_from;
 UPDATE public.items SET quantity=quantity+p_amount,updated_at=now() WHERE id=p_to;
 INSERT INTO public.movements(id,item_id,kind,amount,before_quantity,after_quantity,reason,reference,actor) VALUES(p_request,a.id,'traslado_salida',p_amount,a.quantity,a.quantity-p_amount,p_reason,p_to::text,auth.uid()),(gen_random_uuid(),b.id,'traslado_entrada',p_amount,b.quantity,b.quantity+p_amount,p_reason,p_from::text,auth.uid());
END; $$;

COMMIT;
