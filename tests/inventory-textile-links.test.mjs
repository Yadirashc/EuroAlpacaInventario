import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {inventoryColorRecord} from '../src/inventory-color-photos.mjs';import {applyColorProfiles,garmentColorChoices} from '../src/color-profile.mjs';
import {normalizeTextileData} from '../src/textile-catalog.mjs';import {excelCell} from '../src/excel-view.mjs';
test('un hilo nuevo conserva proveedor y composición, y las prendas nuevas muestran su nombre en Excel',()=>{
 const data=normalizeTextileData({suppliers:[{id:'s',code:'OTHER',name:'Proveedor nuevo'}],yarns:[{id:'y',supplier_id:'s',name:'Cancas',fiber:'Mezcla especial',composition:'50% baby alpaca 50% algodón',reference_key:'shared-yarn:new'}],colors:[],photos:[]});
 assert.equal(data.yarns[0].supplier_id,'s');assert.equal(data.yarns[0].composition,'50% baby alpaca 50% algodón');assert.equal(excelCell({name:'Prenda nueva',source_snapshot:{_textile_color_id:'color'}},'NOMBRE'),'Prenda nueva');
});
test('inventario comparte un color y su foto, reutiliza hilos y aísla una edición sin tocar SKU ni cantidades',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;CREATE SCHEMA storage;CREATE TABLE storage.objects(bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
 for(const file of ['schema.sql','textile.sql','logistics.sql','record-management.sql','color-photos.sql','inventory-textile-links.sql'])await db.exec(fs.readFileSync('supabase/'+file,'utf8'));
 const admin='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',supplier='10000000-0000-0000-0000-000000000001',a='20000000-0000-0000-0000-000000000001',b='20000000-0000-0000-0000-000000000002';
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${admin}','admin@test.local'),('${viewer}','viewer@test.local');UPDATE profiles SET role='admin' WHERE id='${admin}';INSERT INTO textile_suppliers(id,stage,code,name,website) VALUES('${supplier}','production','ITESSA','ITESSA','');INSERT INTO items(id,sku,model_code,name,category,location,quantity,source_snapshot) VALUES('${a}','internal-a','BA22','Allin','Bufanda','Lima',2,'{"_model_sku":{"sku":"ACBA22"}}'),('${b}','internal-b','MU30','Munay','Chompa','España',3,'{}');SET ROLE authenticated;SET request.jwt.claim.sub='${admin}';`);
 const body={name:'Pan',code:'NU - 2617',family:'Sólidos',yarn_name:'Cancas',yarn_code:'NU',fiber:'Baby alpaca + algodón',composition:'15% baby alpaca · 85% algodón Tangüis',title:'2/28',supplier_id:supplier};
 const save=async(data)=> (await db.query('SELECT save_shared_textile_color($1,$2) result',['production',data])).rows[0].result;
 const first=await save(body),again=await save({...body,code:'2617',title:'18/2'});assert.equal(first.color_id,again.color_id);assert.equal((await db.query('SELECT count(*) n FROM textile_colors')).rows[0].n,1);
 await assert.rejects(db.query("INSERT INTO textile_colors(stage,yarn_id,reference_key,name,code) VALUES('production',$1,'duplicate','Pan','2617')",[first.yarn_id]),/ya está registrado/);
 await db.query('UPDATE items SET textile_color_id=$1 WHERE id=ANY($2::uuid[])',[first.color_id,[a,b]]);
 let items=(await db.query('SELECT * FROM items ORDER BY id')).rows;assert.equal(items[0].source_snapshot._textile_color_id,first.color_id);assert.equal(items[1].textile_color_id,first.color_id);
 await db.query("INSERT INTO textile_photos(stage,name,kind,color_id,yarn_id,visibility,rights_confirmed,storage_full,storage_thumb) VALUES('production','Pan','color',$1,$2,'team',true,'full','thumb')",[first.color_id,first.yarn_id]);
 const data=applyColorProfiles({suppliers:(await db.query('SELECT * FROM textile_suppliers')).rows,yarns:(await db.query('SELECT * FROM textile_yarns')).rows,colors:(await db.query('SELECT * FROM textile_colors')).rows,photos:(await db.query('SELECT * FROM textile_photos')).rows},[]);
 assert.equal(inventoryColorRecord(items[0],data).photo.id,inventoryColorRecord(items[1],data).photo.id);assert.equal(garmentColorChoices(data).length,1);
 const next=await save({...body,name:'Beige',code:'1348',color_id:first.color_id,item_ids:[a]});assert.notEqual(next.color_id,first.color_id);
 items=(await db.query('SELECT * FROM items ORDER BY id')).rows;assert.equal(items[0].textile_color_id,next.color_id);assert.equal(items[1].textile_color_id,first.color_id);assert.deepEqual(items.map(i=>i.quantity),[2,3]);assert.deepEqual(items.map(i=>i.sku),['internal-a','internal-b']);assert.equal(items[0].source_snapshot._model_sku.sku,'ACBA22');
 const count=(await db.query('SELECT count(*) n FROM textile_colors')).rows[0].n;await assert.rejects(save({...body,name:'Fallo',code:'999',item_ids:[crypto.randomUUID()]}),/disponible/);assert.equal((await db.query('SELECT count(*) n FROM textile_colors')).rows[0].n,count);
 await db.exec(`SET request.jwt.claim.sub='${viewer}'`);await assert.rejects(save(body),/administradora/);
 }finally{await db.close();}
});
