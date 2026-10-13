import fs from 'node:fs';
import crypto from 'node:crypto';
import {parseCSV} from '../src/csv.mjs';
import {normalize,quantity} from '../src/domain.mjs';
const source=fs.readFileSync('data/source.csv','utf8');
const local=JSON.parse(fs.readFileSync('data/local-reference.json','utf8').replace(/^\uFEFF/,''));
const sections=source.split('\f');
const locations=['Muestras / revisión','Producción Perú','España'];
const models=new Map(), rows=[], warnings=[];
const id=s=>{const h=crypto.createHash('md5').update(s).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;};
for(let sec=0;sec<sections.length;sec++){
 const parsed=parseCSV(sections[sec].trim()); const hi=parsed.findIndex(r=>r.some(v=>normalize(v)==='PRENDA'));if(hi<0)continue;
 const headers=parsed[hi].map(normalize); const get=(r,k)=>String(r[headers.indexOf(k)]??'').trim();
 for(let i=hi+1;i<parsed.length;i++){const r=parsed[i];const category=get(r,'PRENDA');if(!category)continue;
 const desc=get(r,'DESCRIPCION DE PRENDA')||get(r,'DESCRIPCION DE PRENDAS'); const name=get(r,'NOMBRE')||desc||category;
 const key=normalize(category+'|'+name);if(!models.has(key))models.set(key,'EA-'+String(models.size+1).padStart(4,'0'));
 const location=sec===1?'Lima':locations[sec]||`Hoja ${sec+1}`;
 const row={id:id(`source-${sec}-${i}`),model_code:models.get(key),name,category,description:desc,material:get(r,'MATERIAL'),commercial_name:get(r,'N. COMERCIAL'),composition:get(r,'COMPOSICION'),material_code:get(r,'CODIGO'),color:get(r,'COLOR'),color_code:get(r,'C. DE COLOR'),size:get(r,'TALLA'),location,status:get(r,'ESTATUS'),production_state:get(r,'ESTADO'),supplier:get(r,'PROVEEDOR'),quantity:quantity(get(r,'CANTIDAD')),min_stock:2,notes:get(r,'OBSERVACIONES'),inventory_type:get(r,'INVENTARIO'),threads:get(r,'CANT. - HEBRAS')||get(r,'HEBRAS'),yarn_title:get(r,'TITULO'),gender:get(r,'GENERO'),weight:get(r,'PESO - PRENDAS'),production_weight:get(r,'PESO -PRODUCCION'),source_sheet:sec+1,source_row:i,review_required:false};
 const localMatch=local.find(x=>normalize(x.modelo)===normalize(name)&&normalize(x.prenda)===normalize(category)&&normalize(x.color)===normalize(row.color)&&normalize(x.talla)===normalize(row.size)&&normalize(x.descripcion)===normalize(desc));
 if(localMatch && sec>=2)row.location=localMatch.lugar;
 row.threads ||= get(r,'N° HEBRAS');
 row.sku=`${row.model_code}-${row.material_code||'MAT'}-${normalize(row.color_code||row.color||'SIN-COLOR').replace(/[^A-Z0-9]/g,'').slice(0,18)}-${row.size||'ST'}-R${sec+1}${String(i).padStart(3,'0')}`;
 if(row.quantity===null||!row.color||!row.size||/\d{4}-\d{2}-\d{2}/.test(row.yarn_title)){row.review_required=true;warnings.push({sku:row.sku,reason:'Dato faltante o título de hilo convertido a fecha en origen'});}
 rows.push(row);
 }
}
const keys=new Map(); for(const r of rows){const k=[r.model_code,r.material,r.color,r.size,r.location,r.status,r.production_state].map(normalize).join('|');if(!keys.has(k))keys.set(k,[]);keys.get(k).push(r);}
for(const group of keys.values())if(group.length>1)for(const r of group){r.review_required=true;warnings.push({sku:r.sku,reason:'Combinación repetida: revisar antes de consolidar'});}
fs.mkdirSync('data',{recursive:true});fs.mkdirSync('supabase',{recursive:true});
fs.writeFileSync('data/inventory.json',JSON.stringify(rows,null,2));
fs.writeFileSync('data/revision.json',JSON.stringify({source:'INVENTARIO PRENDAS.xlsx',source_url:'https://docs.google.com/spreadsheets/d/1tpLM4RnS6_qBUkDjNbayB3JM4RhK3qLZ/edit',sections:sections.length,models:models.size,rows:rows.length,units:rows.reduce((s,r)=>s+(r.quantity||0),0),warnings},null,2));
const quote=v=>v===null?'NULL':typeof v==='number'?String(v):typeof v==='boolean'?String(v):"'"+String(v).replaceAll("'","''")+"'";
const cols=Object.keys(rows[0]);fs.writeFileSync('supabase/seed.sql','-- Inventario privado: no publicar este archivo. Reimportar no modifica registros existentes.\nBEGIN;\nINSERT INTO public.items ('+cols.join(',')+') VALUES\n'+rows.map(r=>'('+cols.map(k=>quote(r[k])).join(',')+')').join(',\n')+'\nON CONFLICT (id) DO NOTHING;\nCOMMIT;\n');
console.log(JSON.stringify({sections:sections.length,models:models.size,rows:rows.length,units:rows.reduce((s,r)=>s+(r.quantity||0),0),review:rows.filter(r=>r.review_required).length,locations:[...new Set(rows.map(r=>r.location))]}));
