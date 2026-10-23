import {normalize} from './domain.mjs';
import {compositionKey} from './composition.mjs';
import {displayYarnTitle} from './yarn.mjs';
import {providerKey,colorCode} from './photo-identity.mjs';

export const textileCatalog=[
 {key:'muhu',name:'MUHU',fiber:'Baby alpaca',composition:'100% Baby alpaca',provider:'INCA TOPS',providerCode:'INCATOPS'},
 {key:'cancas',name:'CANCAS',fiber:'Baby alpaca + algodón',composition:'15% baby alpaca + 85% algodón Tangüis',provider:'ITESSA',providerCode:'ITESSA'},
 {key:'baby-itessa',name:'BABY ALPACA',fiber:'Baby alpaca',composition:'100% Baby alpaca',provider:'ITESSA',providerCode:'ITESSA'},
 {key:'kori',name:'KORI',fiber:'Royal Alpaca',composition:'100% Royal alpaca',provider:'INCA TOPS',providerCode:'INCATOPS'},
 {key:'majestic',name:'Majestic',fiber:'Majestic / Imperial Alpaca',composition:'100% Imperial alpaca',provider:'INCA TOPS',providerCode:'INCATOPS'},
 {key:'baby-microfibra',name:'BABY MICROFIBRA',fiber:'Baby alpaca + microfibra',composition:'30% baby alpaca + 70% microfibra',provider:'ITESSA',providerCode:'ITESSA'},
 {key:'eco-baby-pet',name:'Eco baby PET',fiber:'Baby alpaca + PET',composition:'30% baby alpaca + 70% PET',provider:'ITESSA',providerCode:'ITESSA'}
];
export const textileFibers=[...new Set(textileCatalog.map(row=>row.fiber))];
const text=value=>normalize(value).replace(/[^A-Z0-9]/g,'');
export function catalogProduct(row,supplier){
 const name=text(row.commercial_name||row.name),composition=compositionKey(row.composition),provider=providerKey(supplier?.code||supplier?.name||row.supplier||'');
 let key=name.includes('MUHU')?'muhu':name.includes('CANCAS')?'cancas':name.includes('KORI')?'kori':name.includes('MAJESTIC')?'majestic':name.includes('BABYMICROFIBRA')?'baby-microfibra':name.includes('ECOBABYPET')?'eco-baby-pet':null;
 if(!key){const matches=textileCatalog.filter(product=>composition&&compositionKey(product.composition)===composition);if(matches.length===1)key=matches[0].key;else if(matches.some(product=>product.key==='muhu'))key=provider==='incatops'?'muhu':'baby-itessa';}
 if(!key&&!composition){const fiber=text(row.fiber||row.material);if(fiber==='BABYALPACA')key=provider==='incatops'?'muhu':'baby-itessa';}
 return textileCatalog.find(product=>product.key===key)||null;
}
export function canonicalInventoryItem(item){const product=catalogProduct(item);return product?{...item,supplier:product.provider,commercial_name:product.name,material:product.fiber,composition:product.composition,yarn_title:displayYarnTitle(item.yarn_title)}:item;}
export function normalizeTextileData(input){
 const data={...input,suppliers:input.suppliers.map(row=>{const key=providerKey(row.code||row.name);return {...row,...(key==='incatops'?{name:'INCA TOPS',code:'INCATOPS'}:key==='itessa'?{name:'ITESSA',code:'ITESSA'}:{})};})};
 data.yarns=input.yarns.map(row=>{const original=row.catalog_original||row,supplier=data.suppliers.find(s=>s.id===row.supplier_id),product=catalogProduct(row,supplier),target=product&&data.suppliers.find(s=>providerKey(s.code||s.name)===providerKey(product.providerCode));return product&&target?{...row,name:product.name,fiber:product.fiber,composition:product.composition,supplier_id:target.id,title:displayYarnTitle(row.title),catalog_key:product.key,catalog_original:original}:{...row,catalog_key:null,catalog_original:original};});
 data.photos=input.photos.map(row=>{
  if(!row.color_id||!row.source_identity)return row;
  const color=input.colors.find(c=>c.id===row.color_id),yarn=color&&data.yarns.find(y=>y.id===color.yarn_id),product=yarn&&textileCatalog.find(p=>p.key===yarn.catalog_key);if(!product)return row;
  const original=row.catalog_source_identity||row.source_identity;
  if(catalogProduct({name:original.yarn,fiber:original.fiber,composition:original.composition,supplier:original.provider})?.key!==product.key)return {...row,verification_status:'pending',catalog_photo_review:true};
  if(row.source_url&&row.source_url!=='manual'&&providerKey(original.provider)!==providerKey(product.provider))return {...row,verification_status:'pending',catalog_photo_review:true};
  return {...row,catalog_source_identity:original,source_identity:{...original,provider:product.provider,supplier_id:yarn.supplier_id,yarn:product.name,fiber:product.fiber,composition:product.composition,title:yarn.title}};
 });
 return data;
}
export function catalogYarnGroups(rows,suppliers){
 const groups=new Map();for(const row of rows){const key=row.catalog_key?row.supplier_id+'|'+row.catalog_key:row.id;if(!groups.has(key))groups.set(key,{...row,yarn_group:[]});groups.get(key).yarn_group.push(row);}
 return [...groups.values()].map(group=>({...group,titles:[...new Set(group.yarn_group.map(row=>row.title||'Por confirmar'))].sort(),title:[...new Set(group.yarn_group.map(row=>row.title||'Por confirmar'))].sort().join(' · ')})).sort((a,b)=>(suppliers.find(s=>s.id===a.supplier_id)?.name||'').localeCompare(suppliers.find(s=>s.id===b.supplier_id)?.name||'','es')||a.fiber.localeCompare(b.fiber,'es')||a.name.localeCompare(b.name,'es'));
}
export function catalogColorGroups(colors,yarns){
 const groups=new Map();for(const color of colors.flatMap(row=>row.color_group||[row])){const yarn=yarns.find(y=>y.id===color.yarn_id),code=text(colorCode({code:color.code,provider:textileCatalog.find(p=>p.key===yarn?.catalog_key)?.provider||''})),key=yarn?.catalog_key?JSON.stringify([yarn.supplier_id,yarn.catalog_key,yarn.title,code||text(color.name)]):color.id;if(!groups.has(key))groups.set(key,{...color,color_group:[]});if(!groups.get(key).color_group.some(row=>row.id===color.id))groups.get(key).color_group.push(color);}
 return [...groups.values()].map(group=>{const rows=group.color_group.sort((a,b)=>String(b.updated_at||'').localeCompare(String(a.updated_at||'')));return {...rows[0],color_group:rows};});
}
