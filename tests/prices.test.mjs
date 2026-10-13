import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePrice,formatPrice} from '../src/prices.mjs';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('precios preservan valores desconocidos y centavos sin aceptar importes inválidos',()=>{
 assert.equal(parsePrice(''),null);assert.equal(parsePrice(null),null);
 assert.equal(parsePrice('159,90'),159.90);assert.equal(parsePrice('159.95'),159.95);
 for(const value of ['0','-20','1.001','1e3','NaN','100000000'])assert.throws(()=>parsePrice(value));
 assert.equal(formatPrice({sale_price:null}),'Por confirmar');
 assert.match(formatPrice({sale_price:159.9,price_currency:'PEN'}),/159\.90/);
 assert.match(formatPrice({sale_price:100,price_currency:'USD'}),/100\.00/);
});
test('solo administradora edita precios y el cambio conserva stock y registra auditoría',async()=>{
 const db=new PGlite();try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
 const admin='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002';
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${admin}','admin@example.test'),('${viewer}','viewer@example.test');UPDATE profiles SET role='admin' WHERE id='${admin}';INSERT INTO items(sku,model_code,name,category,location,quantity) VALUES('QA','QA','QA','Prenda','Lima',7);SET ROLE authenticated;SET request.jwt.claim.sub='${admin}';UPDATE items SET sale_price=159.90,price_currency='PEN' WHERE sku='QA';`);
 const row=(await db.query("SELECT sale_price,quantity,price_updated_at FROM items WHERE sku='QA'")).rows[0];assert.equal(Number(row.sale_price),159.9);assert.equal(row.quantity,7);assert.ok(row.price_updated_at);
 assert.equal((await db.query("SELECT count(*) n FROM audit_log WHERE operation='UPDATE'")).rows[0].n,1);
 await assert.rejects(db.exec("UPDATE items SET sale_price=-1 WHERE sku='QA'"));
 await db.exec(`SET request.jwt.claim.sub='${viewer}';UPDATE items SET sale_price=50 WHERE sku='QA';`);
 assert.equal(Number((await db.query("SELECT sale_price FROM items WHERE sku='QA'")).rows[0].sale_price),159.9);
 }finally{await db.close();}
});
