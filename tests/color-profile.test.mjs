import test from 'node:test';import assert from 'node:assert/strict';
import {memoryDb} from './helpers/memory-db.mjs';
import {saveColorProfile,readColorProfiles} from '../server/color-profiles.mjs';
import {applyColorProfiles,chromaticFamily,garmentColorChoices,visualColorMatches,colorReferencePhoto} from '../src/color-profile.mjs';
import {normalizeTextileData} from '../src/textile-catalog.mjs';
const initial=()=>({textile_suppliers:[{id:'inca',stage:'production',code:'INCATOPS',name:'INCA TOPS',active:true},{id:'itessa',stage:'production',code:'ITESSA',name:'ITESSA',active:true}],textile_yarns:[{id:'y',stage:'production',supplier_id:'inca',name:'MUHU',code:'BA',fiber:'Baby alpaca',composition:'100% Baby alpaca',title:'2/28',active:true}],textile_colors:[{id:'red',stage:'production',yarn_id:'y',name:'Rojo',code:'8080',family:'Cálidos',reference_key:'red',active:true},{id:'blue',stage:'production',yarn_id:'y',name:'Azul',code:'8081',family:'Fríos',reference_key:'blue',active:true}],textile_photos:[],items:[{id:'item',name:'Prenda',color:'Rojo',color_code:'8080',quantity:12,material:'Material original',supplier:'Proveedor original',archived:false}],textile_stock:[{color_id:'red',stock_kg:4.5}]});
test('familias simples y selector de prendas solo con nombre/código',()=>{
 assert.equal(chromaticFamily({family:'Neutros',name:'Beige'}),'Neutros');assert.equal(chromaticFamily({name:'Gris matizado',family:'Fríos'}),'Melange');assert.equal(chromaticFamily({name:'Rojo',family:'Cálidos'}),'Sólidos');
 assert.deepEqual(garmentColorChoices({colors:[{id:'a',name:'Rojo',code:'8080',supplier:'No mostrar',composition:'No mostrar'},{id:'b',name:'Rojo',code:'8080'}]}),[{id:'a',name:'Rojo',code:'8080'}]);
});
test('editar proveedor e hilo de un color no cambia los demás ni las prendas y kilos',async()=>{
 const {state,db}=memoryDb(initial()),before=structuredClone(state),c={db,stage:'production',profile:{id:'admin',role:'admin'}};
 const body={color_id:'red',name:'Granate',code:'8080',family:'Melange',yarn_name:'MUHU',yarn_code:'BA',fiber:'Baby alpaca',composition:'100% Baby alpaca',title:'2/28',supplier_id:'itessa'};
 await saveColorProfile(c,body);assert.equal(state.textile_colors.find(c=>c.id==='blue').yarn_id,'y');assert.equal(state.textile_yarns.find(y=>y.id==='y').supplier_id,'inca');
 const red=state.textile_colors.find(c=>c.id==='red'),independent=state.textile_yarns.find(y=>y.id===red.yarn_id);assert.equal(independent.supplier_id,'itessa');assert.notEqual(red.yarn_id,'y');assert.deepEqual(state.items,before.items);assert.deepEqual(state.textile_stock,before.textile_stock);
 const profiles=await readColorProfiles(c),data=applyColorProfiles(normalizeTextileData({suppliers:state.textile_suppliers,yarns:state.textile_yarns,colors:state.textile_colors,photos:[]}),profiles),visual=data.colors.find(c=>c.id==='red');assert.equal(visual.family,'Melange');assert.equal(data.yarns.find(y=>y.id===visual.yarn_id).supplier_id,'itessa');assert.equal(visualColorMatches(state.items[0],visual,data.colors),true);
 const count=state.textile_yarns.length;await saveColorProfile(c,{...body,name:'Granate corregido',family:'Sólidos'});assert.equal(state.textile_yarns.length,count);assert.deepEqual(state.items,before.items);
});
test('se puede usar foto del hilo como referencia, sin compartir la ficha del proveedor',()=>{
 const photo={id:'p',yarn_id:'y',kind:'hilo',rights_confirmed:true,storage_full:'private/full.webp',storage_thumb:'private/thumb.webp'};assert.equal(colorReferencePhoto({id:'red',yarn_id:'y'},{photos:[photo]}).id,'p');
 assert.equal(visualColorMatches({color:'Rojo',color_code:'8080',quantity:2,composition:'Otra'}, {id:'red',name:'Rojo',code:'8080'}),true);
});
test('consulta no puede cambiar las fichas',async()=>{await assert.rejects(saveColorProfile({profile:{role:'consulta'}},{}),/Solo administradora/);});
