BEGIN;
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, email text NOT NULL, full_name text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'consulta' CHECK(role IN ('admin','operadora','consulta')), active boolean NOT NULL DEFAULT true);
CREATE FUNCTION public.handle_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.profiles(id,email,full_name) VALUES(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name','')); RETURN new; END; $$;
CREATE TRIGGER new_auth_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user();
CREATE FUNCTION public.user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() AND active; $$;
CREATE TABLE public.items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL UNIQUE, model_code text NOT NULL, name text NOT NULL, category text NOT NULL, description text DEFAULT '', material text DEFAULT '', commercial_name text DEFAULT '', composition text DEFAULT '', material_code text DEFAULT '', color text DEFAULT '', color_code text DEFAULT '', size text DEFAULT '', location text NOT NULL, status text DEFAULT 'DISPONIBLE', production_state text DEFAULT 'TERMINADO', supplier text DEFAULT '', quantity integer CHECK(quantity>=0), min_stock integer NOT NULL DEFAULT 2 CHECK(min_stock>=0), notes text DEFAULT '', inventory_type text DEFAULT '', threads text DEFAULT '', yarn_title text DEFAULT '', gender text DEFAULT '', weight text DEFAULT '', production_weight text DEFAULT '', source_sheet integer, source_row integer, review_required boolean NOT NULL DEFAULT false, archived boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES public.items(id), kind text NOT NULL CHECK(kind IN ('entrada','salida','ajuste','traslado_entrada','traslado_salida')), amount integer NOT NULL CHECK(amount>=0), before_quantity integer, after_quantity integer NOT NULL CHECK(after_quantity>=0), reason text NOT NULL, reference text DEFAULT '', actor uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.items ADD COLUMN source_sheet_name text, ADD COLUMN source_snapshot jsonb;
CREATE TABLE public.audit_log (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, item_id uuid REFERENCES public.items(id), actor uuid REFERENCES public.profiles(id), operation text NOT NULL, previous jsonb, current jsonb, created_at timestamptz DEFAULT now());
CREATE FUNCTION public.audit_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.audit_log(item_id,actor,operation,previous,current) VALUES(new.id,auth.uid(),TG_OP,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(old) ELSE NULL END,to_jsonb(new)); RETURN new; END; $$;
CREATE TRIGGER item_audit AFTER INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.audit_item();
CREATE FUNCTION public.record_movement(p_item uuid,p_kind text,p_amount integer,p_reason text,p_reference text DEFAULT '',p_request uuid DEFAULT gen_random_uuid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_item public.items; next_qty integer;
BEGIN
 IF public.user_role() NOT IN ('admin','operadora') OR public.user_role() IS NULL THEN RAISE EXCEPTION 'Sin permisos'; END IF;
 IF p_kind NOT IN ('entrada','salida','ajuste') OR p_amount IS NULL OR p_amount<0 OR length(trim(p_reason))<3 THEN RAISE EXCEPTION 'Movimiento inválido'; END IF;
 IF p_kind='ajuste' AND public.user_role()<>'admin' THEN RAISE EXCEPTION 'Solo administradora puede ajustar'; END IF;
 SELECT * INTO current_item FROM public.items WHERE id=p_item AND NOT archived FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prenda no encontrada'; END IF;
 IF EXISTS(SELECT 1 FROM public.movements WHERE id=p_request) THEN RETURN; END IF;
 IF p_kind<>'ajuste' AND (current_item.quantity IS NULL OR p_amount=0) THEN RAISE EXCEPTION 'Confirma el stock inicial y una cantidad positiva'; END IF;
 next_qty=CASE p_kind WHEN 'ajuste' THEN p_amount WHEN 'entrada' THEN current_item.quantity+p_amount ELSE current_item.quantity-p_amount END;
 IF next_qty<0 THEN RAISE EXCEPTION 'Existencias insuficientes'; END IF;
 UPDATE public.items SET quantity=next_qty,updated_at=now() WHERE id=p_item;
 INSERT INTO public.movements(id,item_id,kind,amount,before_quantity,after_quantity,reason,reference,actor) VALUES(p_request,p_item,p_kind,p_amount,current_item.quantity,next_qty,trim(p_reason),p_reference,auth.uid());
END; $$;
CREATE FUNCTION public.transfer_stock(p_from uuid,p_to uuid,p_amount integer,p_reason text,p_request uuid DEFAULT gen_random_uuid()) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.user_role()='admin');
CREATE POLICY items_read ON public.items FOR SELECT TO authenticated USING(public.user_role() IS NOT NULL);
CREATE POLICY items_insert ON public.items FOR INSERT TO authenticated WITH CHECK(public.user_role()='admin' AND (quantity IS NULL OR quantity=0));
CREATE POLICY items_update ON public.items FOR UPDATE TO authenticated USING(public.user_role()='admin') WITH CHECK(public.user_role()='admin');
CREATE POLICY movements_read ON public.movements FOR SELECT TO authenticated USING(public.user_role() IS NOT NULL);
CREATE POLICY audit_read ON public.audit_log FOR SELECT TO authenticated USING(public.user_role()='admin');
REVOKE ALL ON public.profiles,public.items,public.movements,public.audit_log FROM anon,authenticated;
GRANT SELECT ON public.profiles,public.items,public.movements,public.audit_log TO authenticated;
GRANT ALL ON public.profiles,public.items,public.movements,public.audit_log TO service_role;
GRANT INSERT ON public.items TO authenticated;
GRANT UPDATE(sku,model_code,name,category,description,material,commercial_name,composition,material_code,color,color_code,size,location,status,production_state,supplier,min_stock,notes,inventory_type,threads,yarn_title,gender,weight,production_weight,review_required,archived,source_snapshot) ON public.items TO authenticated;
REVOKE ALL ON FUNCTION public.handle_user(),public.audit_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_movement(uuid,text,integer,text,text,uuid),public.transfer_stock(uuid,uuid,integer,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_movement(uuid,text,integer,text,text,uuid),public.transfer_stock(uuid,uuid,integer,text,uuid) TO authenticated;
CREATE INDEX items_model ON public.items(model_code); CREATE INDEX movements_date ON public.movements(created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.items,public.movements;
COMMIT;

-- Modo de edición de cantidades
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

-- Precios de venta confirmados
BEGIN;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS sale_price numeric(10,2) CHECK(sale_price>0);
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS price_currency text NOT NULL DEFAULT 'PEN' CHECK(price_currency IN ('PEN','USD','EUR'));
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS price_updated_at timestamptz;
CREATE OR REPLACE FUNCTION public.stamp_item_price() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.price_updated_at=CASE WHEN NEW.sale_price IS NULL THEN NULL ELSE now() END;
 ELSIF (NEW.sale_price,NEW.price_currency) IS DISTINCT FROM (OLD.sale_price,OLD.price_currency) THEN
  NEW.price_updated_at=now();
 ELSE
  NEW.price_updated_at=OLD.price_updated_at;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS stamp_price ON public.items;
CREATE TRIGGER stamp_price BEFORE INSERT OR UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.stamp_item_price();
REVOKE ALL ON FUNCTION public.stamp_item_price() FROM PUBLIC;
GRANT UPDATE(sale_price,price_currency) ON public.items TO authenticated;
COMMIT;
