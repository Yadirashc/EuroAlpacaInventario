import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import sharp from 'sharp';

const base={name:'Modelo QA',model_code:'QA01',category:'Bufanda',supplier:'ITESSA',commercial_name:'Baby Alpaca',material:'Baby alpaca',composition:'100% Baby Alpaca',yarn_title:'2/28',color:'Rojo',color_code:'BA - 201',size:'M',location:'Lima',quantity:3,min_stock:2,source_sheet_name:'INVENTARIO - TALLER',source_snapshot:{NOMBRE:'Modelo QA',COLOR:'Rojo'}};
const items=['a','b','c'].map((id,i)=>({...base,id,name:id==='c'?'Modelo dos':'Modelo uno',model_code:id==='c'?'QA02':'QA01',color:id==='b'?'Azul':id==='c'?'Beige':'Rojo',color_code:id==='b'?'202':id==='c'?'203':'201',sku:'QA-'+id,source_row:i+2,quantity:i+1,source_snapshot:{...base.source_snapshot,origin:id}}));
const root=path.resolve('dist'),server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(name==='/config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.EURO_CONFIG={url:"",key:"",local:true,textile:true,textilePreview:true}');}
 const file=path.join(root,name==='/'?'index.html':name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/local/login',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/local/inventory',r=>r.fulfill({json:{profile:{id:'qa',role:'admin',full_name:'QA'},items}}));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('[name=email]').fill('qa@example.test');await page.locator('[name=password]').fill('qa-local');await page.locator('#login-form button').click();
 await page.locator('nav [data-tab=inventory]').click();await page.locator('#view-summary').click();
 const row=name=>page.locator('.inventory-panel tbody tr').filter({hasText:name}).first();
 const upload=async(name,color,format='png')=>{
  await row(name).locator('[data-inventory-model-photo]').click();
  await page.locator('dialog [name=file]').setInputFiles({name:'modelo.'+format,mimeType:'image/'+format,buffer:await sharp({create:{width:20,height:20,channels:3,background:color}})[format]().toBuffer()});
  await page.locator('#textile-photo-form button[type=submit]').click();await page.locator('dialog').waitFor({state:'hidden'});
 };
 await upload('Modelo dos','#11aa33');
 const otherID=await row('Modelo dos').locator('[data-private-photo]').getAttribute('data-private-photo'),otherURL=await row('Modelo dos').locator('[data-private-photo]').getAttribute('src');
 await upload('Modelo uno','#dd1144');
 await row('Modelo uno').locator('img.ready').waitFor();
 const originalID=await row('Modelo uno').locator('[data-private-photo]').getAttribute('data-private-photo'),originalURL=await row('Modelo uno').locator('[data-private-photo]').getAttribute('src');
 await upload('Modelo uno','#1144dd','webp');await row('Modelo uno').locator('img.ready').waitFor();
 assert.equal(await row('Modelo uno').locator('[data-private-photo]').getAttribute('data-private-photo'),originalID);
 assert.notEqual(await row('Modelo uno').locator('[data-private-photo]').getAttribute('src'),originalURL);
 assert.equal(await row('Modelo dos').locator('[data-private-photo]').getAttribute('data-private-photo'),otherID);assert.equal(await row('Modelo dos').locator('[data-private-photo]').getAttribute('src'),otherURL);
 await page.locator('#view-excel').click();assert.ok(await page.locator('.excel-table [data-inventory-model-photo]').count()>0);
 await page.locator('.excel-table [data-inventory-color-items]').first().click();assert.equal(await page.locator('#color-profile-form [name=target_item_id]:checked').count(),1);await page.locator('dialog .close').click();
 await page.locator('#view-summary').click();await row('Modelo uno').locator('.product-link').click();await page.locator('[data-edit-inventory-color]').click();await page.locator('#color-profile-form [name=code]').fill('2222');await page.locator('#color-profile-form button[type=submit]').first().click();await page.locator('dialog').waitFor({state:'hidden'});
 const quantities=await page.locator('.inventory-panel tbody tr .quantity').allTextContents();
 await page.locator('nav [data-tab=textile]').click();await page.locator('[data-open-textile-deletion]').click();
 assert.match(await page.locator('h1').innerText(),/Eliminar hilos y colores/);
 await page.locator('[data-textile-delete-kind=yarns]').click();assert.ok(await page.locator('[data-textile-delete-one]:disabled').count()>0);
 await page.locator('[data-textile-delete-kind=colors]').click();const colors=await page.locator('[data-textile-delete-check]').count();assert.ok(colors>=3);
 await page.locator('#textile-delete-search').fill('2222');assert.equal(await page.locator('[data-textile-delete-check]').count(),1);await page.locator('[data-textile-delete-check]').check();await page.locator('#textile-delete-search').fill('');assert.match(await page.locator('#textile-delete-selected').innerText(),/\(0\)/);
 await page.locator('#textile-delete-all').check();await page.locator('#textile-delete-selected').click();assert.match(await page.locator('dialog').innerText(),new RegExp(colors+' registro'));await page.locator('#record-cancel').click();assert.equal(await page.locator('[data-textile-delete-check]').count(),colors);
 await page.locator('#textile-delete-selected').click();await page.locator('[data-record-confirm]').click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('[data-textile-delete-check]').count(),0);
 await page.locator('[data-textile-delete-kind=yarns]').click();assert.ok(await page.locator('[data-textile-delete-one]:enabled').count()>0);await page.locator('#textile-delete-all').check();await page.locator('#textile-delete-selected').click();await page.locator('[data-record-confirm]').click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('[data-textile-delete-check]').count(),0);
 await page.locator('nav [data-tab=inventory]').click();assert.deepEqual(await page.locator('.inventory-panel tbody tr .quantity').allTextContents(),quantities);assert.equal(await row('Modelo dos').locator('[data-private-photo]').getAttribute('data-private-photo'),otherID);
 await page.locator('nav [data-tab=textile]').click();if(await page.locator('[data-open-textile-deletion]').count())await page.locator('[data-open-textile-deletion]').click();await page.locator('[data-textile-delete-trash]').click();assert.equal(await page.locator('[data-record-restore]').count(),2);await page.locator('[data-record-restore]').first().click();await page.locator('[data-record-restore]').first().click();assert.equal(await page.locator('[data-record-restore]').count(),0);
 await page.locator('nav [data-tab=textile]').click();if(await page.locator('[data-open-textile-deletion]').count())await page.locator('[data-open-textile-deletion]').click();await page.locator('[data-textile-delete-kind=colors]').click();assert.equal(await page.locator('[data-textile-delete-check]').count(),colors);
 fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/textile-delete-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'data/qa/textile-delete-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: edición de color y reemplazo de foto desde Inventario; selección, cancelación, eliminación y restauración de colores/hilos; cantidades y otras fotos conservadas.');
}finally{await browser.close();server.close();}
