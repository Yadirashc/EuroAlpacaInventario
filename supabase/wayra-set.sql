BEGIN;
CREATE OR REPLACE FUNCTION public.transfer_stock(p_from uuid,p_to uuid,p_amount integer,p_reason text,p_request uuid DEFAULT gen_random_uuid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.items; b public.items;
BEGIN
 IF public.user_role() NOT IN ('admin','operadora') OR public.user_role() IS NULL THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_from=p_to OR p_amount IS NULL OR p_amount<=0 OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Traslado inválido'; END IF;
 PERFORM id FROM public.items WHERE id IN(p_from,p_to) ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.movements WHERE id=p_request) THEN RETURN; END IF;
 SELECT * INTO a FROM public.items WHERE id=p_from AND NOT archived; SELECT * INTO b FROM public.items WHERE id=p_to AND NOT archived;
 IF a.id IS NULL OR b.id IS NULL OR a.quantity IS NULL OR b.quantity IS NULL OR a.quantity<p_amount THEN RAISE EXCEPTION 'Revisa existencias de origen y destino'; END IF;
 IF (a.model_code,a.material,a.color,a.size) IS DISTINCT FROM (b.model_code,b.material,b.color,b.size) OR (a.model_code='CR09' AND lower(trim(a.category)) IS DISTINCT FROM lower(trim(b.category))) OR a.location=b.location THEN RAISE EXCEPTION 'Selecciona la misma variante en otra ubicación'; END IF;
 UPDATE public.items SET quantity=quantity-p_amount,updated_at=now() WHERE id=p_from;
 UPDATE public.items SET quantity=quantity+p_amount,updated_at=now() WHERE id=p_to;
 INSERT INTO public.movements(id,item_id,kind,amount,before_quantity,after_quantity,reason,reference,actor) VALUES(p_request,a.id,'traslado_salida',p_amount,a.quantity,a.quantity-p_amount,p_reason,p_to::text,auth.uid()),(gen_random_uuid(),b.id,'traslado_entrada',p_amount,b.quantity,b.quantity+p_amount,p_reason,p_from::text,auth.uid());
END; $$;

COMMIT;
