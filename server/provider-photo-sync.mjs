import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {records,rowIdentity,identityKey,sourceMatch,imageCandidates,officialURL,sourceResult,robotsAllows,safeFetch} from './color-photo-catalog.mjs';
import {compositionKey} from '../src/composition.mjs';
import {normalize} from '../src/domain.mjs';
import {providerKey,colorCode,verifiedPhoto,sameVariant} from '../src/photo-identity.mjs';
import {parseCSV} from '../src/csv.mjs';
import {savePhoto} from './photo-storage.mjs';

const hash=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const norm=value=>normalize(value).replace(/\s+/g,' ');
const methods=['essentials-html','official-html','official-json','official-csv'];
const configKey=id=>'photo-config:'+id;
const sourceKey=config=>'photo-page:'+hash([config.url,config.method,config.updated_at]);
const providerHosts={itessa:['itessa.com.pe','www.itessa.com.pe'],michell:['michell.com.pe','www.michell.com.pe'],incatops:['incatops.com','www.incatops.com','stockserviceessentials.com','www.stockserviceessentials.com']};
export function providerURL(value,provider){const u=officialURL(value);if(!providerHosts[providerKey(provider)]?.includes(u.hostname))throw new Error('El enlace no pertenece al proveedor del hilo.');return u.href;}
export async function photoSettings(c){const rows=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=like.photo-config:*',{service:true});return rows.map(row=>row.result?.config).filter(Boolean);}
export async function photoScheduleAvailable(c){if(process.env.TEXTILE_PHOTO_SYNC_ENABLED!=='true'||!process.env.TEXTILE_SYNC_ACTOR)return false;try{await c.db('rpc/confirm_color_photo_server',{method:'POST',service:true,body:{p_photo:{},p_actor:null}});}catch(e){return /Responsable de sincronización no autorizado/.test(e.message);}return false;}
function usable(config,i){return config&&config.identity_key===identityKey({...i,color_id:undefined,code:undefined})&&config.allow_lookup&&config.permission_reference?.length>=5&&(!config.expires_at||Date.parse(config.expires_at)>Date.now());}
function configIdentity(r,yarn){const i=rowIdentity(r,{yarn_id:yarn.id});return {...i,color_id:undefined,code:undefined};}
export async function savePhotoSettings(c,body){
 const r=await records(c),y=r.yarns.find(y=>y.id===body.yarn_id);if(!y)throw new Error('Selecciona un hilo existente.');
 const i=configIdentity(r,y),url=providerURL(body.url,i.provider);
 if(!methods.includes(body.method))throw new Error('Selecciona un método oficial compatible.');
 if(!body.identity_confirmed||!body.allow_lookup||String(body.permission_reference||'').trim().length<5)throw new Error('Confirma el producto exacto y registra la autorización para consultar esta fuente.');
 if(body.auto_confirm&&!body.allow_download)throw new Error('La carga automática requiere autorización para almacenar las imágenes.');
 const expires=body.expires_at?new Date(body.expires_at):null;if(expires&&(!Number.isFinite(expires.getTime())||expires.getTime()<=Date.now()))throw new Error('La autorización debe estar vigente.');
 const config={yarn_id:y.id,supplier_id:y.supplier_id,identity_key:identityKey(i),url,method:body.method,product_name:String(body.product_name||y.name).trim().slice(0,200),product_code:String(body.product_code||'').trim().slice(0,100),permission_reference:String(body.permission_reference).trim().slice(0,1500),allow_lookup:true,allow_download:!!body.allow_download,auto_confirm:!!body.auto_confirm,scheduled:!!body.scheduled,expires_at:expires?.toISOString()||null,updated_at:new Date().toISOString(),updated_by:c.profile.id};
 await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:{stage:c.stage,source_key:configKey(y.id),checked_at:config.updated_at,result:{config}}});return {config};
}
function scriptJSON(html,attribute){const tag=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes(attribute)&&/application\/json/i.test(m[1]));if(!tag)throw new Error('La página no ofrece los datos oficiales esperados.');return JSON.parse(tag[2]);}
function matchProduct(product,i,config){
 if(norm(product.name)!==norm(config.product_name)||norm(product.title).replace(/\s/g,'')!==norm(i.title).replace(/\s/g,'')||compositionKey(product.composition)!==compositionKey(i.composition))throw new Error('El producto, título o composición oficial no coincide. Se requiere revisión; no se modifica el registro.');
 if(config.product_code&&String(product.code)!==config.product_code)throw new Error('El código oficial del producto no coincide.');
}
export function extractPhotoCandidates(raw,i,config){
 providerURL(config.url,i.provider);const code=colorCode(i);if(!code)throw new Error('Falta el código de color.');
 if(config.method==='essentials-html'){
  if(!new URL(config.url).hostname.endsWith('stockserviceessentials.com'))throw new Error('Este método requiere la página oficial de Essentials.');
  const product=scriptJSON(raw,'data-product-json'),technical=scriptJSON(raw,'data-stock-pdf-data');
  if(norm(product.title)!==norm(technical.title))throw new Error('Los datos técnicos pertenecen a otro producto.');
  matchProduct({name:product.title,title:technical.count,composition:technical.composition,code:String(product.id)},i,config);
  const variants=product.variants.filter(v=>String(v.option1??v.title).trim().toUpperCase()===code);
  if(variants.length!==1)return [];
  const v=variants[0],image=v.featured_image,official=technical.variants?.find(row=>String(row.code).trim().toUpperCase()===code&&String(row.id)===String(v.id));
  if(!image||String(image.product_id)!==String(product.id)||!image.variant_ids?.some(id=>String(id)===String(v.id))||!official)return [];
  const url=providerURL(new URL(image.src,config.url).href,i.provider);
  return [{image_url:url,source_url:config.url,code,product_code:String(product.id),sku:v.sku,variant_id:String(v.id),product_name:product.title,composition:technical.composition,title:technical.count,method:config.method,exact:true}];
 }
 if(config.method==='official-html'){
  const match=sourceMatch(i);if(!match.source||new URL(match.source.url).pathname!==new URL(config.url).pathname)throw new Error('Esta página requiere un adaptador de producto o un catálogo JSON/CSV autorizado.');
  const plain=norm(raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' '));
  if(!plain.includes(norm(match.source.name))||!plain.replace(/\s/g,'').includes(norm(i.title).replace(/\s/g,'')))throw new Error('La página no confirma el nombre y título del hilo.');
  if(match.key!=='itessa'&&!/100\s*%\s*(?:BABY|ROYAL)\s+ALPACA/.test(plain))throw new Error('La página no confirma la composición esperada.');
  return imageCandidates(raw,match).map(candidate=>({...candidate,method:config.method,exact:!candidate.review,product_name:config.product_name,title:i.title,composition:i.composition}));
 }
 let rows;
 if(config.method==='official-csv'){const parsed=parseCSV(raw.replace(/^\uFEFF/,'')),headers=parsed.shift();rows=parsed.map(row=>Object.fromEntries(headers.map((h,n)=>[h,row[n]||''])));}
 else{const data=JSON.parse(raw);rows=Array.isArray(data)?data:data.rows;if(!Array.isArray(rows))throw new Error('El catálogo JSON debe contener registros por variante.');}
 const found=[];
 for(const row of rows){
  if(String(row.color_code).trim().toUpperCase()!==code)continue;
  if(providerKey(row.provider)!==providerKey(i.provider))continue;
  matchProduct({name:row.yarn,title:row.title,composition:row.composition,code:row.product_code},i,config);
  const url=providerURL(row.image_url,i.provider);
  found.push({image_url:url,source_url:config.url,code,product_code:row.product_code||'',sku:row.sku||'',product_name:row.yarn,title:row.title,composition:row.composition,method:config.method,exact:true});
 }
 return [...new Map(found.map(row=>[JSON.stringify([row.image_url,row.sku,row.product_code]),row])).values()];
}
export function selectPhotoPilot(r,settings=[]){
 const pending=r.colors.filter(color=>!verifiedPhoto(r.photos,rowIdentity(r,color))),selected=[];
 for(const provider of ['itessa','incatops','michell']){const candidates=pending.filter(color=>providerKey(rowIdentity(r,color).provider)===provider&&rowIdentity(r,color).code);const color=candidates.find(color=>settings.some(s=>s.yarn_id===color.yarn_id))||candidates[0];if(color)selected.push(color);}
 for(const color of pending)if(selected.length<5&&!selected.includes(color)&&rowIdentity(r,color).code)selected.push(color);
 for(const color of pending)if(selected.length<5&&!selected.includes(color))selected.push(color);
 return selected.slice(0,5);
}
export async function supplierPhotoReport(c,r){
 r||=await records(c);const checks=await c.db('textile_photo_checks?stage=eq.'+c.stage+'&limit=10000',{service:!!c.cron}),settings=await photoSettings(c);
 const rows=r.colors.map(color=>{const i=rowIdentity(r,color),p=verifiedPhoto(r.photos,i),check=checks.find(ch=>ch.color_id===color.id&&ch.identity_key===identityKey(i)),config=settings.find(s=>s.yarn_id===i.yarn_id);return {...i,id:color.id,name:color.name,verified:!!p,loaded:!!p,photo_id:p?.id||null,storage_full:p?.storage_full||null,storage_thumb:p?.storage_thumb||null,source_url:p?.source_url||null,obtained_at:p?.source_identity?.obtained_at||p?.created_at||p?.verified_at||null,checked_at:p?.source_checked_at||check?.checked_at||null,status:p?'verified':check?.status||'pending',reason:p?'Fotografía verificada y almacenada.':check?.reason||'Fotografía pendiente. Configura una fuente autorizada o importa una fotografía propia.',candidates:p?[]:check?.candidates||[],source_configured:usable(config,i)};});
 const providers=r.suppliers.map(s=>{const own=rows.filter(row=>row.supplier_id===s.id);return {supplier_id:s.id,provider:s.name,yarns:r.yarns.filter(y=>y.supplier_id===s.id).length,colors:own.length,found:own.filter(row=>row.candidates.length||row.verified).length,verified:own.filter(row=>row.verified).length,loaded:own.filter(row=>row.loaded).length,pending:own.filter(row=>!row.verified).length,errors:own.filter(row=>row.status==='error').length};});
 const [pilot]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.photo-pilot',{service:true});
 return {yarns:r.yarns.length,total:rows.length,found:rows.filter(row=>row.candidates.length||row.verified).length,verified:rows.filter(row=>row.verified).length,loaded:rows.filter(row=>row.loaded).length,pending:rows.filter(row=>!row.verified).length,manual:rows.filter(row=>!row.verified&&!row.candidates.length).length,errors:rows.filter(row=>row.status==='error').length,providers,rows,settings,pilot:pilot?.result||null};
}
async function storeCandidate(c,r,i,candidate,config){
 if(!config.allow_download||!candidate.exact)throw new Error('Falta autorización de almacenamiento o la coincidencia necesita revisión.');
 const existing=verifiedPhoto(r.photos,i);if(existing)return existing;
 const fetched=await safeFetch(candidate.image_url,10_000_000);let bytes=fetched.data;
 if(candidate.crop){if(hash(bytes)!==candidate.source_hash)throw new Error('La carta oficial cambió; es necesario revisar el recorte.');const [left,top,width,height]=candidate.crop;bytes=await sharp(bytes).extract({left,top,width,height}).toBuffer();}
 const meta=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();if(!['jpeg','png','webp','avif','heif'].includes(meta.format))throw new Error('La fuente no devolvió una fotografía válida.');
 const contentHash=hash(bytes),id=randomUUID(),shared=r.photos.find(p=>p.active&&p.rights_confirmed&&p.verification_status==='verified'&&sameVariant(p.source_identity,i)&&p.content_hash===contentHash&&p.storage_full&&p.storage_thumb);
 const paths=shared?{storage_full:shared.storage_full,storage_thumb:shared.storage_thumb,storage_asset_id:shared.storage_asset_id||shared.id}:await savePhoto(c,id,bytes,{color:true}),now=new Date().toISOString();
 const storageName=[providerKey(i.provider),i.yarn+'-'+i.title,colorCode(i)].map(v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')).join('_')+'.webp';
 const body={id,stage:c.stage,color_id:i.color_id,yarn_id:i.yarn_id,name:i.yarn+' · '+i.code,kind:'color',visibility:'team',rights_confirmed:true,mime_type:'image/webp',...paths,verification_status:'verified',verified_at:now,verified_by:c.profile.id,source_url:candidate.source_url,source_image_url:candidate.image_url,source_checked_at:now,permission_reference:config.permission_reference,source_identity:{...i,product_code:candidate.product_code,sku:candidate.sku,method:candidate.method,obtained_at:now},content_hash:contentHash,storage_name:storageName};
 const saved=await c.db('rpc/'+(c.cron?'confirm_color_photo_server':'confirm_color_photo'),{method:'POST',service:!!c.cron,body:c.cron?{p_photo:body,p_actor:c.profile.id}:{p_photo:body}});r.photos.push(saved);return saved;
}
export async function syncProviderPhotos(c,body={}){
 const r=await records(c),settings=await photoSettings(c),mode=body.mode||'pilot';
 const fingerprint=hash({identities:r.colors.map(color=>rowIdentity(r,color)),settings});
 const [pilot]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.photo-pilot',{service:true});
 if(mode!=='pilot'&&(!pilot?.result?.completed||!pilot.result.validated_yarns?.length||pilot.result.fingerprint!==fingerprint))throw new Error('Primero ejecuta y verifica la prueba de cinco registros. Debe existir al menos una fotografía verificada y almacenada.');
 if(!['pilot','batch','scheduled'].includes(mode))throw new Error('Modo no válido.');
 const pending=r.colors.filter(color=>!verifiedPhoto(r.photos,rowIdentity(r,color))).sort((a,b)=>a.id.localeCompare(b.id));
 const after=body.cursor?pending.filter(row=>row.id>String(body.cursor)):pending;
 const selected=mode==='pilot'?selectPhotoPilot(r,settings):after.filter(color=>mode!=='scheduled'||settings.some(s=>s.yarn_id===color.yarn_id&&s.scheduled)).slice(0,5),cache=new Map(),results=[];
 const deadline=Date.now()+35000;
 for(const color of selected){
  const i=rowIdentity(r,color),config=settings.find(s=>s.yarn_id===i.yarn_id);let status='pending',reason='',candidates=[];
  try{
   if(Date.now()>deadline)reason='Consulta aplazada para respetar el tiempo máximo de ejecución. Repite la prueba o el siguiente lote.';
   else if(!i.code||!i.title||!i.composition)reason='Falta código, título o composición en el registro. Se conserva pendiente.';
   else if(!usable(config,i))reason='Falta autorización vigente de consulta y correspondencia documentada con el producto oficial.';
   else if(mode!=='pilot'&&!pilot.result.validated_yarns.includes(i.yarn_id))reason='Esta fuente todavía no tiene una fotografía de prueba verificada. Ejecuta su prueba antes de la carga masiva.';
   else{
    const key=sourceKey(config);if(!cache.has(key))cache.set(key,await sourceResult(c,key,{url:config.url},{authorized:true}));const source=cache.get(key);
    if(source.error){status=source.permission_pending?'pending':'error';reason=source.error;}
    else{candidates=extractPhotoCandidates(source.html,i,config).filter(candidate=>robotsAllows(source.robots,new URL(candidate.image_url).pathname));
     status=candidates.length?'review':'pending';reason=candidates.length?'Fotografía encontrada. Requiere revisión o autorización de carga automática.':'No se encontró una variante con producto, código, composición y título exactos.';
     if(candidates.length===1&&candidates[0].exact&&config.auto_confirm&&config.allow_download){await storeCandidate(c,r,i,candidates[0],config);status='verified';reason='Fotografía exacta verificada y guardada en almacenamiento privado.';}
    }
   }
  }catch(e){status='error';reason=e.message;}
  const check={stage:c.stage,color_id:color.id,identity_key:identityKey(i),checked_at:new Date().toISOString(),status,reason,candidates};
  await c.db('textile_photo_checks?on_conflict=stage,color_id',{method:'POST',service:true,merge:true,body:check});results.push({id:color.id,...i,status,reason,found:candidates.length});
 }
 const validated_yarns=[...new Set(r.colors.filter(color=>verifiedPhoto(r.photos,rowIdentity(r,color))).map(color=>color.yarn_id))];
 const completed={completed:true,fingerprint,checked_at:new Date().toISOString(),results,validated_yarns};
 if(mode==='pilot')await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:{stage:c.stage,source_key:'photo-pilot',checked_at:completed.checked_at,result:completed}});
 await c.db('textile_sync_runs',{method:'POST',service:true,body:{stage:c.stage,source:'Fotografías de proveedores',status:results.some(row=>row.status==='error')?'Con incidencias':'Completado',details:JSON.stringify({mode,results})}});
 const next=selected.at(-1)?.id||null,remaining=mode==='pilot'?0:after.filter(row=>row.id>next).length;
 return {...await supplierPhotoReport(c,r),run:{mode,results,next_cursor:remaining?next:null,remaining}};
}
export async function confirmProviderCandidate(c,body){
 const r=await records(c),color=r.colors.find(color=>color.id===body.color_id);if(!color)throw new Error('El color ya no está activo.');
 const i=rowIdentity(r,color),settings=await photoSettings(c),config=settings.find(config=>config.yarn_id===i.yarn_id);
 if(!usable(config,i)||!config.allow_download||!body.exact_confirmed)throw new Error('Confirma la coincidencia exacta y una autorización vigente para guardar la fotografía.');
 const [check]=await c.db('textile_photo_checks?stage=eq.'+c.stage+'&color_id=eq.'+color.id),candidate=check?.candidates?.[Number(body.candidate)];
 if(check?.identity_key!==identityKey(i)||!candidate)throw new Error('La coincidencia cambió. Repite la búsqueda.');
 const source=await sourceResult(c,sourceKey(config),{url:config.url},{authorized:true});if(source.error)throw new Error(source.error);
 const exact=extractPhotoCandidates(source.html,i,config).find(row=>row.image_url===candidate.image_url&&row.code===candidate.code);
 if(!exact||!robotsAllows(source.robots,new URL(exact.image_url).pathname))throw new Error('La fuente ya no confirma esta imagen.');
 const saved=await storeCandidate(c,r,i,{...exact,exact:true},config);
 const [pilot]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.photo-pilot',{service:true});
 if(pilot?.result?.results?.some(row=>row.id===color.id))await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.photo-pilot',{method:'PATCH',service:true,body:{result:{...pilot.result,validated_yarns:[...new Set([...(pilot.result.validated_yarns||[]),i.yarn_id])]}}});
 return saved;
}
export async function resolveRegisteredPhoto(c,body){const r=await records(c),color=r.colors.find(color=>body.color_id?color.id===body.color_id:color.yarn_id===body.yarn_id&&color.code===body.code);if(!color)return {photo:null};const i=rowIdentity(r,color),p=verifiedPhoto(r.photos,i);return {photo:p?{id:p.id,color_id:color.id,yarn_id:color.yarn_id,source_identity:p.source_identity,source_url:p.source_url,verified_at:p.verified_at}:null};}
