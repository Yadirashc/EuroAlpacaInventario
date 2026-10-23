import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {allinTotals,allinBreakdown,groupAllinRows} from '../src/allin.mjs';
const base={name:'Allin',category:'BUFANDA',model_code:'AL34',material:'Baby alpaca + algodón',composition:'15/85',color:'Beige',size:'NO CALIFICA',location:'España',quantity:3,min_stock:2,source_sheet_name:'INVENTARIO - TALLER',source_row:1,production_state:'Terminado'};
const fixture=process.env.ALLIN_FIXTURE;
const items=fixture?JSON.parse(fs.readFileSync(fixture)).items:[{...base,id:'a',sku:'a'}, {...base,id:'b',sku:'b',quantity:2}, {...base,id:'c',sku:'c',location:'Lima',quantity:1}, {...base,id:'d',sku:'d',location:'Muestras / revisión',color:'Olivo',quantity:2}, {...base,id:'e',sku:'e',location:'Muestras / revisión',color:'Olivo',quantity:2,production_state:'Falta acabado'}],before=structuredClone(items),totals=allinTotals(items),groups=allinBreakdown(items);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config.js',r=>r.fulfill({body:'window.EURO_CONFIG={url:"",key:"",local:true,textile:true,textilePreview:true};',contentType:'text/javascript'}));
 await page.route('**/local/login',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/local/inventory',r=>r.fulfill({json:{profile:{id:'qa',full_name:'Yadira',role:'admin'},items}}));
 await page.route('**/rest/v1/**',r=>{if(r.request().method()!=='GET')writes.push(r.request().url());return r.fulfill({json:[]});});
 await page.goto(process.env.ALLIN_SITE||'http://127.0.0.1:4173');
 await page.locator('#login-form [name=email]').fill('qa@example.test');await page.locator('#login-form [name=password]').fill('QA-only');await page.locator('#login-form button').click();
 await page.locator('nav [data-tab=inventory]').click();
 assert.ok(await page.locator('[data-allin-unified]').count()>1);
 await page.locator('#view-summary').click();
 await page.locator('[data-allin-open]').first().click();
 const first=await page.locator('[data-allin-location-select]').inputValue();assert.ok(first);
 assert.equal(await page.locator('[data-allin-section]').count(),1);
 await page.locator('[data-allin-location-select]').selectOption('');
 assert.match(await page.locator('[data-allin-total]').innerText(),new RegExp('^'+totals.quantity+' '));
 assert.equal(await page.locator('[data-allin-breakdown]').count(),groups.length);
 for(const l of [...new Set(items.map(i=>i.location))]){
  const expected=items.filter(i=>i.location===l).reduce((n,i)=>n+(i.quantity??0),0);
  assert.equal(await page.locator(`[data-allin-location="${l}"]`).innerText(),String(expected));
  const quantities=await page.locator(`[data-allin-section="${l}"] td.quantity`).allTextContents();
  assert.equal(quantities.reduce((n,s)=>n+Number(s),0),expected);
 }
 const olivo=page.locator('[data-allin-section="Muestras / revisión"] [data-allin-breakdown]').filter({hasText:'Olivo'});
 assert.equal(await olivo.count(),1);assert.equal(await olivo.locator('td.quantity').innerText(),'4');assert.match(await olivo.innerText(),/Varios acabados/);
 assert.match(await page.locator('dialog').innerText(),/No califica/);
 await page.screenshot({path:'data/qa/allin-split-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'data/qa/allin-split-mobile.png',fullPage:true});
 await page.locator('[data-allin-records]').first().click();await page.locator('dialog [data-detail]').first().click();assert.ok(await page.locator('dialog .detail-grid').first().isVisible());await page.locator('dialog .close').click();
 const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download,text=fs.readFileSync(await file.path(),'utf8');for(const i of items.filter(i=>i.source_sheet_name===items[0].source_sheet_name))assert.ok(text.includes(i.sku));
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(items,before);
 console.log(JSON.stringify({units:totals.quantity,groups:groups.length,inventoryGroups:groupAllinRows(items).length,locations:true,originalsAccessible:true,noWrites:true}));
}finally{await browser.close();}
