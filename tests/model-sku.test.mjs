import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalModelRows,variantSku,modelKey,materialCode} from '../src/catalog.mjs';
const row={id:'live',sku:'internal-unique',name:'Qori',category:'Chompa cuello alto',material:'Baby alpaca',model_code:'QO17',quantity:3,color:'Celeste',size:'M'};
const official=r=>({...r,source_snapshot:{_model_sku:{sku:'ACQO17',model_key:modelKey(r),material_code:materialCode(r)}}});
test('SKU del Excel se conserva exactamente por modelo sin cambiar su material ni referencia interna',()=>{
 const r=official(row);assert.equal(variantSku(r),'ACQO17');assert.equal(variantSku({...r,color:'Rojo',size:'L',quantity:8}),'ACQO17');assert.equal(r.sku,'internal-unique');assert.equal(r.material,'Baby alpaca');
 assert.notEqual(variantSku({...r,name:'Otro modelo'}),'ACQO17');assert.notEqual(variantSku({...r,material:'Royal alpaca'}),'ACQO17');assert.notEqual(variantSku({...r,model_code:'OT80'}),'ACQO17');
});
test('las fichas archivadas no reemplazan códigos oficiales y conservan su propio código histórico',()=>{
 const current={...row,name:'Killa',material:'Royal alpaca',model_code:'KI37'},old={...current,id:'old',model_code:'CU19',archived:true};
 const live={...current,source_snapshot:{_model_sku:{sku:'RAKI37',model_key:modelKey(current),material_code:materialCode(current)}}};
 const [history,actual]=canonicalModelRows([old,live]);assert.equal(history.model_code,'CU19');assert.equal(actual.model_code,'KI37');assert.equal(variantSku(actual),'RAKI37');assert.equal(actual.quantity,3);
});
