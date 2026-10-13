BEGIN;
CREATE TABLE IF NOT EXISTS public.quantity_edit_batches(id uuid PRIMARY KEY,actor uuid NOT NULL REFERENCES public.profiles(id),changes jsonb NOT NULL,reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.quantity_edit_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS quantity_batches_admin ON public.quantity_edit_batches;
CREATE POLICY quantity_batches_admin ON public.quantity_edit_batches FOR SELECT TO authenticated USING(public.user_role()='admin');
REVOKE ALL ON public.quantity_edit_batches FROM anon,authenticated;
GRANT SELECT ON public.quantity_edit_batches TO authenticated;
GRANT ALL ON public.quantity_edit_batches TO service_role;
CREATE OR REPLACE FUNCTION public.apply_quantity_edits(p_changes jsonb,p_reason text,p_request uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry jsonb; previous_batch public.quantity_edit_batches; item public.items; total integer;
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo la administradora puede editar cantidades'; END IF;
 IF p_changes IS NULL OR jsonb_typeof(p_changes)<>'array' OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 500 OR p_reason IS NULL OR length(trim(p_reason))<3 OR p_request IS NULL THEN RAISE EXCEPTION 'Revisa las cantidades y el motivo'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO previous_batch FROM public.quantity_edit_batches WHERE id=p_request;
 IF FOUND THEN
  IF previous_batch.actor IS DISTINCT FROM auth.uid() OR previous_batch.changes IS DISTINCT FROM p_changes OR previous_batch.reason IS DISTINCT FROM trim(p_reason) THEN RAISE EXCEPTION 'La solicitud ya se usó con otros cambios'; END IF;
  RETURN;
 END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
  IF jsonb_typeof(entry)<>'object' OR NOT(entry ? 'id' AND entry ? 'before' AND entry ? 'after') OR (entry->>'after') IS NULL OR (entry->>'after') !~ '^(0|[1-9][0-9]*)$' THEN RAISE EXCEPTION 'Cantidad final inválida'; END IF;
  IF (entry->>'before') IS NOT NULL AND (entry->>'before') !~ '^(0|[1-9][0-9]*)$' THEN RAISE EXCEPTION 'Cantidad inicial inválida'; END IF;
 END LOOP;
 SELECT count(DISTINCT (value->>'id')::uuid) INTO total FROM jsonb_array_elements(p_changes);
 IF total<>jsonb_array_length(p_changes) THEN RAISE EXCEPTION 'No repitas una prenda en los cambios'; END IF;
 PERFORM id FROM public.items WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_changes)) ORDER BY id FOR UPDATE;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
  SELECT * INTO item FROM public.items WHERE id=(entry->>'id')::uuid AND NOT archived;
  IF NOT FOUND THEN RAISE EXCEPTION 'Una prenda ya no está disponible'; END IF;
  IF item.quantity IS DISTINCT FROM (entry->>'before')::integer THEN RAISE EXCEPTION 'La cantidad de % cambió desde que empezaste a editar. Recarga el inventario y revisa tus cambios.',item.name; END IF;
 END LOOP;
 INSERT INTO public.quantity_edit_batches(id,actor,changes,reason) VALUES(p_request,auth.uid(),p_changes,trim(p_reason));
 FOR entry IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
  PERFORM public.record_movement((entry->>'id')::uuid,'ajuste',(entry->>'after')::integer,trim(p_reason),'Modo edición · '||p_request::text,gen_random_uuid());
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.apply_quantity_edits(jsonb,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_quantity_edits(jsonb,text,uuid) TO authenticated;
COMMIT;
