import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import sharp from 'sharp';

const root=path.resolve('dist'),inventory=fs.readFileSync('data/inventory.json','utf8');
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname;
 if(name==='/config.js'){res.setHeader('Content-Type','text/javascript');return res.end('window.EURO_CONFIG={url:"",key:"",local:true,textile:true,textilePreview:true}');}
 const file=path.join(root,name==='/'?'index.html':name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}
 res.setHeader('Content-Type',/\.(m?js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/local/login',route=>route.fulfill({json:{ok:true}}));
 await page.route('**/local/inventory',route=>route.fulfill({json:{profile:{id:'qa',role:'admin',full_name:'QA'},items:JSON.parse(inventory)}}));
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.locator('[name=email]').fill('qa@example.test');await page.locator('[name=password]').fill('qa-local');await page.locator('#login-form button').click();
 await page.locator('[data-tab=yarns]').click();assert.equal(await page.locator('.yarn-card').count(),7);assert.deepEqual(await page.locator('.catalog-provider-heading h2').allTextContents(),['INCA TOPS','ITESSA']);
 await page.locator('[data-tab=colors]').click();await page.locator('#textile-search').fill('6330');assert.equal(await page.locator('.color-library-card').count(),1);await page.locator('.color-library-card').filter({hasText:'Título: 18/2'}).locator('[data-t-color]').click();await page.locator('#edit-color').click();await page.locator('dialog [name=name]').fill('Guinda unificada QA');await page.locator('dialog button[type=submit]').first().click();await page.locator('dialog').waitFor({state:'hidden'});assert.equal(await page.locator('.color-library-card').count(),1);assert.equal(await page.locator('.color-library-card').filter({hasText:'Título: 18/2'}).locator('h2').innerText(),'Guinda unificada QA');
 await page.locator('[data-tab=textile]').click();assert.equal(await page.locator('.catalog-product-card').count(),7);assert.deepEqual(await page.locator('.catalog-provider-heading h2').allTextContents(),['INCA TOPS','ITESSA']);fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/unified-catalog-desktop.png',fullPage:true});await page.locator('[data-catalog-colors=cancas]').click();await page.locator('#textile-search').fill('6330');assert.equal(await page.locator('.color-library-card').filter({hasText:'Título: 18/2'}).locator('h2').innerText(),'Guinda unificada QA');
 await page.locator('[data-tab=yarns]').click();
 const yarnID=await page.locator('[data-t-yarn]').first().getAttribute('data-t-yarn');
 await page.locator('[data-t-yarn]').first().click();
 const initialRows=await page.locator('dialog .yarn-colors-table tbody tr').count();
 await page.locator('#yarn-add-color').click();
 assert.equal(await page.locator('dialog [name=yarn_id]').inputValue(),yarnID);
 await page.locator('dialog [name=name]').fill('Color QA nuevo');await page.locator('dialog [name=code]').fill('QA-JXL-2026');
 await page.locator('dialog button[value=photo]').click();
 await page.locator('#textile-photo-form').waitFor();
 assert.equal(await page.locator('dialog [name=rights_confirmed]').count(),0);
 assert.match(await page.locator('dialog [name=file]').getAttribute('accept'),/\.jxl/);
 const buffer=await sharp({create:{width:40,height:40,channels:3,background:'#9c4873'}}).png().toBuffer();
 await page.locator('dialog [name=file]').setInputFiles({name:'color.png',mimeType:'image/png',buffer});
 await page.locator('dialog [name=exact_confirmed]').check();await page.locator('dialog button[type=submit]').click();
 await page.locator('#yarn-add-color').waitFor();
 assert.equal(await page.locator('dialog .yarn-colors-table tbody tr').count(),initialRows+1);
 let row=page.locator('dialog .yarn-colors-table tbody tr').filter({hasText:'QA-JXL-2026'});
 await row.scrollIntoViewIfNeeded();await row.locator('[data-private-photo].ready').waitFor();
 await row.locator('[data-yarn-edit-color]').click();await page.locator('dialog [name=name]').fill('Color QA editado');await page.locator('dialog [name=family]').selectOption({label:'Neutros'});await page.locator('dialog button[type=submit]').first().click();
 row=page.locator('dialog .yarn-colors-table tbody tr').filter({hasText:'QA-JXL-2026'});await row.waitFor();assert.match(await row.innerText(),/Color QA editado/);
 await row.locator('[data-t-stock]').click();await page.locator('dialog [name=stock_kg]').fill('1.250');await page.locator('dialog [name=notes]').fill('Conteo QA');await page.locator('dialog button[type=submit]').click();
 row=page.locator('dialog .yarn-colors-table tbody tr').filter({hasText:'QA-JXL-2026'});await row.waitFor();assert.match(await row.innerText(),/1[.,]25 kg/);
 fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/yarn-management-desktop.png',fullPage:true});
 await page.locator('#yarn-edit-supplier').click();assert.equal(await page.locator('dialog [name=name]').getAttribute('readonly'),'');await page.locator('dialog [name=integration_notes]').fill('Notas QA del proveedor compartido');await page.locator('dialog button[type=submit]').click();await page.locator('#edit-yarn').waitFor();assert.match(await page.locator('dialog .eyebrow').innerText(),/INCA TOPS/);
 await page.locator('#edit-yarn').click();await page.locator('dialog [name=catalog_product]').selectOption('kori');assert.equal(await page.locator('dialog [name=name]').inputValue(),'KORI');assert.equal(await page.locator('dialog [name=composition]').inputValue(),'100% Royal alpaca');assert.equal(await page.locator('dialog [name=fiber]').getAttribute('readonly'),'');await page.locator('dialog button[type=submit]').click();await page.locator('#edit-yarn').waitFor();assert.match(await page.locator('dialog .eyebrow').innerText(),/INCA TOPS/);assert.match(await page.locator('dialog .yarn-technical-details').innerText(),/100% Royal alpaca/);
 await page.locator('dialog .close').click();await page.locator('[data-t-action=new-yarn]').click();await page.locator('dialog [name=catalog_product]').selectOption('muhu');await page.locator('dialog [name=title]').fill('2/40');await page.locator('dialog button[type=submit]').click();await page.locator('dialog').waitFor({state:'hidden'});await page.locator('#textile-search').fill('MUHU');await page.locator('[data-t-yarn]').click();assert.match(await page.locator('dialog .yarn-empty-colors').innerText(),/aún no tiene colores/);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 fs.mkdirSync('data/qa',{recursive:true});await page.screenshot({path:'data/qa/yarn-management-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.equal(fs.readFileSync('data/inventory.json','utf8'),inventory);
 console.log('PASS: agregar color y foto, editar color y stock, catálogo unificado, KORI de INCA TOPS, proveedor y composición automáticos, títulos conservados, vista móvil; inventario intacto.');
}finally{await browser.close();server.close();}
