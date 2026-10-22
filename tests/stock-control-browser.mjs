import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const profile={id:crypto.randomUUID(),full_name:'Yadira',role:'admin',active:true};
const base={model_code:'AY35',name:'Ayni',category:'Bufanda',material:'Alpaca',composition:'100% Alpaca',color:'Beige',size:'U',quantity:8,min_stock:2};
const items=[{...base,id:crypto.randomUUID(),sku:'QA-LIMA',location:'Lima',quantity:2},{...base,id:crypto.randomUUID(),sku:'QA-SPAIN',location:'España'},{...base,id:crypto.randomUUID(),sku:'QA-BLACK',location:'España',color:'Negro'}],operations=[];
let calls=0;
try{
 await page.route('**/config.js',r=>r.fulfill({body:'window.EURO_CONFIG={url:"https://qa.example.test",key:"test"};',contentType:'text/javascript'}));
 await page.route('https://qa.example.test/rest/v1/**',async r=>{const url=new URL(r.request().url()),name=url.pathname.split('/').pop();let result=[];
 if(name==='profiles')result=[profile];else if(name==='items')result=items;else if(name==='stock_operations')result=operations;
 else if(name==='stock_operate'){calls++;const v=r.request().postDataJSON(),i=items.find(i=>i.id===v.p_item);if(!operations.some(o=>o.id===v.p_id)){if(v.p_kind!=='conteo_produccion')i.quantity+=['venta','entrega'].includes(v.p_kind)?-v.p_quantity:v.p_quantity;operations.push({id:v.p_id,item_id:i.id,kind:v.p_kind,quantity:v.p_quantity,details:v.p_details,related_id:v.p_related,snapshot:{...i},created_at:new Date().toISOString()});}result=null;}
 await r.fulfill({json:result});});
 await page.addInitScript(({profile})=>sessionStorage.setItem('ea-session',JSON.stringify({user:profile,access_token:'qa',expires_at:Date.now()+3600000})),{profile});
 await page.goto('http://127.0.0.1:4173');await page.locator('[data-tab=sales]').click();await page.locator('[data-stock-new]').click();
 await page.locator('dialog [name=item]').selectOption(items[1].id);await page.locator('dialog [name=quantity]').fill('3');await page.locator('dialog [name=client]').fill('Cliente España');await page.locator('dialog [name=person]').fill('Ana');await page.locator('dialog [name=price]').fill('20');assert.match(await page.locator('[data-stock-total]').innerText(),/60.00/);await page.locator('dialog button[type=submit]').dblclick();await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(calls,1);assert.equal(items[1].quantity,5);assert.equal(items[0].quantity,2);assert.equal(items[2].quantity,8);
 assert.match(await page.locator('main').innerText(),/Cliente España/);
 await page.locator('[data-tab=custody]').click();await page.locator('[data-stock-new]').click();await page.locator('dialog [name=item]').selectOption(items[1].id);await page.locator('dialog [name=quantity]').fill('2');await page.locator('dialog [name=person]').fill('María');await page.locator('dialog [name=destination]').fill('Exhibición');await page.locator('dialog button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(items[1].quantity,3);
 await page.locator('[data-stock-return]').click();await page.locator('dialog button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(items[1].quantity,4);assert.match(await page.locator('main').innerText(),/1 pendientes de devolución/);
 await page.reload();await page.locator('[data-tab=sales]').click();assert.match(await page.locator('main').innerText(),/Cliente España/);
 await page.locator('[data-tab=stock-history]').click();await page.locator('[name=client]').fill('María');await page.locator('#stock-filters button').click();assert.match(await page.locator('tbody').innerText(),/María/);
 await page.locator('[data-tab=inventory]').click();await page.locator('#view-summary').click();await page.locator('[data-detail]').first().click();assert.equal(await page.locator('.stock-cards>div').count(),8);assert.match(await page.locator('.detail-top').innerText(),/disponibles en/);
 assert.equal(await page.locator('.stock-cards>div').filter({hasText:'Stock disponible total'}).locator('strong').innerText(),'6');assert.equal(await page.locator('.stock-cards>div').filter({hasText:'Vendidas'}).locator('strong').innerText(),'3');
 await page.locator('[data-stock-kind=conteo_produccion]').click();assert.match(await page.locator('dialog').innerText(),/Confirmación de producción/);await page.locator('dialog [name=quantity]').fill('10');await page.locator('dialog [name=reason]').fill('Conteo documentado');await page.locator('dialog button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));assert.equal(items[0].quantity,2);
 await page.locator('[data-detail]').first().click();assert.equal(await page.locator('.stock-cards>div').filter({hasText:'Producción total'}).locator('strong').innerText(),'10');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.stock-cards').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);await page.screenshot({path:'data/qa/stock-control-mobile.png',fullPage:true});assert.deepEqual(errors,[]);
 console.log('Ventas, doble clic, entrega, devolución parcial, recarga, historial, ficha y móvil: OK.');
}finally{await browser.close();}
