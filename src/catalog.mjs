import {normalize} from './domain.mjs';
export const segment=s=>normalize(s).replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'');
export const modelKey=r=>categoryCode(r.category)+'|'+normalize(r.name).replace(/\s+/g,' ').trim();
export function canonicalModelRows(rows){const canonical=new Map();for(const r of rows){const identity=modelIdentity(r),key=modelKey(r),n=Number(identity.code.match(/\d+$/)?.[0]||999);if(!canonical.has(key)||n<canonical.get(key).n)canonical.set(key,{...identity,n});}return rows.map(r=>{const model=canonical.get(modelKey(r));return {...r,model_code:model.code,sku:r.sku||inventorySku({...r,model_code:model.code})};});}
const shortNames={
 'EA-0001':['Bufanda petinets','BUF-PETINETS'], 'EA-0002':['Bufanda ajedrez 4×4','BUF-AJEDREZ4X4'],
 'EA-0003':['Vestido trenzas','VES-TRENZAS'],'EA-0004':['Vestido Majestic','VES-MAJESTIC'],
 'EA-0005':['Vestido raport · 2 colores','VES-RAPORT2C'],'EA-0006':['Vestido raport · 4 colores','VES-RAPORT4C'],
 'EA-0007':['Vestido crochet','VES-CROCHET'],'EA-0008':['Vestido petinets','VES-PETINETS'],
 'EA-0009':['Falda crochet','FAL-CROCHET'],'EA-0010':['Blusa crochet','BLU-CROCHET'],
 'EA-0015':['Chompa rambla · cuello redondo','CHO-RAMBLA-REDONDO'],
 'EA-0016':['Cardigan · manga acampanada','CAR-ACAMPANADO'],
 'EA-0018':['Cardigan · cuello redondo','CAR-REDONDO'],
 'EA-0019':['Chompa · cuello amplio','CHO-CUELLOAMPLIO'],
 'EA-0020':['Vestido aranes · un hombro','VES-ARANES-HOMBRO'],
 'EA-0021':['Chompa · cuello camisero','CHO-CAMISERO-BA'],
 'EA-0022':['Bufanda básica','BUF-BASICA'],
 'EA-0027':['Chompa · cuello camisero','CHO-CAMISERO-NU'],
 'EA-0028':['Bufanda básica con flecos','BUF-FLECOS']
};
export function categoryCode(category){const c=normalize(category);return c.startsWith('CHOMPA')?'CHO':c.startsWith('VESTIDO')?'VES':c.startsWith('BUFANDA')?'BUF':c.startsWith('CARDIGAN')?'CAR':c.startsWith('FALDA')?'FAL':c.startsWith('BLUSA')?'BLU':c.startsWith('CHAL')?'CHA':segment(c).slice(0,8)||'PRE';}
export const materialLegend={BA:'Baby Alpaca',AC:'Baby Alpaca + algodón',AM:'Baby Alpaca + microfibra',AP:'Baby Alpaca + PET',RA:'Royal Alpaca',IA:'Imperial Alpaca / Majestic',MT:'Material sin clasificar'};
export const colorLegend={MO:'Mostaza',MA:'Marrón',RO:'Rojo',LA:'Lacre',AG:'Azul + gris',MX:'Marrón + beige + piste + suavizado',OA:'Oatmeal',SC:'Sin color registrado',SU:'Suavizado',OL:'Olivo',BE:'Beige',GU:'Guinda',NE:'Negro',GM:'Gris matizado',SA:'Salmón',PA:'Pan',CE:'Celeste',VP:'Verde pistacho',AN:'Azul marino',CF:'Café',AO:'Azul noche',PC:'Plomo carbón',CC:'Calcaire (celeste)',AZ:'Azul',CA:'Camello',PI:'Piste (coral)',HU:'Hueso',RS:'Rosado'};
const colorCodes=Object.fromEntries(Object.entries(colorLegend).map(([code,name])=>[normalize(name),code]));
export function colorCode(color){return colorCodes[normalize(color)]||segment(color).replaceAll('-','').slice(0,2)||'SC';}
export function modelIdentity(r){if(/^[A-Z]{2}\d{2}$/.test(r.model_code||''))return {name:r.name,code:r.model_code};const explicit=shortNames[r.model_code],name=explicit?.[0]||r.name;const original=String(r.model_code||'').match(/^EA-00(\d{2})$/);const number=original?.[1]||String(r.model_number||99).padStart(2,'0');const meaningful=normalize(name).replace(/^(BUFANDA|VESTIDO|CHOMPA|CARDIGAN|FALDA|BLUSA|CHAL)\s*/,'').replace(/^\W+/,'');const prefix=meaningful.replace(/[^A-Z]/g,'').slice(0,2)||categoryCode(r.category).slice(0,2);return {name,code:prefix+number};}
export function materialCode(r){const m=normalize(r.composition+' '+r.material);return m.includes('IMPERIAL')||m.includes('MAJESTIC')?'IA':m.includes('ROYAL')?'RA':m.includes('ALGODON')?'AC':m.includes('MICROFIBRA')?'AM':m.includes('PET')?'AP':m.includes('BABY ALPACA')?'BA':'MT';}
export function sizeCode(size){const n=normalize(size);return !n?'ST':n==='NO CALIFICA'||n==='UNICA'?'U':segment(n);}
export function variantSku(r){return modelIdentity(r).code;}
export function inventorySku(r){return r.sku||'R'+String(r.id||'').replaceAll('-','').toUpperCase();}
export function skuLegend(r){const model=modelIdentity(r);return [{code:model.code.slice(0,2),label:'Diseño: '+model.name},{code:model.code.slice(2),label:'Número de modelo'}];}
export function recodeItem(r){const identity=modelIdentity(r);return {...r,name:identity.name,model_code:identity.code,sku:inventorySku({...r,name:identity.name,model_code:identity.code})};}
export function modelVariants(rows){const map=new Map();for(const r of rows){const sku=variantSku(r),key=JSON.stringify([sku,normalize(r.material),normalize(r.composition),normalize(r.color),normalize(r.size)]);if(!map.has(key))map.set(key,{sku,material:r.material,material_code:materialCode(r),composition:r.composition,color:r.color,color_code:r.color_code,size:r.size,items:[]});map.get(key).items.push(r);}const order={XXS:0,XS:1,S:2,M:3,L:4,XL:5,XXL:6,'NO CALIFICA':7,UNICA:7,'ÚNICA':7,'':8};return [...map.values()].sort((a,b)=>a.material.localeCompare(b.material,'es')||a.color.localeCompare(b.color,'es')||(order[a.size]??9)-(order[b.size]??9)||a.size.localeCompare(b.size,'es'));}
export function publicCatalog(rows){const groups=new Map();for(const r of rows.filter(r=>!r.archived)){const identity=modelIdentity(r);if(!groups.has(identity.code))groups.set(identity.code,[]);groups.get(identity.code).push(r);}return [...groups.values()].map(candidates=>{const identity=modelIdentity(candidates[0]);const variants=modelVariants(candidates).map(v=>({sku:v.sku,material:v.material,material_code:v.material_code,composition:v.composition,color:v.color,color_code:v.color_code,size:v.size,available:v.items.some(r=>r.quantity>0&&normalize(r.status)==='DISPONIBLE'&&normalize(r.production_state)==='TERMINADO')}));return {name:identity.name,model_code:identity.code,category:candidates[0].category,compositions:[...new Set(variants.map(v=>v.composition).filter(Boolean))],materials:[...new Set(variants.map(v=>v.material).filter(Boolean))],colors:[...new Set(variants.map(v=>v.color).filter(Boolean))],sizes:[...new Set(variants.map(v=>v.size).filter(Boolean))],variants};});}
