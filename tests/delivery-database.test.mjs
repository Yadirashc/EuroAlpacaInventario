import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {saveDeliveryBatch} from '../server/delivery-batches.mjs';

test('lotes con PostgreSQL real: entrega, traslado, destino existente, reintentos y conservación',async()=>{
 const sql=new PGlite();
 try{
  await sql.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
   CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
   CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; CREATE PUBLICATION supabase_realtime;
   CREATE SCHEMA storage; CREATE TABLE storage.objects(bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`);
  for(const file of ['schema','textile','logistics','stock-control','stock-distribution','record-management'])await sql.exec(fs.readFileSync('supabase/'+file+'.sql','utf8'));
  const admin=randomUUID(),source=randomUUID(),destination=randomUUID();
  await sql.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[admin,'batches@example.test']);
  await sql.query("UPDATE profiles SET role='admin' WHERE id=$1",[admin]);
  await sql.exec(`SET request.jwt.claim.sub='${admin}'`);
  const base={model_code:'QA',name:'Bufanda',category:'Bufanda',material:'Baby alpaca',composition:'100% Baby alpaca',color:'Rojo',color_code:'8080',size:'M',supplier:'INCA TOPS',commercial_name:'MUHU',material_code:'BA',yarn_title:'2/28',production_lot:'P1'};
  async function insert(table,body){const keys=Object.keys(body);return (await sql.query(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`,Object.values(body))).rows;}
  await insert('items',{...base,id:source,sku:'SRC',location:'Lima',quantity:10});
  await insert('items',{...base,id:destination,sku:'DST',location:'España',quantity:3});
  const db=async(path,{method='GET',body}={})=>{
   const [table,query='']=path.split('?');const params=new URLSearchParams(query);
   if(table.startsWith('rpc/')){const keys=Object.keys(body);return (await sql.query(`SELECT ${table.slice(4)}(${keys.map((k,i)=>k+'=> $'+(i+1)).join(',')})`,Object.values(body))).rows;}
   if(method==='POST'){const rows=[];for(const row of Array.isArray(body)?body:[body])rows.push(...await insert(table,row));return rows;}
   const values=[],conditions=[];
   for(const [key,value]of params){
    if(['select','limit','order'].includes(key))continue;
    const column=key.includes('->>')?key.split('->>')[0]+"->>'"+key.split('->>')[1]+"'":key;
    if(value==='is.null')conditions.push(column+' IS NULL');
    else if(value.startsWith('eq.')){values.push(value.slice(3));conditions.push(column+'=$'+values.length);}
    else if(value.startsWith('in.(')){const list=value.slice(4,-1).split(',');conditions.push(column+' IN ('+list.map(v=>{values.push(v);return '$'+values.length;}).join(',')+')');}
    else throw Error('Filtro no implementado: '+value);
   }
   const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
   if(method==='PATCH'){const keys=Object.keys(body),set=keys.map(k=>{values.push(body[k]);return k+'=$'+values.length;});return (await sql.query(`UPDATE ${table} SET ${set.join(',')}${where} RETURNING *`,values)).rows;}
   const order=params.get('order');return (await sql.query('SELECT * FROM '+table+where+(order?' ORDER BY '+order:''),values)).rows;
  };
  const context={db,profile:{id:admin,role:'admin',full_name:'QA'}},date=new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
  const batch={id:randomUUID(),kind:'traslado',details:{number:'TRA-QA',date,origin:'Lima',destination:'España',responsible:'QA'},lines:[{item_id:source,quantity:2}]};
  await saveDeliveryBatch(context,batch);
  let rows=(await sql.query('SELECT * FROM items ORDER BY id')).rows;
  assert.equal(rows.find(i=>i.id===source).quantity,8);assert.equal(rows.find(i=>i.id===destination).quantity,5);assert.equal(rows.length,2);
  await saveDeliveryBatch(context,batch);assert.equal((await sql.query('SELECT sum(quantity) total FROM items')).rows[0].total,13);
  const fresh={...batch,id:randomUUID(),details:{...batch.details,number:'TRA-NUEVO',destination:'Cusco'}};
  await saveDeliveryBatch(context,fresh);assert.equal((await sql.query("SELECT quantity FROM items WHERE location='Cusco'")).rows[0].quantity,2);
  const delivery={...batch,id:randomUUID(),kind:'entrega',details:{...batch.details,number:'ENT-QA',recipient:'Ana',company:'Marca'}};
  await saveDeliveryBatch(context,delivery);await saveDeliveryBatch(context,{batch_id:delivery.id,resume:true});
  assert.equal((await sql.query('SELECT quantity FROM items WHERE id=$1',[source])).rows[0].quantity,4);
  assert.equal((await sql.query('SELECT count(*) total FROM stock_operations')).rows[0].total,1);
  assert.equal((await sql.query('SELECT sum(quantity) total FROM items')).rows[0].total,11);
 }finally{await sql.close();}
});
