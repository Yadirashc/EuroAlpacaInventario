import test from 'node:test';
import assert from 'node:assert/strict';
import {textileDeletionBlocker,createTextileDeletion} from '../src/textile-deletion.mjs';

test('la eliminación respeta stock, requerimientos pendientes y colores vinculados',()=>{
 const data={colors:[{id:'red',yarn_id:'y',active:false}],stock:[],requirements:[]};
 assert.match(textileDeletionBlocker('yarns',{id:'y'},data),/primero sus 1 colores/);
 data.colors[0].deleted_at='now';assert.equal(textileDeletionBlocker('yarns',{id:'y'},data),'');
 data.stock.push({color_id:'red',stock_kg:1.5});assert.match(textileDeletionBlocker('colors',{id:'red'},data),/stock/);
 data.stock[0].stock_kg=0;data.requirements.push({color_id:'red',status:'Pendiente'});assert.match(textileDeletionBlocker('colors',{id:'red'},data),/requerimientos/);
 data.requirements[0].status='Cancelado';assert.equal(textileDeletionBlocker('colors',{id:'red'},data),'');
});

test('solo administración ve los registros para eliminar y los nombres se muestran como texto',()=>{
 const data={colors:[{id:'c',name:'<img src=x onerror=alert(1)>',code:'1',yarn_id:'y'},{id:'deleted',name:'No mostrar',deleted_at:'now'}],yarns:[{id:'y',name:'MUHU',supplier_id:'s'}],suppliers:[{id:'s',name:'INCA TOPS'}],stock:[],requirements:[]};let admin=false;
 const view=createTextileDeletion({data:()=>data,admin:()=>admin,heading:(a,b)=>a+' '+b});
 assert.match(view.render(),/exclusivo/);assert.ok(!view.render().includes('onerror'));
 admin=true;const html=view.render();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('No mostrar'));assert.ok(html.includes('Eliminar seleccionados (0)'));
});
