import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {distribution} from '../src/stock-control.mjs';
import {publicCatalog} from '../src/catalog.mjs';
test('Vendida permanece visible y no se suma a disponibilidad',()=>{
 const i={model_code:'AY',color:'Beige',size:'U'};
 const d=distribution(i,[{...i,location:'España',quantity:5},{...i,location:'Vendida',quantity:3}],[]);
 assert.equal(d.available,5);assert.equal(d.unverified,0);
 assert.equal(publicCatalog([{...i,name:'Ayni',category:'Bufanda',location:'Vendida',quantity:3,status:'DISPONIBLE',production_state:'TERMINADO'}])[0].variants[0].available,false);
});
test('PostgreSQL: dividir, acumular, vender, corregir y conservar variantes e historial',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 for(const f of ['schema','stock-control','stock-distribution','stock-distribution'])await db.exec(fs.readFileSync('supabase/'+f+'.sql','utf8'));
 const actor=crypto.randomUUID(),item=crypto.randomUUID(),black=crypto.randomUUID(),small=crypto.randomUUID();
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,'test@example.test']);await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[actor]);
 await db.query("INSERT INTO items(id,sku,model_code,name,category,color,size,location,quantity,source_snapshot) VALUES($1,'BEIGE','AY','Ayni','Bufanda','Beige','U','Lima',10,'{\"CANTIDAD\":10}'),($2,'NEGRO','AY','Ayni','Bufanda','Negro','U','Lima',10,'{}'),($3,'SMALL','AY','Ayni','Bufanda','Beige','S','Lima',10,'{}')",[item,black,small]);
 await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${actor}'`);
 const details={date:'2026-01-01',person:'Ana',responsible:'Yadira',notes:'Prueba'};
 const move=(id,q,dest='España',d=details)=>db.query('SELECT distribute_stock($1,$2,$3,$4,$5) AS id',[id,item,dest,q,d]);
 const mid=crypto.randomUUID();const to=(await move(mid,8)).rows[0].id;
 await move(mid,8);await assert.rejects(move(mid,7),/reutilizada/);
 const qty=async id=>(await db.query('SELECT quantity FROM items WHERE id=$1',[id])).rows[0].quantity;
 assert.equal(await qty(item),2);assert.equal(await qty(to),8);
 await assert.rejects(move(crypto.randomUUID(),3),/insuficientes/);
 await move(crypto.randomUUID(),1);assert.equal(await qty(item),1);assert.equal(await qty(to),9);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM items WHERE location='España'")).rows[0].n,1);
 const sale=crypto.randomUUID(),sd={...details,client:'Cliente',currency:'EUR'};
 const operate=(id,q,kind='venta',related=null)=>db.query('SELECT stock_operate($1,$2,$3,$4,$5,$6)',[id,to,kind,q,kind==='venta'?sd:{...details,reason:'Corrección documentada'},related]);
 await operate(sale,3);await operate(sale,3);
 let sold=(await db.query("SELECT * FROM items WHERE location='Vendida'")).rows[0];
 assert.equal(await qty(to),6);assert.equal(sold.quantity,3);assert.deepEqual(sold.source_snapshot,{CANTIDAD:10});
 await operate(crypto.randomUUID(),2);assert.equal(await qty(sold.id),5);
 await operate(crypto.randomUUID(),1,'reversion',sale);assert.equal(await qty(sold.id),4);assert.equal(await qty(to),5);
 await assert.rejects(operate(crypto.randomUUID(),9),/insuficientes/);
 assert.equal(await qty(black),10);assert.equal(await qty(small),10);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM stock_operations')).rows[0].n,5);
 const history=(await db.query('SELECT * FROM stock_operations WHERE id=$1',[sale])).rows[0];assert.equal(history.snapshot.location,'España');assert.equal(history.details.client,'Cliente');
 await assert.rejects(db.query('UPDATE items SET archived=true WHERE id=$1',[sold.id]),/historial/);
 await assert.rejects(db.query('SELECT distribute_stock($1,$2,$3,$4,$5)',[crypto.randomUUID(),item,'España',1,{...details,person:''}]),/persona/);
 await assert.rejects(db.query("UPDATE items SET location='España' WHERE id=$1",[item]),/Distribuir stock/);
 await assert.rejects(db.query("SELECT record_movement($1,'entrada',1,'Prueba')",[sold.id]),/historial/);
 await assert.rejects(db.query("SELECT distribute_stock($1,$2,'Lima',1,$3)",[crypto.randomUUID(),sold.id,details]),/disponible/);
 await assert.rejects(db.query('DELETE FROM stock_operations'));
 await move(crypto.randomUUID(),1,'Muestras / revisión');assert.equal(await qty(item),0);
 await db.exec('RESET ROLE');await db.query("UPDATE profiles SET role='consulta' WHERE id=$1",[actor]);await db.exec('SET ROLE authenticated');await assert.rejects(move(crypto.randomUUID(),1),/Sin permisos/);
 }finally{await db.close();}
});
test('migración conserva ventas previas, sus correcciones y su stock original',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 for(const f of ['schema','stock-control'])await db.exec(fs.readFileSync('supabase/'+f+'.sql','utf8'));
 const actor=crypto.randomUUID(),item=crypto.randomUUID(),sale=crypto.randomUUID();await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,'qa@example.test']);await db.query("UPDATE profiles SET role='admin' WHERE id=$1",[actor]);
 await db.query("INSERT INTO items(id,sku,model_code,name,category,location,quantity) VALUES($1,'HIST','AY','Ayni','Bufanda','España',8)",[item]);
 await db.exec(`SET request.jwt.claim.sub='${actor}'`);
 const details={date:'2026-01-01',person:'Ana',responsible:'Yadira',client:'Cliente histórico',currency:'EUR'};
 await db.query('SELECT stock_operate($1,$2,$3,3,$4,null)',[sale,item,'venta',details]);await db.query('SELECT stock_operate($1,$2,$3,1,$4,$5)',[crypto.randomUUID(),item,'reversion',{date:details.date,responsible:'Yadira',reason:'Corrección histórica'},sale]);
 const before=(await db.query('SELECT * FROM stock_operations ORDER BY id')).rows;
 for(let n=0;n<2;n++)await db.exec(fs.readFileSync('supabase/stock-distribution.sql','utf8'));
 assert.equal((await db.query('SELECT quantity FROM items WHERE id=$1',[item])).rows[0].quantity,6);
 assert.equal((await db.query("SELECT quantity FROM items WHERE location='Vendida'")).rows[0].quantity,2);
 assert.deepEqual((await db.query('SELECT * FROM stock_operations ORDER BY id')).rows,before);
 }finally{await db.close();}
});
