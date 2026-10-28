import {normalize} from '../src/domain.mjs';
import {cleanItem,cleanText} from '../src/text.mjs';
import {compositionKey} from '../src/composition.mjs';
import {categoryCode} from '../src/catalog.mjs';
import {displayYarnTitle} from '../src/yarn.mjs';

const fieldMap={UBICACION:'location',PRENDA:'category',NOMBRE:'name','DESCRIPCION DE PRENDAS':'description',ESTATUS:'status',MATERIAL:'material','N. COMERCIAL':'commercial_name',COMPOSICION:'composition',HEBRAS:'threads','N° HEBRAS':'threads',TITULO:'yarn_title',CODIGO:'material_code',COLOR:'color','C. DE COLOR':'color_code',PROVEEDOR:'supplier',ESTADO:'production_state',CANTIDAD:'quantity',TALLA:'size',GENERO:'gender',OBSERVACIONES:'notes','N° PRODUCCION':'production_lot'};
export function workbookRows(sheets){return sheets.flatMap(sheet=>{
 const headers=sheet.rows[0].values;
 return sheet.rows.slice(1).map(row=>{
  const snapshot=Object.fromEntries(headers.map((h,i)=>[String(h).trim(),row.values[i]??'']));
  const fields=Object.fromEntries(Object.entries(snapshot).map(([k,v])=>[fieldMap[normalize(k)],v]).filter(([k])=>k!=='undefined'));
  if(!Number.isInteger(fields.quantity)||fields.quantity<0)throw new Error(`Cantidad inválida: ${sheet.name}, fila ${row.row}`);
  for(const k of Object.keys(fields))if(k!=='quantity')fields[k]=cleanText(fields[k]);
  fields.yarn_title=displayYarnTitle(fields.yarn_title);
  return {...cleanItem(fields),source_sheet:sheet.id,source_sheet_name:sheet.name,source_row:row.row,source_snapshot:snapshot};
 });
});}
const compact=v=>normalize(v).replace(/[^A-Z0-9]/g,'');
export function variantKey(r,{state=true,code=true}={}){return JSON.stringify([
 categoryCode(r.category),normalize(r.name).replace(/^CONJUNTO\s+/,''),compact(r.material),compositionKey(r.composition),normalize(r.color),...(code?[compact(r.color_code)]:[]),normalize(r.size),...(state?[normalize(r.production_state)]:[])
]);}
export function originalVariant(item){const s=item.source_snapshot||{};const r={};for(const [k,v]of Object.entries(s)){const f=fieldMap[normalize(k)];if(f)r[f]=v;}return {...item,...r};}
export function reconcileRows(desired,candidates,{anchor=()=>false}={}){
 const matches=new Map(),used=new Set();
 // Only use origin anchors after reviewing that the source rows were retained.
 for(const target of desired){const found=candidates.filter(c=>anchor(target,c));if(found.length>1)throw new Error('Origen ambiguo');if(found.length){if(used.has(found[0].id))throw new Error('Origen repetido');matches.set(target,found[0]);used.add(found[0].id);}}
 for(const options of [{},{state:false},{state:false,code:false}]){
  for(const target of desired){if(matches.has(target))continue;
   const key=variantKey(target,options);
   const ranked=candidates.filter(c=>!used.has(c.id)&&(variantKey(c,options)===key||variantKey(originalVariant(c),options)===key)).map(c=>({c,score:
    (c.source_sheet===target.source_sheet&&c.source_row===target.source_row?100:0)+
    (normalize(c.location)===normalize(target.location)?30:0)+(c.quantity>0?10:0)+(c.quantity===target.quantity?3:0)
   })).sort((a,b)=>b.score-a.score||a.c.id.localeCompare(b.c.id));
   if(ranked.length){matches.set(target,ranked[0].c);used.add(ranked[0].c.id);}
  }
 }
 return {matched:desired.filter(t=>matches.has(t)).map(t=>({target:t,current:matches.get(t)})),created:desired.filter(t=>!matches.has(t)),retired:candidates.filter(c=>!used.has(c.id))};
}
