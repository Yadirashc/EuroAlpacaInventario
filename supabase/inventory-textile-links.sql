BEGIN;
CREATE OR REPLACE FUNCTION public.textile_key(v text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT regexp_replace(translate(upper(coalesce(v,'')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g')
$$;
CREATE OR REPLACE FUNCTION public.textile_color_code(v text,provider text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT public.textile_key(CASE WHEN public.textile_key(provider)='ITESSA' THEN regexp_replace(upper(trim(coalesce(v,''))),'^(NU|BA|BM|ZZ)\s*-?\s*','','i') ELSE v END)
$$;
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS textile_color_id uuid REFERENCES public.textile_colors(id);
GRANT UPDATE(textile_color_id) ON public.items TO authenticated;
CREATE OR REPLACE FUNCTION public.sync_item_textile_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE selected uuid; changed boolean;
BEGIN
 changed=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN changed=NEW.textile_color_id IS DISTINCT FROM OLD.textile_color_id;END IF;
 IF changed AND NEW.textile_color_id IS NOT NULL THEN selected=NEW.textile_color_id;
 ELSIF TG_OP='INSERT' OR NEW.source_snapshot IS DISTINCT FROM OLD.source_snapshot THEN selected=nullif(NEW.source_snapshot->>'_textile_color_id','')::uuid;
 ELSE RETURN NEW;END IF;
 IF selected IS NOT NULL AND NOT EXISTS(SELECT 1 FROM textile_colors c WHERE c.id=selected AND c.active AND c.deleted_at IS NULL) THEN RAISE EXCEPTION 'Selecciona un color disponible de Gestión textil';END IF;
 NEW.textile_color_id=selected;
 IF selected IS NULL THEN NEW.source_snapshot=coalesce(NEW.source_snapshot,'{}')-'_textile_color_id';
 ELSE NEW.source_snapshot=(coalesce(NEW.source_snapshot,'{}')-'_textile_color_cleared')||jsonb_build_object('_textile_color_id',selected);END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS item_textile_link ON public.items;
CREATE TRIGGER item_textile_link BEFORE INSERT OR UPDATE OF textile_color_id,source_snapshot ON public.items FOR EACH ROW EXECUTE FUNCTION public.sync_item_textile_link();

CREATE OR REPLACE FUNCTION public.save_shared_textile_color(p_stage text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE sid uuid;y public.textile_yarns;col public.textile_colors;old public.textile_colors;i public.items;
 label text;family text;name text;code text;yname text;fiber text;comp text;title text;ycode text;provider text;ids uuid[];scoped boolean;profile jsonb;previous jsonb;results jsonb='[]';
BEGIN
 IF public.user_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'Solo administradora puede guardar hilos y colores';END IF;
 IF p_stage NOT IN('production','preview') OR jsonb_typeof(p_data)<>'object' THEN RAISE EXCEPTION 'Revisa el color y el hilo';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('shared-textile:'||p_stage,0));
 name=trim(coalesce(p_data->>'name',''));code=trim(coalesce(p_data->>'code',''));family=coalesce(p_data->>'family','Sólidos');
 scoped=p_data ? 'item_ids';
 IF scoped THEN
  IF jsonb_typeof(p_data->'item_ids')<>'array' OR jsonb_array_length(p_data->'item_ids') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Selecciona las prendas que quieres modificar';END IF;
  SELECT array_agg(DISTINCT v::uuid) INTO ids FROM jsonb_array_elements_text(p_data->'item_ids') v;
  PERFORM id FROM items WHERE id=ANY(ids) ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM items WHERE id=ANY(ids) AND NOT archived AND deleted_at IS NULL AND location<>'Vendida')<>cardinality(ids) THEN RAISE EXCEPTION 'Una prenda ya no está disponible';END IF;
 END IF;
 IF name='' OR length(name)>250 OR length(code)>250 OR family NOT IN('Neutros','Sólidos','Melange') THEN RAISE EXCEPTION 'Completa el nombre del color y su familia';END IF;
 IF p_data->>'supplier_id'='__new' THEN
  label=trim(coalesce(p_data->>'supplier_name',''));IF label='' THEN RAISE EXCEPTION 'Ingresa el proveedor';END IF;
  SELECT s.id INTO sid FROM textile_suppliers s WHERE s.stage=p_stage AND s.active AND s.deleted_at IS NULL AND textile_key(s.name)=textile_key(label) ORDER BY s.id LIMIT 1;
  IF sid IS NULL THEN INSERT INTO textile_suppliers(stage,code,name,website,integration_status) VALUES(p_stage,'CUSTOM-'||gen_random_uuid(),label,'','Registro manual') RETURNING id INTO sid;END IF;
 ELSE sid=nullif(p_data->>'supplier_id','')::uuid;END IF;
 SELECT s.name INTO provider FROM textile_suppliers s WHERE s.id=sid AND s.stage=p_stage AND s.active AND s.deleted_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona un proveedor disponible';END IF;
 yname=trim(coalesce(p_data->>'yarn_name',''));fiber=trim(coalesce(p_data->>'fiber',''));comp=trim(coalesce(p_data->>'composition',''));title=trim(coalesce(p_data->>'title',''));ycode=trim(coalesce(p_data->>'yarn_code',''));
 IF yname='' OR length(yname)>250 OR length(comp)>500 THEN RAISE EXCEPTION 'Completa el nombre del hilo';END IF;
 SELECT * INTO y FROM textile_yarns t WHERE t.stage=p_stage AND t.supplier_id=sid AND t.active AND t.deleted_at IS NULL
 AND textile_key(t.name)=textile_key(yname) AND textile_key(t.composition)=textile_key(comp) AND textile_key(t.fiber)=textile_key(fiber) AND textile_key(t.title)=textile_key(title) ORDER BY t.id LIMIT 1;
 IF y.id IS NULL THEN INSERT INTO textile_yarns(stage,supplier_id,reference_key,name,code,fiber,composition,title,source_note) VALUES(p_stage,sid,'shared-yarn:'||gen_random_uuid(),yname,ycode,fiber,comp,title,'Hilo compartido entre inventario y Gestión textil') RETURNING * INTO y;END IF;
 -- El color pertenece al hilo comercial; el título técnico de cada prenda se conserva.
 SELECT c.* INTO col FROM textile_colors c JOIN textile_yarns t ON t.id=c.yarn_id
 WHERE c.stage=p_stage AND c.active AND c.deleted_at IS NULL AND t.active AND t.deleted_at IS NULL AND t.supplier_id=sid
 AND textile_key(t.name)=textile_key(yname) AND textile_key(t.composition)=textile_key(comp) AND textile_key(t.fiber)=textile_key(fiber)
 AND textile_key(c.name)=textile_key(name)
 AND CASE WHEN code<>'' THEN textile_color_code(c.code,provider)=textile_color_code(code,provider) ELSE c.code='' AND textile_key(c.name)=textile_key(name) END
 ORDER BY c.id LIMIT 1;
 IF nullif(p_data->>'color_id','') IS NOT NULL THEN
  SELECT * INTO old FROM textile_colors WHERE id=(p_data->>'color_id')::uuid AND stage=p_stage AND active AND deleted_at IS NULL;
  IF old.id IS NULL THEN RAISE EXCEPTION 'El color ya no está disponible';END IF;
 END IF;
 IF NOT scoped AND old.id IS NOT NULL AND col.id IS NOT NULL AND col.id<>old.id THEN RAISE EXCEPTION 'Este hilo y color ya existen. Selecciona la ficha registrada para evitar duplicados';END IF;
 IF NOT scoped AND old.id IS NOT NULL THEN
  UPDATE textile_colors SET name=save_shared_textile_color.name,code=save_shared_textile_color.code,yarn_id=y.id WHERE id=old.id RETURNING * INTO col;
 ELSIF col.id IS NULL THEN
  INSERT INTO textile_colors(stage,yarn_id,reference_key,name,code) VALUES(p_stage,y.id,'shared-color:'||gen_random_uuid(),name,code) RETURNING * INTO col;
 END IF;
 SELECT result INTO previous FROM textile_photo_sources WHERE stage=p_stage AND source_key='color-profile:'||col.id;
 profile=coalesce(previous,'{}')||jsonb_build_object('color_id',col.id,'family',CASE WHEN p_data->>'preserve_family'='true' THEN coalesce(previous->>'family',family) ELSE family END,'scope','catalog','alias_ids',jsonb_build_array(col.id),'bound_item_ids','[]'::jsonb,'updated_at',now(),'updated_by',auth.uid());
 INSERT INTO textile_photo_sources(stage,source_key,result) VALUES(p_stage,'color-profile:'||col.id,profile) ON CONFLICT(stage,source_key) DO UPDATE SET result=excluded.result,checked_at=now();
 IF scoped THEN
  FOR i IN SELECT * FROM items WHERE id=ANY(ids) LOOP
   UPDATE items SET color=col.name,color_code=col.code,textile_color_id=col.id,source_snapshot=(coalesce(source_snapshot,'{}')-'_textile_color_cleared')||jsonb_build_object('_textile_color_id',col.id),updated_at=now() WHERE id=i.id RETURNING * INTO i;
   results=results||jsonb_build_array(to_jsonb(i));
  END LOOP;
 END IF;
 RETURN jsonb_build_object('color_id',col.id,'yarn_id',col.yarn_id,'profiles',jsonb_build_array(profile),'items',results);
END $$;
REVOKE ALL ON FUNCTION public.save_shared_textile_color(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_shared_textile_color(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_shared_textile_duplicates() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE y public.textile_yarns;provider text;
BEGIN
 IF NOT NEW.active OR NEW.deleted_at IS NOT NULL THEN RETURN NEW;END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('shared-textile:'||NEW.stage,0));
 IF TG_TABLE_NAME='textile_yarns' THEN
  IF EXISTS(SELECT 1 FROM textile_yarns t WHERE t.id<>NEW.id AND t.stage=NEW.stage AND t.active AND t.deleted_at IS NULL AND t.supplier_id=NEW.supplier_id AND textile_key(t.name)=textile_key(NEW.name) AND textile_key(t.fiber)=textile_key(NEW.fiber) AND textile_key(t.composition)=textile_key(NEW.composition) AND textile_key(t.title)=textile_key(NEW.title)) THEN RAISE EXCEPTION 'Este hilo y título ya están registrados. Selecciona el hilo existente';END IF;
 ELSE
  SELECT * INTO y FROM textile_yarns WHERE id=NEW.yarn_id;
  SELECT name INTO provider FROM textile_suppliers WHERE id=y.supplier_id;
  IF EXISTS(SELECT 1 FROM textile_colors c JOIN textile_yarns t ON t.id=c.yarn_id WHERE c.id<>NEW.id AND c.stage=NEW.stage AND c.active AND c.deleted_at IS NULL AND t.supplier_id=y.supplier_id AND textile_key(t.name)=textile_key(y.name) AND textile_key(t.fiber)=textile_key(y.fiber) AND textile_key(t.composition)=textile_key(y.composition) AND textile_key(c.name)=textile_key(NEW.name) AND textile_color_code(c.code,provider)=textile_color_code(NEW.code,provider)) THEN RAISE EXCEPTION 'Este color ya está registrado para este hilo. Selecciona el color existente';END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shared_yarn_duplicates ON public.textile_yarns;
CREATE TRIGGER shared_yarn_duplicates BEFORE INSERT OR UPDATE ON public.textile_yarns FOR EACH ROW EXECUTE FUNCTION public.guard_shared_textile_duplicates();
DROP TRIGGER IF EXISTS shared_color_duplicates ON public.textile_colors;
CREATE TRIGGER shared_color_duplicates BEFORE INSERT OR UPDATE ON public.textile_colors FOR EACH ROW EXECUTE FUNCTION public.guard_shared_textile_duplicates();
COMMIT;
