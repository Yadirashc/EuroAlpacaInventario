import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {distribution} from '../src/stock-control.mjs';
test('distribución separa color, talla, ubicación, custodia, ventas y tránsito',()=>{
 const base={model_code:'RAAY35',category:'Bufanda',material:'Alpaca',composition:'100%',color:'Beige',size:'U'};
 const items=[{...base,location:'Lima',quantity:2},{...base,location:'España',quantity:5},{...base,color:'Negro',location:'Lima',quantity:30}];
 const d=distribution(base,items,[{kind:'venta',quantity:3,snapshot:base},{kind:'entrega',quantity:2,snapshot:base},{kind:'devolucion',quantity:1,snapshot:base}],{lines:[{snapshot:base,shipment_id:'s',quantity:4}],shipments:[{id:'s',status:'En tránsito'}]});
 assert.equal(d.available,7);assert.equal(d.sold,3);assert.equal(d.custody,1);assert.equal(d.transit,4);assert.equal(d.production,null);
});
test('PostgreSQL ventas y custodia: atomicidad, reintentos, devoluciones parciales, permisos y auditoría',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));await db.exec(fs.readFileSync('supabase/stock-control.sql','utf8'));await db.exec(fs.readFileSync('supabase/stock-control.sql','utf8'));
 const actor=crypto.randomUUID(),item=crypto.randomUUID(),black=crypto.randomUUID();await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,'test@example.test']);await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[actor]);
 await db.query("INSERT INTO items(id,sku,model_code,name,category,color,size,location,quantity) VALUES($1,'BEIGE','RAAY35','Ayni','Bufanda','Beige','U','España',8),($2,'NEGRO','RAAY35','Ayni','Bufanda','Negro','U','España',8)",[item,black]);
 await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${actor}'`);
 const date='2026-01-01',details={date,responsible:'Yadira',person:'Ana',client:'Cliente',price:'10',currency:'EUR',total:'30.00'};
 const operate=(id,kind,q,d=details,related=null)=>db.query('SELECT stock_operate($1,$2,$3,$4,$5,$6)',[id,item,kind,q,d,related]);
 const sale=crypto.randomUUID();await operate(sale,'venta',3);await operate(sale,'venta',3);await assert.rejects(operate(sale,'venta',4),/reutilizada/);await assert.rejects(operate(crypto.randomUUID(),'venta',9,{...details,total:'90.00'}),/insuficientes/);
 assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,5);assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[black])).rows[0].quantity,8);
 const delivery=crypto.randomUUID();await operate(delivery,'entrega',2,{date,responsible:'Yadira',person:'Ana',reason:'préstamo',destination:'Exhibición'});
 const returned=crypto.randomUUID();await operate(returned,'devolucion',1,{date,responsible:'Yadira'},delivery);await operate(returned,'devolucion',1,{date,responsible:'Yadira'},delivery);await assert.rejects(operate(crypto.randomUUID(),'devolucion',2,{date,responsible:'Yadira'},delivery),/devolución/);
 assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,4);
 await operate(crypto.randomUUID(),'conteo_produccion',10,{date,responsible:'Yadira',reason:'Conteo documentado'});assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,4);
 const correction=crypto.randomUUID();await operate(correction,'reversion',1,{date,responsible:'Yadira',reason:'Corrección documentada'},sale);await operate(correction,'reversion',1,{date,responsible:'Yadira',reason:'Corrección documentada'},sale);
 await assert.rejects(operate(crypto.randomUUID(),'reversion',3,{date,responsible:'Yadira',reason:'Corrección documentada'},sale),/corrección/);
 assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,5);
 await assert.rejects(db.query('DELETE FROM stock_operations'));await assert.rejects(db.query("UPDATE stock_operations SET quantity=1"));assert.equal((await db.query('SELECT count(*)::int AS n FROM movements')).rows[0].n,4);
 await db.exec('RESET ROLE');await db.query("UPDATE profiles SET role='consulta' WHERE id=$1",[actor]);await db.exec('SET ROLE authenticated');await assert.rejects(operate(crypto.randomUUID(),'venta',3),/Sin permisos/);
 }finally{await db.close();}
});
