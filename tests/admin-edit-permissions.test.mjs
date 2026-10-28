import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('administración guarda la referencia de color; consulta y operadora conservan solo sus permisos',async()=>{
 const db=new PGlite();try{
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
  await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
  await db.exec('REVOKE UPDATE(source_snapshot) ON public.items FROM authenticated');
  const admin='00000000-0000-0000-0000-000000000001',viewer='00000000-0000-0000-0000-000000000002',operator='00000000-0000-0000-0000-000000000003',item='10000000-0000-0000-0000-000000000001';
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${admin}','admin@example.test'),('${viewer}','viewer@example.test'),('${operator}','operator@example.test');UPDATE profiles SET role='admin' WHERE id='${admin}';UPDATE profiles SET role='operadora' WHERE id='${operator}';INSERT INTO items(id,sku,model_code,name,category,location,quantity,source_snapshot) VALUES('${item}','QA','QA01','Prenda','Bufanda','Lima',7,'{"COLOR":"Original"}');`);
  const as=async(id,fn)=>{await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${id}';`);try{return await fn();}finally{await db.exec('RESET ROLE;RESET request.jwt.claim.sub;');}};
  await as(admin,async()=>{await assert.rejects(db.query('UPDATE items SET source_snapshot=$1 WHERE id=$2',[{_textile_color_id:'test'},item]),/permission denied/);});
  for(let i=0;i<2;i++)await db.exec(fs.readFileSync('supabase/admin-edit-permissions.sql','utf8'));
  await as(admin,async()=>{
   const rows=await db.query('UPDATE items SET name=$1,color=$2,color_code=$3,source_snapshot=$4 WHERE id=$5 RETURNING *',['Prenda corregida','Granate','9000',{COLOR:'Original',_textile_color_id:'selected-color'},item]);
   assert.equal(rows.rows.length,1);assert.equal(rows.rows[0].source_snapshot.COLOR,'Original');assert.equal(rows.rows[0].source_snapshot._textile_color_id,'selected-color');assert.equal(rows.rows[0].quantity,7);
   await assert.rejects(db.query('UPDATE items SET quantity=100 WHERE id=$1',[item]),/permission denied/);
  });
  for(const actor of [viewer,operator])await as(actor,async()=>{const result=await db.query('UPDATE items SET name=$1,source_snapshot=$2 WHERE id=$3 RETURNING id',['Sin permiso',{},item]);assert.equal(result.rows.length,0);});
  const row=(await db.query('SELECT * FROM items WHERE id=$1',[item])).rows[0];assert.equal(row.name,'Prenda corregida');assert.equal(row.quantity,7);
 }finally{await db.close();}
});
