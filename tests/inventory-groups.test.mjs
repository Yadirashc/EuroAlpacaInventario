import test from 'node:test';
import assert from 'node:assert/strict';
import {groupInventoryRows,expandInventoryRows} from '../src/inventory-groups.mjs';
const base={name:'Hanaq',model_code:'HA41',category:'Chal',material:'Majestic',composition:'100% imperial alpaca',color:'Lacre',size:'NO CALIFICA',location:'España'};
test('Hanaq suma duplicados por modelo, color, talla y ubicación sin cambiar originales',()=>{
 const rows=[{...base,id:'a',quantity:5},{...base,id:'b',quantity:4},{...base,id:'c',color:'Mostaza',quantity:4},{...base,id:'d',color:'Mostaza',quantity:7}],before=structuredClone(rows);
 const grouped=groupInventoryRows(rows);assert.equal(grouped.length,2);assert.deepEqual(grouped.map(r=>r.quantity),[9,11]);assert.deepEqual(expandInventoryRows(grouped),rows);assert.deepEqual(rows,before);
 assert.deepEqual(groupInventoryRows(grouped),grouped);
});
test('ubicaciones, tallas, materiales y piezas del conjunto se mantienen separados',()=>{
 const rows=[{...base,id:'a',quantity:1},{...base,id:'b',quantity:2,location:'Lima'},{...base,id:'c',quantity:3,size:'S'},{...base,id:'d',quantity:4,material:'Baby alpaca',composition:'100% baby alpaca'},{...base,id:'e',quantity:5,color:'Mostaza'}];
 assert.equal(groupInventoryRows(rows).length,5);
 const wayra=[{...base,id:'w1',name:'Conjunto WAYRA',model_code:'CR09',category:'Falda',quantity:1},{...base,id:'w2',name:'Conjunto WAYRA',model_code:'CR09',category:'Blusa',quantity:2}];assert.equal(groupInventoryRows(wayra).length,2);
});
test('IDs repetidos no duplican cantidades y las cantidades desconocidas se conservan',()=>{
 const a={...base,id:'a',quantity:5},b={...base,id:'b',quantity:null};const grouped=groupInventoryRows([a,b,a]);assert.equal(grouped.length,1);assert.equal(grouped[0].quantity,5);assert.equal(grouped[0].inventory_unknown,1);assert.equal(expandInventoryRows(grouped).length,2);
 const allin={...a,allin_group:[a],quantity:10};assert.equal(groupInventoryRows([allin])[0],allin);
});
