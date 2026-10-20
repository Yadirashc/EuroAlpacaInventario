import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {validateShipment,shipmentMatches,reportRows,traceItemIds} from '../src/logistics-domain.mjs';
const admin='00000000-0000-0000-0000-000000000001',operator='00000000-0000-0000-0000-000000000002',viewer='00000000-0000-0000-0000-000000000003',item='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002',client='20000000-0000-0000-0000-000000000001',ship='30000000-0000-0000-0000-000000000001',ship2='30000000-0000-0000-0000-000000000002';
const details={origin:'Lima',country:'España',city:'Madrid',address:'Calle de prueba 1',issued_on:'2026-01-01',estimated_on:'2026-02-03',prepared_by:'Ana',carrier:'Transportista',authorized_by:'Yadira'};
const materials=[{supplier:'ITESSA',material:'Alpaca',yarn:'Baby',composition:'100% Alpaca',lot:'MAT-01'},{supplier:'Michell',material:'Algodón',yarn:'Cotton',composition:'100% Algodón',lot:'MAT-02'}];
const line=(id,quantity,shipping_lot='Caja 1')=>({item_id:id,quantity,shipping_lot,production_lot:'PROD-01',materials});
test('el historial recorre recepciones sucesivas y traslados anteriores sin perder el origen',()=>{const first='40000000-0000-0000-0000-000000000001',second='40000000-0000-0000-0000-000000000002';const ids=traceItemIds(second,[{item_id:other,destination_item_id:first},{item_id:first,destination_item_id:second}],[{item_id:item,reference:other,kind:'traslado_salida'}]);assert.deepEqual([...ids].sort(),[item,other,first,second].sort());});
test('validación acumula filas repetidas, distingue lotes y conserva materiales y filtros',()=>{const i={id:item,name:'WAYRA',location:'Lima',quantity:3};const s={id:ship,client_id:client,code:'ENV-1',kind:'envio',details,status:'En tránsito',client_snapshot:{name:'Cliente'}};assert.throws(()=>validateShipment(s,[line(item,2),line(item,2)],[i]),/insuficientes/);assert.throws(()=>validateShipment(s,[{...line(item,1),materials:[]}],[i]),/proveedor/);assert.throws(()=>validateShipment(s,[line(item,1.5)],[i]),/entero/);validateShipment(s,[line(item,1),line(item,2)],[i]);const l={...line(item,2),shipment_id:ship,lot_id:'lot',lot_code:'LEN-0001',snapshot:{model_code:'AMCR09',name:'WAYRA',category:'FALDA',color:'BEIGE',size:'M'}};assert.ok(shipmentMatches(s,[l],null,{lot:'PROD-01',supplier:'michell',destination:'espana'}));assert.ok(!shipmentMatches(s,[l],null,{color:'rojo'}));const row=reportRows([s],[l],[{id:'lot',code:'LEN-0001',label:'Caja 1'}])[0];assert.equal(row['Lote de producción'],'PROD-01');assert.equal(row['Lote de envío'],'LEN-0001');assert.equal(row['Proveedor'],'ITESSA / Michell');assert.equal(row['Cantidad'],2);});

