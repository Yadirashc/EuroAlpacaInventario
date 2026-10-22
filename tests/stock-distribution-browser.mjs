import {chromium} from 'playwright-core';
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite(),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;CREATE PUBLICATION supabase_realtime;`);
 for(const f of ['schema','stock-control','stock-distribution'])await db.exec(fs.readFileSync('supabase/'+f+'.sql','utf8'));
 const actor=crypto.randomUUID(),item=crypto.randomUUID();
 await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2)',[actor,'qa@example.test']);await db.query("UPDATE profiles SET role='admin',full_name='Yadira' WHERE id=$1",[actor]);
 await db.query("INSERT INTO items(id,sku,model_code,name,category,color,size,location,quantity,source_sheet_name,source_row) VALUES($1,'BEIGE','AY35','Ayni','Bufanda','Beige','U','Lima',10,'INVENTARIO - TALLER',1)",[item]);
 await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${actor}'`);
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config.js',r=>r.fulfill({body:'window.EURO_CONFIG={url:"https://qa.example.test",key:"test"};',contentType:'text/javascript'}));
 let calls=0;
 await page.route('https://qa.example.test/rest/v1/**',async route=>{
  const name=new URL(route.request().url()).pathname.split('/').pop();let result=[];
  try{
   if(['profiles','items','stock_operations','movements'].includes(name))result=(await db.query('SELECT * FROM '+name+' ORDER BY '+('id'))).rows;
   else if(name==='distribute_stock'){calls++;const v=route.request().postDataJSON();await db.query('SELECT distribute_stock($1,$2,$3,$4,$5)',[v.p_id,v.p_item,v.p_destination,v.p_quantity,v.p_details]);result=null;}
   else if(name==='stock_operate'){calls++;const v=route.request().postDataJSON();await db.query('SELECT stock_operate($1,$2,$3,$4,$5,$6)',[v.p_id,v.p_item,v.p_kind,v.p_quantity,v.p_details,v.p_related]);result=null;}
   await route.fulfill({json:result});
  }catch(e){await route.fulfill({status:400,json:{message:e.message}});}
 });
 await page.addInitScript(actor=>sessionStorage.setItem('ea-session',JSON.stringify({user:{id:actor},access_token:'qa',expires_at:Date.now()+3600000})),actor);
 await page.goto('http://127.0.0.1:4173');await page.locator('nav [data-tab=inventory]').click();await page.locator('#view-summary').click();
 assert.ok((await page.locator('[data-filter=location] option').allTextContents()).includes('Vendida'));
 const open=async location=>{await page.locator('[data-filter=location]').selectOption(location);await page.locator('[data-detail]').first().click();};
 await open('Lima');await page.locator('#edit').click();await page.getByRole('button',{name:'Distribuir stock',exact:true}).click();
 await page.locator('dialog [name=destination]').selectOption('España');await page.locator('dialog [name=quantity]').fill('8');await page.locator('dialog [name=person]').fill('Ana');await page.locator('dialog button[type=submit]').dblclick();await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(calls,1);
 const stock=async location=>(await db.query('SELECT quantity FROM items WHERE location=$1',[location])).rows[0].quantity;
 assert.equal(await stock('Lima'),2);assert.equal(await stock('España'),8);
 await open('España');await page.locator('#edit-quantity').click();await page.getByRole('button',{name:'Distribuir stock',exact:true}).click();await page.locator('dialog [name=destination]').selectOption('Vendida');
 assert.ok(await page.locator('dialog [name=client]').isVisible());await page.locator('dialog [name=quantity]').fill('3');await page.locator('dialog [name=person]').fill('María');await page.locator('dialog [name=client]').fill('Cliente Madrid');await page.locator('dialog [name=notes]').fill('Entrega en tienda');await page.locator('dialog button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));
 assert.equal(await stock('España'),5);assert.equal(await stock('Vendida'),3);
 await page.locator('[data-filter=location]').selectOption('Vendida');assert.match(await page.locator('tbody').innerText(),/Vendida · No disponible/);
 await page.locator('[data-detail]').first().click();assert.equal(await page.locator('[data-stock-kind=venta]').count(),0);await page.locator('[data-stock-history]').click();assert.match(await page.locator('dialog').innerText(),/Cliente Madrid/);assert.match(await page.locator('dialog').innerText(),/España/);assert.match(await page.locator('dialog').innerText(),/María/);
 await page.reload();await page.locator('nav [data-tab=inventory]').click();await page.locator('#view-summary').click();await page.locator('[data-filter=location]').selectOption('Vendida');assert.match(await page.locator('tbody').innerText(),/Vendida · No disponible/);
 await page.locator('[data-tab=overview]').click();assert.equal(await page.locator('.stat').first().locator('strong').innerText(),'7');
 await page.locator('nav [data-tab=inventory]').click();await page.locator('[data-filter=location]').selectOption('España');await page.locator('[data-detail]').first().click();await page.locator('[data-stock-transfer]').click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'data/qa/stock-distribution-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Interfaz + PostgreSQL: traslado 10→2/8, venta 8→5/3, doble clic, filtros, historial, recarga, total disponible y móvil OK.');
}finally{await browser.close();await db.close();}
