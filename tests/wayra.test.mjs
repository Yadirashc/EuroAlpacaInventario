import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalModelRows,modelVariants,publicCatalog,variantSku} from '../src/catalog.mjs';
const base={name:'Wayra',material:'Baby alpaca + microfibra',composition:'30% baby alpaca',color:'Beige',size:'M',quantity:1,location:'España',status:'Disponible',production_state:'Terminado'};
test('WAYRA reúne falda y blusa bajo AMCR09 sin mezclar existencias',()=>{
 const rows=canonicalModelRows(['CR09','CR10','WA39','WA40'].map((model_code,i)=>({...base,id:String(i),sku:'INTERNAL-'+i,model_code,category:i%2?'Blusa':'Falda',quantity:i+1})));
 assert.deepEqual([...new Set(rows.map(r=>r.model_code))],['CR09']);
 assert.ok(rows.every(r=>r.name==='Conjunto WAYRA'&&variantSku(r)==='AMCR09'));
 assert.deepEqual(rows.map(r=>r.sku),['INTERNAL-0','INTERNAL-1','INTERNAL-2','INTERNAL-3']);
 const variants=modelVariants(rows);assert.equal(variants.length,2);
 assert.equal(variants.find(v=>v.component==='Falda').items.reduce((s,r)=>s+r.quantity,0),4);
 assert.equal(variants.find(v=>v.component==='Blusa').items.reduce((s,r)=>s+r.quantity,0),6);
 const [model]=publicCatalog(rows);assert.equal(model.name,'Conjunto WAYRA');assert.equal(model.category,'Conjunto');assert.equal(model.variants.length,2);assert.ok(model.variants.every(v=>v.sku==='AMCR09'));
});
