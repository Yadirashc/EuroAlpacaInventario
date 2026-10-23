import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPhotoCandidates,providerURL,selectPhotoPilot,syncProviderPhotos} from '../server/provider-photo-sync.mjs';
import {sameVariant,verifiedPhoto} from '../src/photo-identity.mjs';
import {identity,identityKey} from '../server/color-photo-catalog.mjs';
import sharp from 'sharp';
const i={color_id:'c',yarn_id:'y',supplier_id:'s',provider:'INCATOPS',yarn:'MUHU',code:'8080',composition:'100% baby alpaca',title:'2/28',fiber:'Baby alpaca'};
const config={url:'https://stockserviceessentials.com/es-pe/products/muhu-2-28',method:'essentials-html',product_name:'MUHU 2/28',product_code:'42'};
function html({code='8080',title='MUHU 2/28',composition='100% Baby Alpaca',count='2/28',imageProduct=42,imageVariant=12}={}){return '<script type="application/json" data-product-json>'+JSON.stringify({id:42,title,variants:[{id:12,option1:code,sku:'MUHU-'+code,featured_image:{product_id:imageProduct,variant_ids:[imageVariant],src:'https://stockserviceessentials.com/cdn/shop/files/muhu-'+code+'.jpg'}}]})+'</script><script type="application/json" data-stock-pdf-data>'+JSON.stringify({title,composition,count,variants:[{id:12,code}]})+'</script>';}
test('Essentials exige producto, título, composición, código y vínculo de imagen con variante exactos',()=>{
 const candidates=extractPhotoCandidates(html(),i,config);assert.equal(candidates.length,1);assert.equal(candidates[0].sku,'MUHU-8080');assert.equal(candidates[0].exact,true);
 assert.equal(extractPhotoCandidates(html({code:'8081'}),i,config).length,0);
 for(const change of [{title:'MUHU 2/16'},{composition:'100% Royal Alpaca'},{count:'2/16'}])assert.throws(()=>extractPhotoCandidates(html(change),i,config));
 assert.equal(extractPhotoCandidates(html({imageProduct:99}),i,config).length,0);assert.equal(extractPhotoCandidates(html({imageVariant:99}),i,config).length,0);
 assert.throws(()=>providerURL('https://www.itessa.com.pe/es/producto/cancas-nu',i.provider));assert.throws(()=>providerURL('https://stockserviceessentials.com.evil.test/x',i.provider));
});
test('una referencia central comparte solo fotos verificadas de la misma variante sin equiparar ceros',()=>{
 const p={id:'p',active:true,rights_confirmed:true,verification_status:'verified',storage_full:'full.webp',storage_thumb:'thumb.webp',source_identity:i};assert.equal(verifiedPhoto([p],{...i,color_id:'duplicado'}),p);
 for(const change of [{code:'08080'},{provider:'MICHELL'},{yarn:'Kori'},{title:'2/16'},{composition:'100% royal alpaca'}])assert.equal(sameVariant(i,{...i,...change}),false);
 assert.equal(verifiedPhoto([{...p,verification_status:'pending'}],i),undefined);
});
test('prueba de cinco registros reparte proveedores y no consulta ni descarga sin autorización',async()=>{
 const r={suppliers:['ITESSA','INCATOPS','MICHELL'].map((name,n)=>({id:'s'+n,name})),yarns:[],colors:[],photos:[]};
 for(let n=0;n<6;n++){r.yarns.push({id:'y'+n,supplier_id:'s'+n%3,name:'Baby alpaca',title:'2/28',composition:'100% baby alpaca',active:true});r.colors.push({id:'c'+n,yarn_id:'y'+n,name:'Color '+n,code:String(8000+n),active:true});}
 assert.equal(selectPhotoPilot(r).length,5);assert.equal(new Set(selectPhotoPilot(r).map(color=>r.yarns.find(y=>y.id===color.yarn_id).supplier_id)).size,3);
 const tables={textile_colors:r.colors,textile_yarns:r.yarns,textile_suppliers:r.suppliers,textile_photos:r.photos},checks=[],sources=[],writes=[];
 const c={stage:'production',profile:{id:'admin'},db:async(path,opts={})=>{if(opts.method){writes.push(path);if(path.startsWith('textile_photo_checks'))checks.push(opts.body);if(path.startsWith('textile_photo_sources'))sources.push(opts.body);return opts.body;}if(path.startsWith('textile_photo_checks'))return checks;if(path.startsWith('textile_photo_sources'))return path.includes('eq.photo-pilot')?sources.filter(row=>row.source_key==='photo-pilot'):[];return tables[path.split('?')[0]]||[];}};
 const old=global.fetch;global.fetch=()=>{throw Error('No debe hacer consultas externas sin permiso');};
 try{const report=await syncProviderPhotos(c,{mode:'pilot'});assert.equal(report.run.results.length,5);assert.equal(report.loaded,0);assert.equal(report.pending,6);assert.deepEqual(report.pilot.validated_yarns,[]);assert.ok(!writes.some(path=>path.startsWith('items')||path.startsWith('textile_photos')||path.startsWith('rpc/')));await assert.rejects(syncProviderPhotos(c,{mode:'batch'}),/prueba de cinco/);}finally{global.fetch=old;}
});
test('una fuente autorizada guarda la variante exacta y reutiliza la fotografía ya almacenada',async()=>{
 const supplier={id:'s',name:'INCATOPS'},yarn={id:'y',supplier_id:'s',name:'MUHU',title:'2/28',composition:'100% baby alpaca',fiber:'Baby alpaca'},color={id:'c',yarn_id:'y',code:'8080',name:'Color de prueba'};
 const original=identity(color,yarn,supplier),setting={...config,yarn_id:'y',identity_key:identityKey({...original,color_id:undefined,code:undefined}),permission_reference:'Permiso ficticio de prueba automatizada',allow_lookup:true,allow_download:true,auto_confirm:true,updated_at:'2026-01-01'},photos=[],checks=[],sources=[];
 const c={stage:'production',url:'https://storage.example.test',key:'test-only',profile:{id:'admin'},db:async(path,opts={})=>{
  if(path.startsWith('rpc/confirm_color_photo'))return opts.body.p_photo;
  if(opts.method){if(path.startsWith('textile_photo_checks'))checks.push(opts.body);if(path.startsWith('textile_photo_sources'))sources.push(opts.body);return opts.body;}
  if(path.startsWith('textile_photo_sources')){if(path.includes('like.photo-config'))return [{result:{config:setting}}];if(path.includes('eq.photo-page:'))return [{checked_at:new Date().toISOString(),result:{html:html(),robots:'User-agent: *\nAllow: /'}}];return sources.filter(row=>row.source_key==='photo-pilot');}
  if(path.startsWith('textile_photo_checks'))return checks;
  return {textile_colors:[color],textile_yarns:[yarn],textile_suppliers:[supplier],textile_photos:photos}[path.split('?')[0]]||[];
 }};
 const pattern=await sharp({create:{width:4,height:4,channels:3,background:{r:101,g:102,b:103}}}).png().toBuffer(),old=global.fetch;let downloads=0,uploads=0;
 global.fetch=async(url,opts={})=>{if(String(url).startsWith('https://stockserviceessentials.com/')){downloads++;return new Response(pattern);}if(String(url).startsWith(c.url)&&opts.method==='POST'){uploads++;return new Response('{}');}throw Error('Destino inesperado');};
 try{const report=await syncProviderPhotos(c,{mode:'pilot'});assert.equal(report.loaded,1);assert.equal(report.verified,1);assert.equal(photos.length,1);assert.equal(photos[0].source_identity.sku,'MUHU-8080');assert.match(photos[0].storage_name,/incatops_muhu-2-28_8080.webp/);assert.equal(downloads,1);assert.equal(uploads,2);await syncProviderPhotos(c,{mode:'pilot'});assert.equal(downloads,1);assert.equal(uploads,2);}finally{global.fetch=old;}
});
