import test from 'node:test';
import assert from 'node:assert/strict';
import {workbookRows,reconcileRows} from '../scripts/workbook-sync.mjs';
import {sourceSheets,sourceColumns,excelCell} from '../src/excel-view.mjs';

test('lee ubicación, lotes combinados y cantidades sin convertir vacíos a cero',()=>{
 const sheet={id:3,name:'INFO DE ENVIOS',rows:[{row:1,values:['N° PRODUCCION','UBICACIÓN','PRENDA','NOMBRE','TÍTULO','CANTIDAD']},{row:80,values:[4,'ESPAÑA','CHOMPA','KINTI','2026-02-18',2]}]};
 const [item]=workbookRows([sheet]);assert.equal(item.quantity,2);assert.equal(item.location,'España');assert.equal(item.production_lot,'4');assert.equal(item.yarn_title,'18/2');assert.equal(item.source_row,80);
 sheet.rows[1].values[5]='';assert.throws(()=>workbookRows([sheet]),/Cantidad inválida/);
 assert.deepEqual(sourceSheets,['INFO PRODUCCIÓN','INFO DE ENVIOS']);assert.equal(sourceColumns['INFO DE ENVIOS'][1],'UBICACIÓN');assert.equal(excelCell({...item,location:'Lima'},'UBICACIÓN'),'Lima');assert.equal(excelCell(item,'N° PRODUCCION'),'4');
});
test('reutiliza la misma prenda trasladada y no consume una coincidencia exacta con otra talla',()=>{
 const base={name:'Kinti',category:'Chompa',material:'Baby alpaca',composition:'100% Baby Alpaca',color:'Guinda',color_code:'6330',production_state:'Terminado',size:'S',quantity:1};
 const candidates=[{...base,id:'s',location:'Lima'},{...base,id:'m',size:'M',location:'España'}];
 const targets=[{...base,location:'España'},{...base,size:'M',location:'Lima'},{...base,size:'L',location:'España'}];
 const plan=reconcileRows(targets,candidates);assert.deepEqual(plan.matched.map(p=>p.current.id),['s','m']);assert.equal(plan.created.length,1);assert.equal(plan.created[0].size,'L');assert.equal(plan.retired.length,0);
});
test('conserva los identificadores de las filas de origen revisadas aunque el Excel corrija el modelo',()=>{
 const old={id:'old',source_row:66,source_sheet:3,name:'Allin',category:'Bufanda',material:'Baby alpaca + algodón',size:'NO CALIFICA'};
 const target={...old,name:'Kuyay',material:'Baby alpaca'};delete target.id;
 const plan=reconcileRows([target],[old],{anchor:(t,c)=>t.source_sheet===c.source_sheet&&t.source_row===c.source_row});assert.equal(plan.matched[0].current.id,'old');assert.equal(plan.created.length,0);
});
