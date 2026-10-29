import test from 'node:test';import assert from 'node:assert/strict';import {batchProductOptions} from '../src/batch-product-picker.mjs';
test('busca por modelo, SKU y características sin ofrecer prendas sin stock ni de otro origen',()=>{
 const base={name:'Kinti',model_code:'KI23',material:'Baby alpaca + algodón',color:'Salmón',color_code:'2624',size:'M',commercial_name:'Cancas',location:'Lima',quantity:2};
 const items=[{...base,id:'yes'},{...base,id:'empty',quantity:0},{...base,id:'other',location:'España'},{...base,id:'deleted',deleted_at:'2026-10-29'},{...base,id:'archived',archived:true},{...base,id:'history',source_snapshot:{_inventory_history_only:true}}];
 assert.deepEqual(batchProductOptions(items,'Lima','salmon ACKI23 M').map(i=>i.id),['yes']);assert.equal(batchProductOptions(items,'Lima','Royal').length,0);assert.equal(batchProductOptions(items,'España','Cancas').length,1);
});
