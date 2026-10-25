import {randomUUID} from 'node:crypto';
import {chromaticFamilies,chromaticFamily,visualColorMatches,colorReferencePhoto} from '../src/color-profile.mjs';
import {normalizeTextileData,catalogColorGroups} from '../src/textile-catalog.mjs';

export async function readColorProfiles(c){const rows=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=like.color-profile:*&select=result&limit=10000',{service:true});return rows.map(row=>row.result).filter(p=>p?.color_id);}
export async function setColorReference(c,colorId,photoId){const key='color-profile:'+colorId,[stored]=await c.db('textile_photo_sources?stage=eq.'+c.stage+'&source_key=eq.'+key,{service:true}),[color]=await c.db('textile_colors?id=eq.'+colorId+'&stage=eq.'+c.stage);if(!color)throw Error('No se encontró el color.');const profile={color_id:colorId,family:chromaticFamily(color),...(stored?.result||{}),reference_photo_id:photoId,updated_at:new Date().toISOString(),updated_by:c.profile.id};await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:{stage:c.stage,source_key:key,checked_at:new Date().toISOString(),result:profile}});return profile;}
export async function saveColorProfile(c,body){
 if(c.profile.role!=='admin')throw Object.assign(new Error('Solo administradora'),{status:403});
 const value=key=>String(body[key]||'').trim().slice(0,key==='composition'?500:250),name=value('name'),code=value('code'),yarnName=value('yarn_name');let supplierId=value('supplier_id');
 if(!name||!yarnName||!supplierId)throw Error('Completa nombre del color, hilo y proveedor.');if(!chromaticFamilies.includes(body.family))throw Error('Elige Neutros, Sólidos o Melange.');
 const [suppliers,yarns,colors,photos,items,profiles]=await Promise.all(['textile_suppliers','textile_yarns','textile_colors','textile_photos','items'].map(table=>c.db(table+'?select=*&'+(table==='items'?'archived=eq.false&':'stage=eq.'+c.stage+'&')+'limit=10000')).concat([readColorProfiles(c)]));
 if(supplierId==='__new'){const label=value('supplier_name');if(!label)throw Error('Ingresa el nombre del proveedor.');let match=suppliers.find(s=>s.name.trim().toLocaleLowerCase()===label.toLocaleLowerCase()&&s.active!==false&&!s.deleted_at);if(!match){const id=randomUUID();match={id,stage:c.stage,code:'CUSTOM-'+id.slice(0,8),name:label,website:'',catalog_url:'',integration_status:'Registro manual',active:true};await c.db('textile_suppliers',{method:'POST',body:match});suppliers.push(match);}supplierId=match.id;}
 if(!suppliers.some(s=>s.id===supplierId&&s.active!==false&&!s.deleted_at))throw Error('Selecciona un proveedor disponible.');
 const data=normalizeTextileData({suppliers,yarns,colors,photos}),old=body.color_id&&colors.find(row=>row.id===body.color_id&&!row.deleted_at);if(body.color_id&&!old)throw Error('El color ya no está disponible.');
 const group=old?catalogColorGroups(colors.filter(row=>!row.deleted_at),data.yarns).find(g=>g.color_group.some(row=>row.id===old.id)):null,aliases=group?.color_group||[],id=old?.id||randomUUID(),reference='independent-color|'+id;
 let target=yarns.find(y=>y.reference_key===reference),yarnId=target?.id||randomUUID();
 const yarnBody={name:yarnName,code:value('yarn_code'),fiber:value('fiber'),composition:value('composition'),title:value('title'),supplier_id:supplierId,reference_key:reference,active:true,source_note:'Ficha independiente de este color. Sus cambios no modifican otros colores.'};
 if(target)await c.db('textile_yarns?id=eq.'+yarnId+'&stage=eq.'+c.stage,{method:'PATCH',body:yarnBody});else await c.db('textile_yarns',{method:'POST',body:{id:yarnId,stage:c.stage,...yarnBody}});
 const sources=aliases.length?aliases:[{id}],bound=new Set(profiles.filter(p=>sources.some(row=>row.id===p.color_id)).flatMap(p=>p.bound_item_ids||[]));
 for(const item of items)if(sources.some(color=>visualColorMatches(item,{...color,color_profile:profiles.find(p=>p.color_id===color.id)},colors)))bound.add(item.id);
 const referencePhoto=old&&colorReferencePhoto(group||old,{...data,photos});
 if(old){for(const color of sources)await c.db('textile_colors?id=eq.'+color.id+'&stage=eq.'+c.stage,{method:'PATCH',body:{reference_key:'independent-color|'+color.id}});await c.db('textile_colors?id=in.('+sources.map(row=>row.id).join(',')+')&stage=eq.'+c.stage,{method:'PATCH',body:{name,code,yarn_id:yarnId,active:true}});}
 else await c.db('textile_colors',{method:'POST',body:{id,stage:c.stage,yarn_id:yarnId,reference_key:'independent-color|'+id,name,code,family:'Sin clasificar',active:true}});
 const saved=sources.map(color=>({color_id:color.id,family:body.family,alias_ids:sources.map(row=>row.id),bound_item_ids:[...bound],reference_photo_id:profiles.find(p=>p.color_id===color.id)?.reference_photo_id||referencePhoto?.id||null,reference_yarn_id:profiles.find(p=>p.color_id===color.id)?.reference_yarn_id||color.yarn_id||null,original:profiles.find(p=>p.color_id===color.id)?.original||color,updated_at:new Date().toISOString(),updated_by:c.profile.id}));
 await c.db('textile_photo_sources?on_conflict=stage,source_key',{method:'POST',service:true,merge:true,body:saved.map(profile=>({stage:c.stage,source_key:'color-profile:'+profile.color_id,checked_at:new Date().toISOString(),result:profile}))});
 return {color_id:id,yarn_id:yarnId,profiles:saved};
}
