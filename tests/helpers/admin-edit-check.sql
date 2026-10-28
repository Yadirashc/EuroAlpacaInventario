BEGIN;
SELECT set_config('request.jwt.claim.sub',(SELECT id::text FROM public.profiles WHERE role='admin' AND active ORDER BY id LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $check$
<<verification>>
DECLARE
 item_id uuid=gen_random_uuid(); supplier_id uuid=gen_random_uuid(); yarn_id uuid=gen_random_uuid(); color_id uuid=gen_random_uuid(); photo_id uuid=gen_random_uuid();
 color_batch uuid; yarn_batch uuid; snapshot jsonb;
BEGIN
 IF current_user<>'authenticated' OR public.user_role()<>'admin' THEN RAISE EXCEPTION 'La prueba requiere una sesión de administradora'; END IF;
 INSERT INTO public.items(id,sku,model_code,name,category,location,quantity,source_snapshot)
 VALUES(item_id,'QA-PERMISSION-'||item_id,'QA99','Verificación reversible','Bufanda','Lima',0,'{"COLOR":"Original"}');
 UPDATE public.items SET name='Ficha corregida',category='Chal',description='Prueba reversible',material='Baby alpaca',commercial_name='MUHU',composition='100% baby alpaca',material_code='BA',color='Granate',color_code='9000',size='M',supplier='INCA TOPS',production_lot='QA',status='DISPONIBLE',production_state='TERMINADO',inventory_type='Muestra',threads='2',yarn_title='2/28',gender='Unisex',weight='100',production_weight='100',min_stock=2,sale_price=1,price_currency='PEN',notes='Prueba reversible',review_required=false,source_snapshot=jsonb_build_object('COLOR','Original','_textile_color_id',color_id)
 WHERE id=item_id;
 SELECT source_snapshot INTO snapshot FROM public.items WHERE id=item_id;
 IF snapshot->>'_textile_color_id' IS DISTINCT FROM color_id::text OR snapshot->>'COLOR'<>'Original' THEN RAISE EXCEPTION 'Falló el guardado de la referencia del color'; END IF;
 PERFORM public.apply_quantity_edits(jsonb_build_array(jsonb_build_object('id',item_id,'before',0,'after',2)),'Verificación reversible de permisos',gen_random_uuid());
 IF (SELECT quantity FROM public.items WHERE id=item_id)<>2 THEN RAISE EXCEPTION 'Falló la edición de cantidades'; END IF;
 INSERT INTO public.textile_suppliers(id,stage,code,name,website) VALUES(supplier_id,'production','QA-'||supplier_id,'Proveedor de prueba','https://example.test');
 INSERT INTO public.textile_yarns(id,stage,supplier_id,reference_key,name) VALUES(yarn_id,'production',supplier_id,'QA-'||yarn_id,'Hilo de prueba');
 UPDATE public.textile_yarns SET name='Hilo corregido',code='QA',fiber='Baby alpaca',composition='100% Baby alpaca',title='2/28' WHERE id=yarn_id;
 INSERT INTO public.textile_colors(id,stage,yarn_id,reference_key,name) VALUES(color_id,'production',yarn_id,'QA-'||color_id,'Color de prueba');
 UPDATE public.textile_colors SET name='Granate',code='9000' WHERE id=color_id;
 INSERT INTO public.textile_stock(stage,color_id,stock_kg,notes) VALUES('production',color_id,0,'Conteo reversible');
 UPDATE public.textile_stock SET notes='Conteo editado' WHERE textile_stock.color_id=verification.color_id AND stage='production';
 INSERT INTO public.textile_photos(id,stage,name,kind,model_code,visibility,rights_confirmed) VALUES(photo_id,'production','Foto de prueba','referencia','QA99','admin',true);
 UPDATE public.textile_photos SET name='Foto corregida',visibility='team' WHERE id=photo_id;
 color_batch=public.manage_records('textile_colors',ARRAY[color_id::text],'Verificación reversible de permisos','production');
 yarn_batch=public.manage_records('textile_yarns',ARRAY[yarn_id::text],'Verificación reversible de permisos','production');
 PERFORM public.restore_records(yarn_batch);PERFORM public.restore_records(color_batch);
END;
$check$;
ROLLBACK;
SELECT 'Ficha, referencia de color, cantidades, hilos, colores, stock, fotografías, eliminación y restauración: correctos; prueba revertida' AS verification;
