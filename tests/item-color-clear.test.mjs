import test from 'node:test';
import assert from 'node:assert/strict';
import {clearItemColors} from '../server/item-color-clear.mjs';
import {memoryDb} from './helpers/memory-db.mjs';
import {visualColorMatches} from '../src/color-profile.mjs';

test('quitar color solo borra los campos de los registros elegidos y conserva prendas y cantidades',async()=>{
 const items=['a','b'].map(id=>({id,color:'Rojo',color_code:'8080',quantity:7,archived:false,source_snapshot:{COLOR:'Rojo',origin:id,_textile_color_id:'red'}}));
 const before=structuredClone(items),{state,db}=memoryDb({items});
 await clearItemColors({db,profile:{id:'admin',role:'admin'}},{item_ids:['a']});
 assert.deepEqual(state.items[1],before[1]);assert.equal(state.items[0].quantity,7);assert.equal(state.items[0].color,'');assert.equal(state.items[0].color_code,'');assert.equal(state.items[0].source_snapshot.COLOR,'Rojo');assert.equal(state.items[0].source_snapshot.origin,'a');assert.equal(state.items[0].source_snapshot._textile_color_id,undefined);
 assert.equal(visualColorMatches(state.items[0],{id:'red',name:'Rojo',code:'8080',color_profile:{bound_item_ids:['a','b']}}),false);
 assert.equal(visualColorMatches({...state.items[0],source_snapshot:{...state.items[0].source_snapshot,_textile_color_id:'new'}},{id:'new'}),true);
});

test('quitar color rechaza consulta, listas vacías y prendas inexistentes',async()=>{
 await assert.rejects(clearItemColors({profile:{role:'consulta'}},{}),/Solo administradora/);
 const {db}=memoryDb({items:[]}),c={db,profile:{role:'admin'}};
 await assert.rejects(clearItemColors(c,{item_ids:[]}),/Selecciona/);
 await assert.rejects(clearItemColors(c,{item_ids:['missing']}),/ya no está disponible/);
});
