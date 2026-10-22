import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {variantSku} from '../src/catalog.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base={model_code:'AR03',name:'Aruma',category:'VESTIDO',material:'Baby Alpaca',composition:'100% Baby Alpaca',color:'Mostaza',size:'M',location:'Lima',supplier:'ITESSA',commercial_name:'Baby',min_stock:2,archived:false};
 const items=[{...base,id:crypto.randomUUID(),sku:'HIGH',quantity:3},{...base,id:crypto.randomUUID(),sku:'LOW',color:'Beige',quantity:1},{...base,id:crypto.randomUUID(),sku:'ZERO',quantity:0},{...base,id:crypto.randomUUID(),sku:'UNKNOWN',quantity:null},{...base,id:crypto.randomUUID(),sku:'SPAIN',location:'España',quantity:5},{...base,id:crypto.randomUUID(),sku:'ARCHIVED',archived:true,quantity:4},{...base,id:crypto.randomUUID(),sku:'SOLD',location:'Vendida',quantity:2}];
 await page.route('**/local/login',r=>r.fulfill({json:{ok:true}}));await page.route('**/local/inventory',r=>r.fulfill({json:{profile:{id:'qa-local',full_name:'Yadira',role:'admin',email:'qa@example.test'},items}}));
 await page.goto('http://127.0.0.1:4173');await page.locator('#login-form [name=email]').fill('qa@example.test');await page.locator('#login-form [name=password]').fill('QA-only');await page.locator('#login-form button').click();
 await page.locator('[data-tab=shipments]').click();await page.locator('[data-log-pane=register]').click();await page.locator('#log-register').click();
 const options=page.locator('#log-item-picker option[value]:not([value=""])');
 assert.equal(await options.count(),2);
 for(const [n,status] of [[0,'En stock'],[1,'Stock bajo']]){
  const option=page.locator(`#log-item-picker option[value="${items[n].id}"]`),label=await option.innerText();
  for(const expected of [variantSku(items[n]),'Aruma','VESTIDO',items[n].color,'M','Lima','Stock: '+items[n].quantity,status])assert.ok(label.includes(expected),label);
  assert.equal(await option.isDisabled(),false);
 }
 await page.locator('[name=origin]').selectOption('España');assert.equal(await options.count(),1);assert.equal(await options.first().getAttribute('value'),items[4].id);
 await page.locator('[name=origin]').selectOption('Vendida');assert.equal(await options.count(),0);
 await page.locator('[name=origin]').selectOption('Lima');
 for(const [n,q] of [[0,'2'],[1,'1']]){await page.locator('#log-item-picker').selectOption(items[n].id);await page.locator('#log-add-line').click();await page.locator(`[data-log-line="${n}"][data-key=quantity]`).fill(q);}
 assert.equal(await page.locator('[data-key=quantity]').nth(1).getAttribute('max'),'1');
 await page.locator('[data-key=quantity]').nth(1).fill('2');assert.equal(await page.locator('[data-key=quantity]').nth(1).evaluate(el=>el.validity.rangeOverflow),true);await page.locator('[data-key=quantity]').nth(1).fill('1');
 // Switch to the internal movement form so the test needs no client record.
 await page.locator('dialog .close').click();await page.locator('nav [data-tab=inventory]').click();await page.locator('#view-summary').click();
 await page.locator(`[data-log-location="${items[0].id}"]`).click();await page.locator('#log-location-register').click();
 await page.locator('[name=country]').fill('España');await page.locator('[name=city]').fill('Madrid');await page.locator('[name=address]').fill('Destino QA');await page.locator('[name=carrier]').fill('Ana QA');
 await page.locator('[data-key=quantity]').fill('2');await page.locator('#log-item-picker').selectOption(items[1].id);await page.locator('#log-add-line').click();
 await page.locator('[data-key=shipping_lot]').nth(0).fill('Caja alta');await page.locator('[data-key=shipping_lot]').nth(1).fill('Caja baja');
 await page.locator('#log-shipment-form [data-log-save]').click();await page.waitForFunction(()=>!document.querySelector('dialog'));
 await page.locator('nav [data-tab=shipments]').click();await page.locator('[data-log-pane=panel]').click();await page.locator('[data-log-detail]').first().click();
 for(const next of ['En preparación','Listo para despacho','En tránsito']){await page.locator(`[data-log-next="${next}"]`).click();await page.locator('[data-log-save]').dblclick();await page.locator('[data-log-next]').first().waitFor();}
 assert.match(await page.locator('dialog .log-detail-head').innerText(),/En tránsito/);assert.match(await page.locator('dialog').innerText(),/Madrid/);
 await page.locator('dialog .close').click();await page.locator('[data-log-pane=register]').click();await page.locator('#log-register').click();
 assert.equal(await options.count(),1);const remaining=await options.first().innerText();assert.match(remaining,/Stock: 1 · Stock bajo/);assert.equal(await options.first().getAttribute('value'),items[0].id);
 assert.deepEqual(errors,[]);console.log('Selector: en stock y stock bajo (1 unidad), exclusión de cero/desconocido/archivado/vendido, origen, cantidades máximas, despacho sin doble descuento y estado restante OK.');
}finally{await browser.close();}
