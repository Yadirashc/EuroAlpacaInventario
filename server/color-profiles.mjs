import {randomUUID} from 'node:crypto';
import {chromaticFamilies,chromaticFamily,visualColorMatches,colorReferencePhoto} from '../src/color-profile.mjs';
import {normalizeTextileData} from '../src/textile-catalog.mjs';

export async function readColorProfiles(c){const rows=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=like.color-profile:*&select=result&limit=10000',{service:true});return rows.map(row=>row.result).filter(p=>p?.color_id);}
export async function setColorReference(c,colorId,photoId){const key='color-profile:'+colorId,[stored]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.'+key,{service:true}),[color]=await c.db('textile_colors?id=eq.'+colorId+'&stage=eq.'+c.stage);if(!color)throw Error('No se encontró el color.');const profile={color_id:colorId,family:chromaticFamily(color),...(stored?.result||{}),reference_photo_id:photoId,updated_at:new Date().toISOString(),updated_by:c.profile.id};await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:{stage:c.stage,source_key:key,checked_at:new Date().toISOString(),result:profile}});return profile;}
export async function saveColorProfile(c,body){
 if(c.profile.role!=='admin')throw Object.assign(new Error('Solo administradora'),{status:403});
 const value=key=>String(body[key]||'').trim().slice(0,key==='composition'?500:250),name=value('name'),code=value('code'),yarnName=value('yarn_name');let supplierId=value('supplier_id');
 if(!name||!yarnName||!supplierId)throw Error('Completa nombre del color, hilo y proveedor.');if(!chromaticFamilies.includes(body.family))throw Error('Elige Neutros, Sólidos o Melange.');
 const scoped=body.item_ids!==undefined;
 if(scoped&&(!Array.isArray(body.item_ids)||!body.item_ids.length||body.item_ids.length>500||body.item_ids.some(id=>typeof id!=='string')))throw Error('Selecciona las prendas que quieres modificar.');
 const [suppliers,yarns,colors,photos,items,profiles]=await Promise.all(['textile_suppliers','textile_yarns','textile_colors','textile_photos','items'].map(table=>c.db(table+'?select=*&'+(table==='items'?'archived=eq.false&':'stage=eq.'+c.stage+'&')+'limit=10000')).concat([readColorProfiles(c)]));
 const ids=scoped?[...new Set(body.item_ids)]:[],targets=items.filter(item=>ids.includes(item.id)&&!item.deleted_at);
 if(scoped&&targets.length!==ids.length)throw Error('Una de las prendas ya no está disponible. Actualiza el inventario.');
 const old=body.color_id&&colors.find(row=>row.id===body.color_id&&!row.deleted_at),oldProfile=profiles.find(p=>p.color_id===old?.id);
 if(body.color_id&&!old)throw Error('El color ya no está disponible.');
 // An item edit always forks a shared reference. Reuse only an exclusively owned copy.
 const owners=items.filter(item=>item.source_snapshot?._textile_color_id===old?.id);
 const reuse=scoped&&old&&oldProfile?.scope==='items'&&owners.length===ids.length&&owners.every(item=>ids.includes(item.id))&&(oldProfile.bound_item_ids||[]).every(id=>ids.includes(id));
 const id=scoped&&!reuse?randomUUID():old?.id||randomUUID(),editing=old&&id===old.id;
 if(supplierId==='__new'){
  const label=value('supplier_name');if(!label)throw Error('Ingresa el nombre del proveedor.');let match=suppliers.find(s=>s.name.trim().toLocaleLowerCase()===label.toLocaleLowerCase()&&s.active!==false&&!s.deleted_at);
  if(!match){const supplierIdNew=randomUUID();match={id:supplierIdNew,stage:c.stage,code:'CUSTOM-'+supplierIdNew.slice(0,8),name:label,website:'',catalog_url:'',integration_status:'Registro manual',active:true};await c.db('textile_suppliers',{method:'POST',body:match});suppliers.push(match);}supplierId=match.id;
 }
 if(!suppliers.some(s=>s.id===supplierId&&s.active!==false&&!s.deleted_at))throw Error('Selecciona un proveedor disponible.');
 const data=normalizeTextileData({suppliers,yarns,colors,photos}),previous=old&&{...old,color_profile:oldProfile};
 const target=editing&&yarns.find(y=>y.id===old.yarn_id&&y.reference_key?.startsWith('independent-color|'+id)&&!colors.some(color=>color.id!==id&&color.yarn_id===y.id));
 const yarnId=target?.id||randomUUID(),reference=target?.reference_key||'independent-color|'+id+'|'+randomUUID();
 const yarnBody={name:yarnName,code:value('yarn_code'),fiber:value('fiber'),composition:value('composition'),title:value('title'),supplier_id:supplierId,reference_key:reference,active:true,source_note:'Ficha independiente de este color. Sus cambios no modifican otros colores.'};
 if(target)await c.db('textile_yarns?id=eq.'+yarnId+'&stage=eq.'+c.stage,{method:'PATCH',body:yarnBody});else await c.db('textile_yarns',{method:'POST',body:{id:yarnId,stage:c.stage,...yarnBody}});
 const colorBody={name,code,yarn_id:yarnId,reference_key:'independent-color|'+id,active:true};
 if(editing)await c.db('textile_colors?id=eq.'+id+'&stage=eq.'+c.stage,{method:'PATCH',body:colorBody});
 else await c.db('textile_colors',{method:'POST',body:{id,stage:c.stage,...colorBody,family:'Sin clasificar'}});
 const affected=scoped?targets:oldProfile?.scope==='items'?owners:[];
 const bound=scoped?ids:oldProfile?.scope==='items'?affected.map(item=>item.id):[...new Set([...(oldProfile?.bound_item_ids||[]),...items.filter(item=>previous&&visualColorMatches(item,previous,colors)).map(item=>item.id)])];
 const referencePhoto=previous&&colorReferencePhoto(previous,{...data,photos});
 const profile={color_id:id,family:body.family,scope:scoped?'items':oldProfile?.scope||'catalog',alias_ids:[id],bound_item_ids:bound,reference_photo_id:oldProfile?.reference_photo_id||referencePhoto?.id||null,reference_yarn_id:oldProfile?.reference_yarn_id||old?.yarn_id||null,original:oldProfile?.original||old||null,updated_at:new Date().toISOString(),updated_by:c.profile.id};
 await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:{stage:c.stage,source_key:'color-profile:'+id,checked_at:new Date().toISOString(),result:profile}});
 const updated=[];
 for(const item of affected){
  const patch={color:name,color_code:code,source_snapshot:{...(item.source_snapshot||{}),_textile_color_id:id}};
  const saved=await c.db('items?id=eq.'+item.id+(item.updated_at?'&updated_at=eq.'+encodeURIComponent(item.updated_at):''),{method:'PATCH',body:patch});
  if(saved.length!==1)throw Error('La prenda cambió mientras editabas. Actualiza el inventario antes de continuar.');
  updated.push(saved[0]);
 }
 return {color_id:id,yarn_id:yarnId,profiles:[profile],items:updated};
}
