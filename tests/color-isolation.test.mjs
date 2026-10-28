import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDb} from './helpers/memory-db.mjs';
import {saveColorProfile,readColorProfiles} from '../server/color-profiles.mjs';
import {applyColorProfiles,garmentColorChoices} from '../src/color-profile.mjs';
import {catalogColorGroups,normalizeTextileData} from '../src/textile-catalog.mjs';
import {inventoryColorRecord} from '../src/inventory-color-photos.mjs';
import {saveLocalColorProfile} from '../src/color-profile-local.mjs';

const seed=()=>({textile_suppliers:[{id:'inca',code:'INCATOPS',name:'INCA TOPS',stage:'production',active:true},{id:'itessa',code:'ITESSA',name:'ITESSA',stage:'production',active:true}],textile_yarns:[{id:'y',stage:'production',supplier_id:'inca',name:'MUHU',fiber:'Baby alpaca',composition:'100% Baby alpaca',title:'2/28',reference_key:'shared',active:true}],textile_colors:[{id:'red',stage:'production',yarn_id:'y',name:'Rojo',code:'8080',reference_key:'red',active:true},{id:'duplicate',stage:'production',yarn_id:'y',name:'Rojo',code:'8080',reference_key:'duplicate',active:true}],textile_photos:[],textile_stock:[{id:'stock',color_id:'red',stock_kg:4.5}],items:['a','b','c'].map((id,i)=>({id,name:'Modelo '+id,color:'Rojo',color_code:'8080',size:'M',location:'Lima',quantity:i+1,material:'Original',supplier:'Original',archived:false,source_snapshot:{COLOR:'Rojo',origin:id,...(id==='b'?{_textile_color_id:'red'}:{})}}))});
const body={color_id:'red',name:'Rojo',code:'8080',family:'Sólidos',yarn_name:'MUHU',fiber:'Baby alpaca',composition:'100% Baby alpaca',title:'2/28',supplier_id:'itessa'};
async function view(state,c){return applyColorProfiles(normalizeTextileData({suppliers:state.textile_suppliers,yarns:state.textile_yarns,colors:state.textile_colors,photos:state.textile_photos}),await readColorProfiles(c));}

test('editar una prenda con color compartido conserva todas las demás y la ficha original',async()=>{
 const {state,db}=memoryDb(seed()),before=structuredClone(state),c={db,stage:'production',profile:{id:'admin',role:'admin'}};
 const result=await saveColorProfile(c,{...body,item_ids:['a'],name:'Granate',code:'9000'});
 assert.notEqual(result.color_id,'red');assert.deepEqual(state.items.slice(1),before.items.slice(1));
 assert.deepEqual(state.textile_colors.slice(0,2),before.textile_colors);assert.deepEqual(state.textile_yarns[0],before.textile_yarns[0]);assert.deepEqual(state.textile_stock,before.textile_stock);
 const a=state.items[0];assert.equal(a.quantity,1);assert.equal(a.color,'Granate');assert.equal(a.color_code,'9000');assert.equal(a.source_snapshot.origin,'a');assert.equal(a.source_snapshot.COLOR,'Rojo');assert.equal(a.source_snapshot._textile_color_id,result.color_id);
 let data=await view(state,c);assert.equal(inventoryColorRecord(a,data).color.id,result.color_id);assert.equal(inventoryColorRecord(state.items[1],data).color.id,'red');
 const count=state.textile_colors.length;const second=await saveColorProfile(c,{...body,color_id:result.color_id,item_ids:['a'],code:'9001'});
 assert.equal(second.color_id,result.color_id);assert.equal(state.textile_colors.length,count);assert.deepEqual(state.items.slice(1),before.items.slice(1));
 await saveColorProfile(c,{...body,color_id:result.color_id,code:'9004'});assert.equal(state.items[0].color_code,'9004');assert.deepEqual(state.items.slice(1),before.items.slice(1));
});

test('cambios sucesivos de proveedor con el mismo nombre y código no vuelven a agrupar prendas',async()=>{
 const {state,db}=memoryDb(seed()),c={db,stage:'production',profile:{id:'admin',role:'admin'}};
 const first=await saveColorProfile(c,{...body,item_ids:['a']});
 const second=await saveColorProfile(c,{...body,item_ids:['b']});
 assert.notEqual(first.color_id,second.color_id);
 const data=await view(state,c);
 for(const [itemId,colorId] of [['a',first.color_id],['b',second.color_id],['c','red']])assert.equal(inventoryColorRecord(state.items.find(i=>i.id===itemId),data).color.id,colorId);
 assert.equal(garmentColorChoices(data,'a').find(c=>c.code==='8080').id,first.color_id);
 assert.ok(!garmentColorChoices(data).some(c=>[first.color_id,second.color_id].includes(c.id)));
 const groups=catalogColorGroups(data.colors,data.yarns);assert.ok(groups.some(g=>g.color_group.length===1&&g.id===first.color_id));assert.ok(groups.some(g=>g.color_group.length===1&&g.id===second.color_id));
});

test('de una lista marcada se puede modificar después una sola prenda sin cambiar la otra',async()=>{
 const {state,db}=memoryDb(seed()),c={db,stage:'production',profile:{id:'admin',role:'admin'}};
 const shared=await saveColorProfile(c,{...body,item_ids:['a','b']});const b=structuredClone(state.items[1]);
 const single=await saveColorProfile(c,{...body,color_id:shared.color_id,item_ids:['a'],code:'9002'});
 assert.notEqual(shared.color_id,single.color_id);assert.deepEqual(state.items[1],b);
 const data=await view(state,c);assert.equal(inventoryColorRecord(state.items[0],data).color.id,single.color_id);assert.equal(inventoryColorRecord(state.items[1],data).color.id,shared.color_id);
});

test('editar una ficha textil no actualiza sus alias ni un hilo que aún usan otros colores',async()=>{
 const initial=seed();initial.textile_photo_sources=[{stage:'production',source_key:'color-profile:red',result:{color_id:'red',alias_ids:['red','duplicate'],bound_item_ids:['a','b','c']}}];
 const {state,db}=memoryDb(initial),before=structuredClone(state),c={db,stage:'production',profile:{id:'admin',role:'admin'}};
 await saveColorProfile(c,{...body,name:'Granate',code:'9003'});
 assert.deepEqual(state.textile_colors.find(c=>c.id==='duplicate'),before.textile_colors.find(c=>c.id==='duplicate'));assert.deepEqual(state.items,before.items);assert.deepEqual(state.textile_yarns[0],before.textile_yarns[0]);
 assert.equal((await readColorProfiles(c)).find(p=>p.color_id==='red').alias_ids.length,1);
});

test('la vista local también aísla las prendas y rechaza una selección vacía',()=>{
 const source=seed(),data=applyColorProfiles(normalizeTextileData({suppliers:source.textile_suppliers,yarns:source.textile_yarns,colors:source.textile_colors,photos:[]})),before=structuredClone(source.items);let n=0;
 const result=saveLocalColorProfile(data,source.items,{...body,item_ids:['a'],code:'9999'},()=>String(++n));
 assert.deepEqual(source.items.slice(1),before.slice(1));assert.equal(source.items[0].source_snapshot._textile_color_id,result.color_id);
 assert.throws(()=>saveLocalColorProfile(data,source.items,{...body,item_ids:[]},()=>String(++n)),/Selecciona/);
});
