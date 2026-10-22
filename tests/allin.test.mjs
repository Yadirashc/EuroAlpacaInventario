import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllin,allinTotals,allinBreakdown,groupAllinRows,expandAllinRows} from '../src/allin.mjs';
import {canonicalModelRows} from '../src/catalog.mjs';
const base={name:'Allin',category:'Bufanda',material:'Cancas',composition:'15/85',color:'Beige',size:'U',location:'España'};
test('Allin/Cancas suma una vez cada registro y mantiene materiales, ubicaciones y cantidades desconocidas',()=>{
 const rows=[{...base,id:'a',quantity:3},{...base,id:'b',name:'Cancas',quantity:1},{...base,id:'c',location:'Lima',quantity:2},{...base,id:'d',material:'Baby Alpaca',composition:'100%',quantity:1},{...base,id:'e',location:'Vendida',quantity:4},{...base,id:'f',quantity:null},{...base,id:'g',quantity:10,archived:true}];
 const before=structuredClone(rows),totals=allinTotals([...rows,rows[0]]);
 assert.equal(totals.quantity,7);assert.equal(totals.sold,4);assert.equal(totals.unknown,1);
 const groups=allinBreakdown(rows);assert.equal(groups.length,4);const beige=groups.find(g=>g.material==='Cancas'&&g.location==='España');assert.equal(beige.quantity,4);assert.equal(beige.unknown,1);assert.equal(beige.items.length,3);
 assert.deepEqual(rows,before);assert.ok(isAllin({...base,name:'Bufanda Cancas'}));assert.ok(!isAllin({...base,category:'Chompa'}));assert.ok(!isAllin({...base,name:'Ayni',commercial_name:'Cancas'}));
});
test('ficha única conserva exportación y suma por selección sin tocar otros productos',()=>{
 const rows=[{...base,id:'a',quantity:3},{...base,id:'b',quantity:1},{...base,id:'other',name:'Ayni',quantity:5}],before=structuredClone(rows);
 const grouped=groupAllinRows(rows);assert.equal(grouped.length,2);assert.equal(grouped[0].quantity,4);assert.equal(grouped[1],rows[2]);assert.deepEqual(expandAllinRows(grouped),rows);assert.deepEqual(rows,before);
 assert.equal(groupAllinRows(rows.filter(i=>i.id==='b'))[0].quantity,1);
 const aliases=canonicalModelRows([{...rows[0],model_code:'AL34'},{...rows[1],name:'Cancas',model_code:'CA40'}]);assert.equal(new Set(aliases.map(i=>i.model_code)).size,1);assert.deepEqual(aliases.map(i=>i.quantity),[3,1]);
});
