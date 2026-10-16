import fs from 'node:fs';import assert from 'node:assert/strict';import {chromium} from 'playwright-core';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1366,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const items=JSON.parse(fs.readFileSync('data/inventory.json'));
 await page.route('**/local/login',r=>r.fulfill({json:{ok:true}}));await page.route('**/local/inventory',r=>r.fulfill({json:{profile:{id:'qa',full_name:'Yadira',role:'admin'},items}}));
 await page.goto('http://127.0.0.1:4173');await page.locator('[name=email]').fill('qa@example.test');await page.locator('[name=password]').fill('QA-wayra-test');await page.locator('#login-form button').click();
 await page.locator('[data-tab=models]').first().waitFor();await page.locator('[data-tab=models]').first().click();
 assert.equal(await page.locator('.model-card').filter({hasText:'Conjunto WAYRA'}).count(),1);
 await page.locator('[data-model=CR09]').click();assert.equal(await page.locator('#model-component option').count(),2);
 for(const piece of ['Falda','Blusa']){
  await page.locator('#model-component').selectOption(piece);assert.equal(await page.locator('.sku-box strong').innerText(),'AMCR09');
  assert.ok((await page.locator('.model-records').innerText()).includes(piece));
  assert.ok(!(await page.locator('.model-records').innerText()).includes(piece==='Falda'?'Blusa':'Falda'));
 }
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('dialog .close').click();await page.goto('http://127.0.0.1:4173/catalogo.html');await page.locator('[data-code=CR09]').click();
 assert.equal(await page.locator('#component option').count(),2);for(const p of ['Falda','Blusa']){await page.locator('#component').selectOption(p);assert.equal(await page.locator('.sku-box strong').innerText(),'AMCR09');}
 assert.deepEqual(errors,[]);console.log('WAYRA OK: ficha única, selector Falda/Blusa, código común AMCR09, cantidades separadas, móvil y catálogo.');
}finally{await browser.close();}
