import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {limitedBuffer} from './textile-auth.mjs';
import {savePhoto} from './photo-storage.mjs';
const digest=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const sources={
 itessa:{url:'https://www.itessa.com.pe/es/producto/cancas-nu',name:'Cancas',title:'18/2'},
 itessaBaby:{url:'https://www.itessa.com.pe/es/producto/baby-alpaca-ba',name:'Baby alpaca',title:'2/28'},
 michell:{url:'https://www.michell.com.pe/en/collections/stock-service/machine-knitting/baby-alpaca-2-28',name:'Baby alpaca',title:'2/28'},
 incatops:{url:'https://www.incatops.com/stockservice/en/product/kori-2-28/',name:'Kori',title:'2/28'}
};
export const chart={url:'https://www.itessa.com.pe/img_productos/productos_imagenes_8_kCxRf.jpg',hash:'f8c89d886ffa138cfde7c20ff9833fbb5bc9b196591a5d82ba03466167469a97',width:600,height:400,
 crops:{'050':[72,0,223,126],'1348':[310,0,226,126],'1258':[72,126,223,128],'2620':[310,126,226,128],'2617':[72,254,223,146],'2624':[310,254,226,146]}};
export const babyChart={url:'https://www.itessa.com.pe/img_productos/productos_imagenes_1_tN9V2.jpg',hash:'5be420b3f6b99736decf0cb213299d0d808fc3695452e6beafd75c59a4306ea3',width:600,height:400,crops:{'201':[57,0,159,96],'1496':[57,96,159,100],'8376':[57,196,159,105],'9861':[57,301,159,99],'2618':[221,0,159,103],'3812':[221,103,159,99],'8420':[221,202,159,103],'7680':[221,305,159,95],'5778':[385,0,158,96],'9434':[385,96,158,106],'9403':[385,202,158,98],'500':[385,300,158,100]}};
export function identity(color,yarn,supplier){return {color_id:color.id,yarn_id:yarn.id,supplier_id:supplier.id,provider:supplier.name,yarn:yarn.name,code:color.code,composition:yarn.composition,fiber:yarn.fiber,title:yarn.title};}
export const identityKey=i=>digest(i);
export function samePhotoIdentity(a,b){const left=sourceMatch(a),right=sourceMatch(b);return !!left.key&&left.key===right.key&&left.code===right.code&&['supplier_id','composition','title','fiber'].every(k=>a[k]===b[k])&&norm(a.yarn)===norm(b.yarn);}
export function sourceMatch(i){
 if(!String(i.code||'').trim())return {reason:'Falta el código de color original; no se puede identificar una variante exacta.'};
 const provider=norm(i.provider).replaceAll(' ',''),name=norm(i.yarn),key=provider.includes('itessa')?(name==='baby alpaca'?'itessaBaby':'itessa'):provider.includes('michell')?'michell':provider.includes('incatops')?'incatops':null;
 if(!key||name!==norm(sources[key].name))return {reason:'No se ha identificado una fuente oficial verificable para este proveedor e hilo. Requiere catálogo o fotografía propia.'};
 const source=sources[key];if(String(i.title||'').replace(/\s/g,'')!==source.title)return {reason:'El título registrado no coincide con el catálogo oficial ('+source.title+'). Revisar sin modificar el dato original.'};
 const comp=norm(i.composition);
 if(key==='itessa'&&!/^(15 baby alpaca 85 algodon(?: tanguis)?|85 algodon(?: tanguis)? 15 baby alpaca)$/.test(comp))return {reason:'La composición no coincide con Cancas: 15% baby alpaca y 85% algodón.'};
 if(['michell','itessaBaby'].includes(key)&&comp!=='100 baby alpaca')return {reason:'La composición no coincide con 100% baby alpaca.'};
 if(key==='incatops'&&comp!=='100 royal alpaca')return {reason:'La composición no coincide con 100% royal alpaca.'};
 return {key,source,code:String(i.code).trim().toUpperCase().replace(key==='itessa'?/^NU[\s-]*/:key==='itessaBaby'?/^BA[\s-]*/:/^$/,''),review:key==='itessa'?'El sitio indica algodón sin precisar Tangüis. Se requiere comprobar ese subtipo en documentación del proveedor antes de confirmar.':''};
}
export function officialURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||!['itessa.com.pe','www.itessa.com.pe','michell.com.pe','www.michell.com.pe','incatops.com','www.incatops.com','stockserviceessentials.com','www.stockserviceessentials.com'].includes(u.hostname))throw new Error('La fuente redirigió a una dirección que no se pudo validar como oficial. Requiere revisión manual.');return u;}
export async function safeFetch(url,max=1_500_000){let u=officialURL(url);const host=u.hostname.replace(/^www\./,'');for(let n=0;n<4;n++){
 const r=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(6500),headers:{'User-Agent':'EuroAlpaca-CatalogReview/1.0'}});
 if([301,302,303,307,308].includes(r.status)){u=officialURL(new URL(r.headers.get('location'),u).href);if(u.hostname.replace(/^www\./,'')!==host)throw new Error('La fuente redirige fuera del proveedor original. Requiere revisión manual.');continue;}
 if(r.status===429)throw new Error('HTTP 429: el proveedor limita las consultas. Se conserva una pausa de 24 horas; no se intenta eludirla.');
 if(!r.ok)throw Object.assign(new Error('La fuente oficial respondió HTTP '+r.status+'.'),{status:r.status});
 const declared=Number(r.headers.get('content-length'));if(declared>max)throw new Error('La fuente supera el tamaño permitido.');
 return {data:await limitedBuffer(r,max),url:u.href};
 }throw new Error('Demasiadas redirecciones de la fuente oficial.');}
