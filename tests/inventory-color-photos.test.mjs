import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryColorPhoto} from '../src/inventory-color-photos.mjs';

const item={supplier:'ITESSA',commercial_name:'Baby Alpaca',material:'Baby alpaca',composition:'100% Baby Alpaca',yarn_title:'2/28',color:'Rojo',color_code:'BA - 201'};
const identity={provider:'ITESSA',supplier_id:'s',yarn:'Baby Alpaca',yarn_id:'y',color_id:'c',fiber:'Baby alpaca',composition:'100% Baby Alpaca',title:'2/28',code:'201'};
const seed=()=>({suppliers:[{id:'s',name:'ITESSA'}],yarns:[{id:'y',supplier_id:'s',name:'Baby Alpaca',fiber:'Baby alpaca',composition:'100% Baby Alpaca',title:'2/28'}],colors:[{id:'c',yarn_id:'y',name:'Rojo',code:'201'}],photos:[{id:'p',active:true,rights_confirmed:true,verification_status:'verified',source_identity:identity,storage_full:'private/full.webp',storage_thumb:'private/thumb.webp'}]});

test('inventario usa la fotografía verificada del proveedor, hilo, composición, título y código exactos',()=>{
 assert.equal(inventoryColorPhoto(item,seed()).photo.id,'p');
 for(const change of [{supplier:'Michell'},{commercial_name:'Kori'},{composition:'100% Royal Alpaca'},{yarn_title:'2/16'},{color_code:'0201'},{color_code:''},{supplier:''}])assert.equal(inventoryColorPhoto({...item,...change},seed()),null);
 assert.equal(inventoryColorPhoto({...item,color:'Nombre corregido'},seed()).photo.id,'p');
});
test('inventario no muestra imágenes pendientes, eliminadas, de identidad anterior ni ambiguas',()=>{
 for(const change of [{verification_status:'pending'},{active:false},{deleted_at:new Date().toISOString()},{source_identity:{...identity,code:'202'}}]){const data=seed();Object.assign(data.photos[0],change);assert.equal(inventoryColorPhoto(item,data),null);}
 const data=seed();data.suppliers.push({id:'s2',name:'ITESSA'});data.colors.push({...data.colors[0],id:'c2',yarn_id:'y2'});data.yarns.push({...data.yarns[0],id:'y2',supplier_id:'s2'});data.photos.push({...data.photos[0],id:'p2',storage_full:'private/other.webp',source_identity:{...identity,supplier_id:'s2',yarn_id:'y2',color_id:'c2'}});
 assert.equal(inventoryColorPhoto(item,data),null);
 data.photos[0].active=false;assert.equal(inventoryColorPhoto(item,data).photo.id,'p2');
});
