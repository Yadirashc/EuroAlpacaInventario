import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';

const base={name:'Modelo QA',model_code:'QA01',category:'Bufanda',supplier:'ITESSA',commercial_name:'Baby Alpaca',material:'Baby alpaca',composition:'100% Baby Alpaca',yarn_title:'2/28',color:'Rojo',color_code:'BA - 201',size:'M',location:'Lima',quantity:3,min_stock:2,source_sheet_name:'INVENTARIO - TALLER',source_snapshot:{NOMBRE:'Modelo QA',COLOR:'Rojo'}};
const items=['a','b','c'].map((id,i)=>({...base,id,sku:'QA-'+id,source_row:i+2,quantity:i+1,source_snapshot:{...base.source_snapshot,origin:id}}));
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
 const open=ids=>page.locator('[data-inventory-color-items="'+ids+'"]').click();
 const close=()=>page.locator('dialog .close').click();
 const save=async()=>{await page.locator('#color-profile-form button[type=submit]').first().click();await page.locator('dialog').waitFor({state:'hidden'});};
 await open('a,b,c');assert.equal(await page.locator('[name=target_item_id]').count(),3);assert.equal(await page.locator('[name=target_item_id]:checked').count(),1);assert.equal(await page.locator('[name=target_item_id]:checked').inputValue(),'a');
 await close();await page.locator('nav [data-tab=textile]').click();await page.locator('#textile-search').fill('BA - 201');await page.locator('[data-unified-edit]').first().click();
 assert.equal(await page.locator('[name=target_item_id]').count(),3);assert.equal(await page.locator('[name=target_item_id]:checked').count(),1);
 await page.locator('[name=supplier_id]').selectOption({label:'INCA TOPS'});await save();
 await page.locator('nav [data-tab=inventory]').click();
 await open('a');assert.equal(await page.locator('[name=code]').inputValue(),'BA - 201');assert.equal(await page.locator('[name=supplier_id] option:checked').innerText(),'INCA TOPS');await page.locator('[name=code]').fill('9001');await save();
 await open('b,c');assert.equal(await page.locator('[name=code]').inputValue(),'BA - 201');assert.equal(await page.locator('[name=supplier_id] option:checked').innerText(),'ITESSA');assert.equal(await page.locator('[name=target_item_id]:checked').inputValue(),'b');await page.locator('[name=code]').fill('8000');await save();
 await open('c');assert.equal(await page.locator('[name=code]').inputValue(),'BA - 201');assert.equal(await page.locator('[name=supplier_id] option:checked').innerText(),'ITESSA');await close();
 await open('a');assert.equal(await page.locator('[name=code]').inputValue(),'9001');assert.equal(await page.locator('[name=supplier_id] option:checked').innerText(),'INCA TOPS');await close();
 await open('b');assert.equal(await page.locator('[name=code]').inputValue(),'8000');await close();
 assert.equal(await page.locator('.inventory-panel tbody tr').count(),3);
 const quantities=await page.locator('.inventory-panel tbody tr').allTextContents();for(const n of [1,2,3])assert.ok(quantities.some(row=>row.includes(String(n))));
 fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/color-isolation.png',fullPage:true});
 await open('a');await page.locator('#clear-item-color').click();await page.locator('[data-record-confirm]').click();await page.locator('dialog').waitFor({state:'hidden'});
 assert.equal(await page.locator('[data-inventory-color-items="a"]').innerText(),'Color sin registrar');
 await open('b');assert.equal(await page.locator('[name=code]').inputValue(),'8000');await close();
 assert.deepEqual(errors,[]);console.log('PASS: tres registros con el mismo color; cambiar proveedor de A y códigos de A/B conserva C y permite editar cada registro por separado.');
}finally{await browser.close();server.close();}
