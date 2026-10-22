-- Additive migration: existing quantities and locations are never reassigned.
BEGIN;
CREATE TABLE IF NOT EXISTS public.stock_operations (
 id uuid PRIMARY KEY, item_id uuid NOT NULL REFERENCES public.items(id),
 kind text NOT NULL CHECK(kind IN ('venta','entrega','devolucion','produccion','conteo_produccion','reversion')),
 quantity integer NOT NULL CHECK(quantity>0), details jsonb NOT NULL,
 related_id uuid REFERENCES public.stock_operations(id), snapshot jsonb NOT NULL,
 actor uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_operations_item ON public.stock_operations(item_id,created_at);
CREATE INDEX IF NOT EXISTS stock_operations_related ON public.stock_operations(related_id);
ALTER TABLE public.stock_operations DROP CONSTRAINT IF EXISTS stock_operations_kind_check;
ALTER TABLE public.stock_operations ADD CONSTRAINT stock_operations_kind_check CHECK(kind IN ('venta','entrega','devolucion','produccion','conteo_produccion','reversion'));
ALTER TABLE public.stock_operations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stock_operations_read ON public.stock_operations;
CREATE POLICY stock_operations_read ON public.stock_operations FOR SELECT TO authenticated USING(public.user_role() IS NOT NULL);
REVOKE ALL ON public.stock_operations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.stock_operations TO authenticated;
GRANT ALL ON public.stock_operations TO service_role;
CREATE OR REPLACE FUNCTION public.stock_operate(p_id uuid,p_item uuid,p_kind text,p_quantity integer,p_details jsonb,p_related uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i public.items; old public.stock_operations; delivery public.stock_operations; returned integer; outgoing boolean;
BEGIN
 IF coalesce(public.user_role(),'') NOT IN ('admin','operadora') THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_id IS NULL OR p_quantity IS NULL OR p_quantity<=0 OR p_kind IS NULL OR p_kind NOT IN ('venta','entrega','devolucion','produccion','conteo_produccion','reversion') OR p_details IS NULL OR jsonb_typeof(p_details)<>'object' THEN RAISE EXCEPTION 'Operación inválida'; END IF;
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
 outgoing=p_kind IN ('venta','entrega');
 IF outgoing AND i.quantity<p_quantity THEN RAISE EXCEPTION 'Existencias insuficientes'; END IF;
 IF outgoing AND i.location NOT IN ('Lima','España') AND i.location NOT LIKE 'Lima · %' AND i.location NOT LIKE 'España · %' THEN RAISE EXCEPTION 'Verifica la ubicación antes de retirar prendas'; END IF;
 INSERT INTO stock_operations(id,item_id,kind,quantity,details,related_id,snapshot,actor) VALUES(p_id,p_item,p_kind,p_quantity,p_details,p_related,to_jsonb(i),auth.uid());
 IF p_kind<>'conteo_produccion' THEN
 PERFORM record_movement(p_item,CASE WHEN outgoing THEN 'salida' ELSE 'entrada' END,p_quantity,p_kind||' · '||coalesce(p_details->>'reason',p_details->>'client','Registro'),p_id::text,p_id);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.stock_operate(uuid,uuid,text,integer,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.stock_operate(uuid,uuid,text,integer,jsonb,uuid) TO authenticated;
COMMIT;
