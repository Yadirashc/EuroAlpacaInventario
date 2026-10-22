import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {allinTotals,isAllin} from '../src/allin.mjs';
const base={name:'Allin',category:'BUFANDA',model_code:'AL34',material:'Baby alpaca + algodón',composition:'15/85',color:'Beige',size:'NO CALIFICA',location:'España',quantity:3,min_stock:2,source_sheet_name:'INVENTARIO - TALLER',source_row:1};
const originals=process.env.ALLIN_FIXTURE?JSON.parse(fs.readFileSync(process.env.ALLIN_FIXTURE)).items:[{...base,id:'a',sku:'a'},{...base,id:'b',sku:'b',quantity:1,source_row:2},{...base,id:'c',sku:'c',location:'Lima',quantity:2},{...base,id:'d',sku:'d',material:'Baby alpaca',composition:'100%',quantity:1}];
const items=[...originals,{...base,id:'other',sku:'other',model_code:'AY35',name:'Ayni',quantity:5}],before=structuredClone(items),totals=allinTotals(originals),browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config.js',r=>r.fulfill({body:'window.EURO_CONFIG={url:"",key:"",local:true,textile:true,textilePreview:true};',contentType:'text/javascript'}));
 await page.route('**/local/login',r=>r.fulfill({json:{ok:true}}));await page.route('**/local/inventory',r=>r.fulfill({json:{profile:{id:'qa',full_name:'Yadira',role:'admin'},items}}));
 await page.route('**/rest/v1/**',r=>{if(r.request().method()!=='GET')writes.push(r.request().url());return r.fulfill({json:[]});});
 await page.goto(process.env.ALLIN_SITE||'http://127.0.0.1:4173');await page.locator('#login-form [name=email]').fill('qa@example.test');await page.locator('#login-form [name=password]').fill('QA-only');await page.locator('#login-form button').click();
 await page.locator('nav [data-tab=inventory]').click();assert.equal(await page.locator('[data-allin-unified]').count(),1);await page.locator('[data-allin-open]').first().click();
 assert.match(await page.locator('[data-allin-total]').innerText(),new RegExp('^'+totals.quantity+' '));
 for(const location of [...new Set(originals.map(i=>i.location))])assert.equal(await page.locator(`[data-allin-location="${location}"]`).innerText(),String(originals.filter(i=>i.location===location).reduce((n,i)=>n+(i.quantity??0),0)));
 const sum=await page.locator('[data-allin-breakdown] td.quantity').allTextContents();assert.equal(sum.reduce((n,v)=>n+Number(v),0),totals.quantity+totals.sold);
 await page.locator('[data-allin-records]').first().click();await page.locator('dialog [data-detail]').first().click();assert.ok(await page.locator('dialog .detail-top strong').isVisible());assert.ok(await page.locator('dialog .detail-grid').first().isVisible());await page.locator('dialog .close').click();
 // Reopen the inventory to verify one row, the location filter and original CSV quantities.
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.locator('#view-summary').click();assert.equal(await page.locator('[data-allin-unified]').count(),1);
 const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download,text=fs.readFileSync(await file.path(),'utf8');assert.ok(text.includes('other'));for(const i of originals)assert.ok(text.includes(i.sku));
 await page.locator('[data-filter=location]').selectOption('España');assert.equal(await page.locator('[data-allin-unified]').count(),1);assert.equal(Number(await page.locator('[data-allin-unified] td.quantity').innerText().then(s=>s.match(/^\d+/)[0])),originals.filter(i=>i.location==='España').reduce((n,i)=>n+(i.quantity??0),0));
 await page.locator('[data-allin-open]').first().click();await page.setViewportSize({width:390,height:844});fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/allin-unified-mobile.png',fullPage:true});assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(items,before);
 console.log('Allin: una ficha, cantidades conservadas, desglose por material/color/talla/ubicación, filtros, registros e historial accesibles, CSV original y cero escrituras: OK ('+totals.quantity+' unidades).');
}finally{await browser.close();}
