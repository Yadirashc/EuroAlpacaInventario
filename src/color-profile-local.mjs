import {visualColorMatches,colorReferencePhoto} from './color-profile.mjs';

export function saveLocalColorProfile(data,items,body,makeID){
 const old=data.colors.find(c=>c.id===body.color_id),previous=old&&{...old,color_profile:data.color_profiles?.find(p=>p.color_id===old.id)||old.color_profile};
 const scoped=Array.isArray(body.item_ids),ids=scoped?[...new Set(body.item_ids)]:[],targets=items.filter(item=>ids.includes(item.id)||!scoped&&previous?.color_profile?.scope==='items'&&item.source_snapshot?._textile_color_id===old?.id);
 if(scoped&&(!ids.length||targets.length!==ids.length))throw Error('Selecciona las prendas que quieres modificar.');
 const owners=items.filter(item=>item.source_snapshot?._textile_color_id===old?.id),reusable=scoped&&old&&previous.color_profile?.scope==='items'&&owners.length===ids.length&&owners.every(item=>ids.includes(item.id))&&(previous.color_profile.bound_item_ids||[]).every(id=>ids.includes(id));
 const id=scoped&&!reusable?makeID():old?.id||makeID(),editing=old&&id===old.id,reference=previous&&colorReferencePhoto(previous,data);
 let supplierId=body.supplier_id;
 if(supplierId==='__new'){supplierId=makeID();data.suppliers.push({id:supplierId,name:body.supplier_name,code:'CUSTOM-'+supplierId,active:true});}
 const target=editing&&data.yarns.find(y=>y.id===old.yarn_id&&y.reference_key?.startsWith('independent-color|'+id)&&!data.colors.some(c=>c.id!==id&&c.yarn_id===y.id)),yarnId=target?.id||makeID();
 const yarn={id:yarnId,name:body.yarn_name,code:body.yarn_code,fiber:body.fiber,composition:body.composition,title:body.title,supplier_id:supplierId,reference_key:'independent-color|'+id,active:true};
 if(target)Object.assign(target,yarn);else data.yarns.push(yarn);
 const color={id,name:body.name,code:body.code,yarn_id:yarnId,reference_key:'independent-color|'+id,active:true};
 if(editing)Object.assign(old,color);else data.colors.push({...color,family:'Sin clasificar'});
 const bound=scoped?ids:previous?.color_profile?.scope==='items'?targets.map(item=>item.id):[...new Set([...(previous?.color_profile?.bound_item_ids||[]),...items.filter(item=>previous&&visualColorMatches(item,previous,data.colors)).map(item=>item.id)])];
 const profile={color_id:id,family:body.family,scope:scoped?'items':previous?.color_profile?.scope||'catalog',alias_ids:[id],bound_item_ids:bound,reference_photo_id:previous?.color_profile?.reference_photo_id||reference?.id,reference_yarn_id:previous?.color_profile?.reference_yarn_id||previous?.yarn_id};
 data.color_profiles=(data.color_profiles||[]).filter(p=>p.color_id!==id);data.color_profiles.push(profile);
 for(const item of targets)Object.assign(item,{color:body.name,color_code:body.code,source_snapshot:{...(item.source_snapshot||{}),_textile_color_id:id}});
 return {color_id:id,yarn_id:yarnId};
}
