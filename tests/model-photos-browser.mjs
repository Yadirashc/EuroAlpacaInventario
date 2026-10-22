import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 const items=JSON.parse(fs.readFileSync('data/inventory.json'));
 await page.route('**/local/login',r=>r.fulfill({json:{ok:true}}));
 await page.route('**/local/inventory',r=>r.fulfill({json:{profile:{id:'qa',full_name:'Yadira',role:'admin'},items}}));
 await page.goto('http://127.0.0.1:4173');
 await page.locator('[name=email]').fill('qa@example.test');await page.locator('[name=password]').fill('QA-photo-test');await page.locator('#login-form button').click();
 await page.locator('[data-tab=photos]').waitFor();
 for(let n=1;n<=2;n++){
  await page.locator('[data-tab=photos]').click();await page.locator('[data-t-action=upload]').click();
  await page.locator('[name=file]').setInputFiles('data/model-photos/ACPE08-0.webp');
  await page.locator('[name=name]').fill('ACPE08 / '+n);await page.locator('[name=model_code]').selectOption('PE08');
  await page.locator('[name=visibility]').selectOption('team');await page.locator('[name=rights_confirmed]').check();await page.locator('dialog button[type=submit]').click();
  await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 }
 await page.locator('[data-tab=models]').click();
 const card=page.locator('[data-model=PE08]');await card.scrollIntoViewIfNeeded();await card.locator('img.ready').waitFor();
 assert.equal(await page.locator('button button').count(),0);
 assert.equal(await page.locator('[data-model=SU29] [data-private-photo]').count(),0);
 await card.click();assert.equal(await page.locator('dialog .model-photo-item').count(),2);
 await page.locator('dialog [data-t-photo]').first().click();await page.locator('#photo-zoom-image.ready').waitFor();
 await page.locator('#photo-zoom').fill('200');assert.equal(await page.locator('#photo-zoom-image').evaluate(e=>e.style.width),'200%');
 await page.locator('dialog .close').click();await page.locator('[data-tab=inventory]').click();await page.locator('#view-summary').click();await page.locator('#search').fill('ACPE08');
 await page.locator('.product-thumb img.ready').first().waitFor();await page.locator('[data-detail]').first().click();assert.equal(await page.locator('dialog .model-photo-item').count(),2);await page.locator('dialog .close').click();
 await page.setViewportSize({width:390,height:844});await page.locator('[data-tab=models]').click();await card.scrollIntoViewIfNeeded();
 await card.locator('img.ready').waitFor();await page.waitForFunction(()=>{const img=document.querySelector('[data-model=PE08] img');return img?.complete&&img.naturalWidth>0;});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/model-photos-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Fotos OK: portada por modelo, miniaturas, ficha, galería, zoom, aislamiento y móvil.');
}finally{await browser.close();}
