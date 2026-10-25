import test from 'node:test';import assert from 'node:assert/strict';
import {inventoryColorPhoto,inventoryColorMatches,inventoryColorRecord} from '../src/inventory-color-photos.mjs';
const item={id:'item',supplier:'ITESSA',commercial_name:'Baby Alpaca',material:'Baby alpaca',composition:'100% Baby Alpaca',yarn_title:'2/28',color:'Rojo',color_code:'BA - 201',quantity:5};
const identity={provider:'ITESSA',supplier_id:'s',yarn:'Baby Alpaca',yarn_id:'y',color_id:'c',fiber:'Baby alpaca',composition:'100% Baby Alpaca',title:'2/28',code:'201'};
const seed=()=>({suppliers:[{id:'s',name:'ITESSA'}],yarns:[{id:'y',supplier_id:'s',name:'Baby Alpaca',fiber:'Baby alpaca',composition:'100% Baby Alpaca',title:'2/28'}],colors:[{id:'c',yarn_id:'y',name:'Rojo',code:'201'}],photos:[{id:'p',color_id:'c',yarn_id:'y',active:true,rights_confirmed:true,verification_status:'verified',source_identity:identity,storage_full:'private/full.webp',storage_thumb:'private/thumb.webp'}]});
test('la relación visual conserva las cantidades y sigue la ficha al corregir su nombre',()=>{
 const data=seed(),before=structuredClone(item);data.photos=[];assert.equal(inventoryColorRecord(item,data).color.id,'c');data.colors[0].color_profile={bound_item_ids:['item']};data.colors[0].name='Rojo granate';assert.equal(inventoryColorRecord(item,data).color.name,'Rojo granate');assert.deepEqual(item,before);
});
test('la imagen depende del color y código; no impone composición, proveedor ni título a las prendas',()=>{
 for(const change of [{supplier:'INCA TOPS',commercial_name:'MUHU'},{commercial_name:'Kori'},{composition:'100% Royal Alpaca'},{yarn_title:'2/16'}])assert.equal(inventoryColorPhoto({...item,...change},seed()).photo.id,'p');
 for(const change of [{color_code:'0201'},{color_code:''},{color:'Azul'}])assert.equal(inventoryColorPhoto({...item,...change},seed()),null);
});
test('las referencias eliminadas o de otro código no aparecen y se respeta la selección explícita',()=>{
 for(const change of [{active:false},{rights_confirmed:false},{deleted_at:new Date().toISOString()},{source_identity:{...identity,code:'202'}}]){const data=seed();Object.assign(data.photos[0],change);assert.equal(inventoryColorPhoto(item,data),null);}
 const data=seed();data.colors.push({...data.colors[0],id:'c2',yarn_id:'y2'});data.yarns.push({...data.yarns[0],id:'y2'});data.photos.push({...data.photos[0],id:'p2',color_id:'c2',yarn_id:'y2',storage_full:'private/other.webp'});assert.equal(inventoryColorPhoto({...item,source_snapshot:{_textile_color_id:'c2'}},data).photo.id,'p2');assert.equal(inventoryColorMatches(item,data).length,2);
});
