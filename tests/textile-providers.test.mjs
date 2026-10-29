import test from 'node:test';import assert from 'node:assert/strict';import {organizeProviderColors} from '../src/textile-providers.mjs';
test('proveedores completos con hilos y colores ordenados sin cortar referencias entre páginas',()=>{
 const data={suppliers:[{id:'b',name:'ITESSA'},{id:'a',name:'INCA TOPS'},{id:'c',name:'MICHELL'}],yarns:[{id:'y1',supplier_id:'b',name:'Cancas',fiber:'Alpaca',composition:'100% alpaca',title:'2/28'},{id:'y2',supplier_id:'a',name:'Muhu',fiber:'Alpaca',composition:'100% alpaca',title:'2/28'},{id:'y3',supplier_id:'c',name:'Hilo',fiber:'Alpaca',composition:'100% alpaca',title:'18/2'}]};
 const rows=Array.from({length:15},(_,i)=>({id:String(i),yarn_id:'y1',name:'Color '+(15-i),code:String(i)})).concat([{id:'inca',yarn_id:'y2',name:'Pan'},{id:'michell',yarn_id:'y3',name:'Pan'}]),before=structuredClone(rows),groups=organizeProviderColors(rows,data);
 assert.deepEqual(groups.map(g=>g.provider.name),['INCA TOPS','ITESSA','MICHELL']);assert.equal(groups[1].colors.length,15);assert.equal(groups.flatMap(g=>g.yarns.flatMap(y=>y.colors)).length,17);assert.equal(groups[1].yarns[0].colors[0].name,'Color 1');assert.deepEqual(rows,before);
});