export function robotsAllows(text,path){let agents=[],rules=[],groups=[];for(const line of text.split(/\r?\n/)){const m=line.replace(/#.*$/,'').match(/^\s*(user-agent|allow|disallow)\s*:\s*(.*?)\s*$/i);if(!m)continue;const k=m[1].toLowerCase(),v=m[2];if(k==='user-agent'){if(rules.length){groups.push({agents,rules});agents=[];rules=[];}agents.push(v.toLowerCase());}else rules.push({allow:k==='allow',path:v});}groups.push({agents,rules});const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&'euroalpaca-catalogreview'.includes(a))),selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));const matches=selected.flatMap(g=>g.rules).filter(r=>r.path&&new RegExp('^'+r.path.split('*').map(s=>s.replace(/[.+?^${}()|[\]\\]/g,'\\$&')).join('.*').replace(/\\\$$/,'$')).test(path)).sort((a,b)=>b.path.length-a.path.length||Number(b.allow)-Number(a.allow));return !matches.length||matches[0].allow;}
const decode=v=>v.replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#039;',"'");
export function imageCandidates(html,match){
 if(['itessa','itessaBaby'].includes(match.key)){const ref=match.key==='itessa'?chart:babyChart;return html.includes(new URL(ref.url).pathname.split('/').at(-1))&&ref.crops[match.code]?[{image_url:ref.url,source_url:match.source.url,code:match.code,crop:ref.crops[match.code],source_hash:ref.hash,review:match.review}]:[];}
 const found=[];for(const tag of html.match(/<img\b[^>]*>/gi)||[]){const attrs={};for(const a of tag.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/g))attrs[a[1].toLowerCase()]=decode(a[3]);if(String(attrs.alt||'').trim().toUpperCase()!==match.code)continue;
 const raw=attrs['data-src']||attrs.src;if(!raw||raw.startsWith('data:'))continue;try{const url=officialURL(new URL(raw,match.source.url).href).href;if(!found.some(c=>c.image_url===url))found.push({image_url:url,source_url:match.source.url,code:match.code,review:''});}catch{}
 }return found.slice(0,2);
}
export async function sourceResult(c,key,source,{authorized=false}={}){
 const [cached]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.'+key,{service:true});
 if(cached&&Date.now()-new Date(cached.checked_at).getTime()<86400_000)return cached.result;
 if(!authorized)return {error:'Falta registrar autorización para consultar automáticamente esta fuente. Puedes revisar el catálogo oficial e importar fotografías autorizadas.',checked_at:new Date().toISOString(),permission_pending:true};
 let result;try{
  const u=officialURL(source.url);let robots;try{robots=await safeFetch(u.origin+'/robots.txt',100_000);}catch(e){if(e.status!==404)throw e;robots={data:Buffer.from('User-agent: *\nAllow: /')};}
  if(!robotsAllows(robots.data.toString(),u.pathname))throw new Error('La fuente no permite consultar esta ruta mediante robots.txt.');
  const page=await safeFetch(source.url);const html=page.data.toString(),title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';if(/account suspended|access denied|captcha|just a moment|verify (?:you|that)/i.test(title)||/id=["'](?:challenge-form|cf-chl-widget)/i.test(html))throw new Error('La fuente oficial está restringida o suspendida. Se requiere revisión manual.');
  result={html,checked_at:new Date().toISOString(),robots:robots.data.toString()};
 }catch(e){result={error:e.message,checked_at:new Date().toISOString()};}
 await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:{stage:c.stage,source_key:key,checked_at:new Date().toISOString(),result}});return result;
}
export async function records(c){const [colors,yarns,suppliers,photos]=await Promise.all(['textile_colors','textile_yarns','textile_suppliers','textile_photos'].map(t=>c.db(t+'?stage=eq.'+c.stage+'&deleted_at=is.null&limit=10000',{service:!!c.cron})));return {colors:colors.filter(x=>x.active!==false),yarns:yarns.filter(x=>x.active!==false),suppliers:suppliers.filter(x=>x.active!==false),photos};}
export function rowIdentity(r,color){const yarn=r.yarns.find(y=>y.id===color.yarn_id)||{},supplier=r.suppliers.find(s=>s.id===yarn.supplier_id)||{};return identity(color,yarn,supplier);}
export async function photoReport(c,r){r||=await records(c);const checks=await c.db('textile_photo_checks?stage=eq.'+c.stage+'&limit=10000');const rows=r.colors.map(color=>{const i=rowIdentity(r,color),p=r.photos.find(p=>p.color_id===color.id&&p.active&&p.rights_confirmed&&p.verification_status==='verified'&&identityKey(p.source_identity)===identityKey(i)),check=checks.find(x=>x.color_id===color.id&&x.identity_key===identityKey(i));return {id:color.id,name:color.name,...i,verified:!!p,checked_at:check?.checked_at||p?.source_checked_at||null,status:p?'verified':check?.status||'pending',reason:p?'Fotografía verificada y almacenada.':check?.reason||sourceMatch(i).reason||'Falta consultar la fuente oficial y documentar la autorización de uso.',candidates:p?[]:check?.candidates||[]};});
 return {total:rows.length,found:rows.filter(r=>r.candidates.length||r.verified).length,verified:rows.filter(r=>r.verified).length,pending:rows.filter(r=>!r.verified).length,manual:rows.filter(r=>!r.verified&&!r.candidates.length).length,errors:rows.filter(r=>r.status==='error').length,rows};
}
export async function discoverPhotos(c){const r=await records(c),cache=new Map(),checks=[];
 for(const color of r.colors){const i=rowIdentity(r,color),key=identityKey(i);if(r.photos.some(p=>p.color_id===color.id&&p.active&&p.rights_confirmed&&p.verification_status==='verified'&&identityKey(p.source_identity)===key))continue;
  const match=sourceMatch(i);let candidates=[],reason=match.reason,status='manual';
  if(match.source){if(!cache.has(match.key))cache.set(match.key,await sourceResult(c,match.key,match.source));const source=cache.get(match.key);if(source.error){reason=source.error;status='error';}else{candidates=imageCandidates(source.html,match).filter(candidate=>robotsAllows(source.robots,new URL(candidate.image_url).pathname));status=candidates.length?'review':'manual';reason=candidates.length?(match.review||'Coincidencia encontrada. Requiere revisión de la fotografía y autorización documentada; todavía no está cargada.'):'El catálogo consultado no ofrece una fotografía identificada con este código exacto.';}}
  checks.push({stage:c.stage,color_id:color.id,identity_key:key,checked_at:new Date().toISOString(),status,reason,candidates});
 }
 if(checks.length)await c.db('textile_photo_checks?on_conflict=stage,color_id',{method:'POST',service:true,merge:true,body:checks});return photoReport(c,r);
}
export async function colorVerification(c,b,{manual=false}={}){if(!b.color_id)return {};
 if(!b.exact_confirmed)throw new Error('Confirma que la fotografía corresponde al proveedor, hilo y color seleccionado.');
 if(!manual&&(!b.rights_confirmed||String(b.permission_reference||'').trim().length<5))throw new Error('Indica la autorización de uso o la autoría de la fotografía del proveedor.');
 const r=await records(c),color=r.colors.find(x=>x.id===b.color_id&&x.active);if(!color)throw new Error('El color ya no está disponible.');const i=rowIdentity(r,color);if(!i.code||!i.composition||!i.title)throw new Error('Completa y comprueba el código, composición y título del registro antes de verificar su fotografía.');
 if(b.yarn_id&&b.yarn_id!==i.yarn_id)throw new Error('El hilo seleccionado no corresponde al color.');
 if(r.photos.some(p=>p.color_id===color.id&&p.active&&p.verification_status==='verified'&&identityKey(p.source_identity)===identityKey(i)))throw new Error('Este color ya tiene una fotografía verificada. Evita duplicarla.');
 return {yarn_id:i.yarn_id,source_identity:i,verification_status:'verified',verified_at:new Date().toISOString(),verified_by:c.profile.id,source_checked_at:new Date().toISOString(),permission_reference:manual?'Carga manual de la administradora; sin declaración de autorización de uso.':String(b.permission_reference).trim().slice(0,1500)};
}
export async function confirmPhoto(c,b){const verification=await colorVerification(c,b),[check]=await c.db('textile_photo_checks?stage=eq.'+c.stage+'&color_id=eq.'+encodeURIComponent(b.color_id));if(!check||check.identity_key!==identityKey(verification.source_identity))throw new Error('El registro cambió. Actualiza y revisa nuevamente la coincidencia.');const candidate=check.candidates[Number(b.candidate)];if(!candidate)throw new Error('Selecciona una coincidencia de la revisión oficial.');
 const match=sourceMatch(verification.source_identity),[cached]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.'+match.key,{service:true});
 if(!cached?.result?.robots||!robotsAllows(cached.result.robots,new URL(candidate.image_url).pathname))throw new Error('No se ha confirmado que la fuente permita descargar la imagen.');
 const existing=await c.db('textile_photos?stage=eq.'+c.stage+'&active=eq.true&deleted_at=is.null&verification_status=eq.verified&limit=10000');
 const asset=existing.find(p=>p.source_image_url===candidate.image_url&&p.source_identity&&samePhotoIdentity(p.source_identity,verification.source_identity)&&p.storage_full&&p.storage_thumb);
 if(asset)return c.db('rpc/confirm_color_photo',{method:'POST',body:{p_photo:{id:randomUUID(),stage:c.stage,color_id:b.color_id,yarn_id:verification.yarn_id,name:verification.source_identity.yarn+' · '+verification.source_identity.code,kind:'color',visibility:'team',rights_confirmed:true,mime_type:'image/webp',...verification,storage_full:asset.storage_full,storage_thumb:asset.storage_thumb,storage_asset_id:asset.storage_asset_id||asset.id,storage_name:asset.storage_name,source_url:candidate.source_url,source_image_url:candidate.image_url,content_hash:asset.content_hash}}});
 let bytes;
 if(candidate.crop&&cached.result.original_path){const r=await fetch(c.url+'/storage/v1/object/authenticated/textile-private/'+cached.result.original_path,{headers:{apikey:c.key,Authorization:'Bearer '+c.key}});bytes=await limitedBuffer(r,10_000_000);}
 else{bytes=(await safeFetch(candidate.image_url,10_000_000)).data;if(candidate.crop&&digest(bytes)===candidate.source_hash){const path=c.stage+'/sources/'+candidate.source_hash+'.jpg',r=await fetch(c.url+'/storage/v1/object/textile-private/'+path,{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'image/jpeg','x-upsert':'true'},body:bytes});if(!r.ok)throw new Error('No se pudo conservar la carta oficial autorizada.');await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.'+match.key,{method:'PATCH',service:true,body:{result:{...cached.result,original_path:path}}});}}
 if(candidate.crop){const meta=await sharp(bytes).metadata();if(digest(bytes)!==candidate.source_hash||meta.width!==600||meta.height!==400)throw new Error('La carta oficial cambió. Es necesario revisar nuevamente los recortes y sus códigos.');const [left,top,width,height]=candidate.crop;bytes=await sharp(bytes).extract({left,top,width,height}).toBuffer();}
 const hash=digest(bytes),id=randomUUID(),filename=[norm(verification.source_identity.provider),norm(verification.source_identity.yarn),norm(verification.source_identity.code)].map(v=>v.replaceAll(' ','-')).join('_')+'.webp',paths=await savePhoto(c,id,bytes);
 // The per-color database lock prevents concurrent confirmations from creating duplicate links.
 return c.db('rpc/confirm_color_photo',{method:'POST',body:{p_photo:{id,stage:c.stage,color_id:b.color_id,yarn_id:verification.yarn_id,name:verification.source_identity.yarn+' · '+verification.source_identity.code,kind:'color',visibility:'team',rights_confirmed:true,mime_type:'image/webp',...paths,...verification,source_url:candidate.source_url,source_image_url:candidate.image_url,content_hash:hash,storage_name:filename}}});
}