test('PostgreSQL logística: permisos, stock atómico, lotes, edición, recepción idempotente e historial',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;CREATE PUBLICATION supabase_realtime;`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));await db.exec(fs.readFileSync('supabase/logistics.sql','utf8'));await db.exec(fs.readFileSync('supabase/logistics.sql','utf8'));
 await db.exec(`CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text);ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;GRANT USAGE ON SCHEMA storage TO authenticated;GRANT SELECT,INSERT ON storage.objects TO authenticated;`);
 await db.exec(fs.readFileSync('supabase/logistics-storage.sql','utf8'));await db.exec(fs.readFileSync('supabase/logistics-storage.sql','utf8'));
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${admin}','admin@test.example'),('${operator}','op@test.example'),('${viewer}','view@test.example');UPDATE profiles SET role='admin',full_name='Yadira' WHERE id='${admin}';UPDATE profiles SET role='operadora',full_name='Ana' WHERE id='${operator}';INSERT INTO items(id,sku,model_code,name,category,material,composition,color,size,location,supplier,commercial_name,quantity) VALUES('${item}','TEST-FALDA','CR09','Conjunto WAYRA','FALDA','Alpaca','100% Alpaca','BEIGE','M','Lima','ITESSA','Baby',6),('${other}','TEST-BLUSA','CR09','Conjunto WAYRA','BLUSA','Alpaca','100% Alpaca','BEIGE','M','Lima','ITESSA','Baby',4);`);
 const as=async(id,fn)=>{await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${id}'`);try{return await fn();}finally{await db.exec('RESET ROLE;RESET request.jwt.claim.sub');}};
 const save=(id,ls,version=0)=>db.query('SELECT logistics_save_shipment($1,$2,$3,$4)',[id,{kind:'envio',client_id:client,details},ls,version]);
 const transition=(id,state,version,change={})=>db.query('SELECT logistics_transition($1,$2,$3,$4)',[id,state,version,change]);
 await db.exec('SET ROLE anon');await assert.rejects(db.query('SELECT * FROM logistics_clients'));await db.exec('RESET ROLE');
 await as(viewer,async()=>{await assert.rejects(db.query('SELECT logistics_save_client($1,$2,0)',[client,{name:'Client'}]),/Sin permisos/);await assert.rejects(save(ship,[line(item,1)]),/Sin permisos/);await assert.rejects(db.query("INSERT INTO logistics_events(shipment_id,actor,actor_name,action,status) VALUES($1,$2,'fake','fake','Entregado')",[ship,viewer]));});
 await as(operator,async()=>{
  await db.query('SELECT logistics_save_client($1,$2,0)',[client,{name:'Cliente Madrid',company:'Empresa',country:'España',city:'Madrid',address:'Dirección',email:'client@example.test'}]);
  await assert.rejects(save(ship,null),/entre 1 y 500/);
  await save(ship,[line(item,2),line(item,1,'Caja 2'),line(other,1)]);assert.equal((await db.query('SELECT count(*) AS n FROM logistics_lots')).rows[0].n,2);assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,6);
  const before=(await db.query('SELECT code FROM logistics_lots ORDER BY code')).rows;await save(ship,[line(item,2),line(item,1,'Caja 2'),line(other,1)],1);assert.deepEqual((await db.query('SELECT code FROM logistics_lots ORDER BY code')).rows,before);
  await assert.rejects(save(ship,[line(item,10)],2),/insuficientes/);assert.equal((await db.query('SELECT count(*) AS n FROM logistics_lines')).rows[0].n,3);
  await assert.rejects(save(ship,[line(item,1)],1),/cambió/);
  await save(ship2,[line(item,4)]); // both drafts may refer to the same stock; dispatch serializes actual deductions
  const doc='50000000-0000-0000-0000-000000000001';await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['logistics-private',ship+'/'+doc]);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);
  await db.query('SELECT logistics_register_document($1,$2,$3,$4,$5)',[doc,ship,'guia.pdf','application/pdf',1024]);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);
  await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['logistics-private',ship+'/invalid']));
  await transition(ship,'En preparación',2);await transition(ship,'Listo para despacho',3);
  await assert.rejects(transition(ship,'En tránsito',4,{departed_on:'2025-12-01'}),/fecha/);
  await db.exec(`RESET ROLE;UPDATE items SET quantity=0 WHERE id='${other}';SET ROLE authenticated`);
  await assert.rejects(transition(ship,'En tránsito',4,{departed_on:'2026-02-01'}),/Stock/);
  assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,6);assert.equal((await db.query('SELECT count(*) AS n FROM movements')).rows[0].n,0);
  await db.exec(`RESET ROLE;UPDATE items SET quantity=4 WHERE id='${other}';SET ROLE authenticated`);
  await transition(ship,'En tránsito',4,{departed_on:'2026-02-01'});await transition(ship,'En tránsito',4,{departed_on:'2026-02-01'});
  assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,3);assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[other])).rows[0].quantity,3);
  await assert.rejects(save(ship,[line(item,1)],5),/sin despachar/);await assert.rejects(transition(ship,'Cancelado',5,{notes:'Cancelar'}),/no permitido/);
  await transition(ship2,'En preparación',1);await transition(ship2,'Listo para despacho',2);await assert.rejects(transition(ship2,'En tránsito',3,{departed_on:'2026-02-01'}),/Stock/);assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,3);
  await transition(ship,'Entregado',5);assert.equal((await db.query("SELECT count(*) AS n FROM items WHERE location LIKE 'España%'")).rows[0].n,0);
  await assert.rejects(transition(ship,'Recepción confirmada',6,{received_on:'2026-01-01',received_by:'Ana'}),/llegada/);
  await transition(ship,'Recepción confirmada',6,{received_on:'2026-02-02',received_by:'Cliente Madrid'});await transition(ship,'Recepción confirmada',6,{received_on:'2026-02-02',received_by:'Cliente Madrid'});
  const received=(await db.query("SELECT category,sum(quantity)::int AS n FROM items WHERE location LIKE 'España%' GROUP BY category ORDER BY category")).rows;assert.deepEqual(received,[{category:'BLUSA',n:1},{category:'FALDA',n:3}]);
  assert.equal((await db.query('SELECT sum(quantity)::int AS n FROM items')).rows[0].n,10);assert.equal((await db.query('SELECT count(*) AS n FROM movements')).rows[0].n,5);
  assert.equal((await db.query('SELECT count(*) AS n FROM logistics_events WHERE shipment_id=$1',[ship])).rows[0].n,8);
  assert.ok((await db.query("SELECT actor_name FROM logistics_events WHERE shipment_id=$1",[ship])).rows.every(r=>r.actor_name==='Ana'));
  await assert.rejects(db.query("UPDATE logistics_shipments SET status='Pendiente' WHERE id=$1",[ship]));
  await transition(ship2,'Cancelado',3,{notes:'Sin existencias disponibles'});
 });
 await db.exec(`UPDATE profiles SET active=false WHERE id='${operator}'`);await as(operator,async()=>{assert.equal((await db.query('SELECT * FROM logistics_shipments')).rows.length,0);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,0);await assert.rejects(transition(ship,'Recepción confirmada',7),/Sin permisos/);});
 await as(viewer,async()=>{assert.equal((await db.query('SELECT * FROM logistics_shipments')).rows.length,2);assert.equal((await db.query('SELECT * FROM storage.objects')).rows.length,1);await assert.rejects(db.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['logistics-private',ship+'/50000000-0000-0000-0000-000000000002']));await assert.rejects(transition(ship,'Recepción confirmada',7),/Sin permisos/);});
 }finally{await db.close();}
});
