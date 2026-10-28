import {normalize} from './domain.mjs';
import {colorCode} from './photo-identity.mjs';
export const chromaticFamilies=['Neutros','Sólidos','Melange'];
export const chromaticFamily=color=>chromaticFamilies.includes(color.family)?color.family:/MELANGE|MATIZADO/.test(normalize(color.name))||/^Z/i.test(color.code||'')?'Melange':color.family==='Neutros'?'Neutros':'Sólidos';
export const visualColorKey=color=>normalize(color.name||color.color).replace(/\s+/g,' ').trim()+'|'+String(colorCode({provider:'ITESSA',code:color.code??color.color_code})).toUpperCase().trim();
export function visualColorMatches(item,color,colors=[]){
 const profile=color.color_profile||{},ids=new Set([color.id,...(color.color_group||[]).map(c=>c.id)]),selected=item.source_snapshot?._textile_color_id;
 if(item.source_snapshot?._textile_color_cleared&&!selected)return false;
 if(selected)return ids.has(selected);
 if(profile.scope==='items')return profile.bound_item_ids?.includes(item.id)||false;
 if(profile.bound_item_ids?.includes(item.id))return true;
 return !!(item.color||'').trim()&&visualColorKey({name:item.color,code:item.color_code})===visualColorKey(color);
}
export function colorReferencePhoto(color,data){
 const profile=color.color_profile||{},ids=new Set([color.id,...(color.color_group||[]).map(c=>c.id)]),photos=data.photos.filter(p=>p.active!==false&&!p.deleted_at&&p.rights_confirmed&&(p._url||p.storage_full&&p.storage_thumb));
 const compatible=p=>!p.source_identity?.code||!color.code||colorCode({provider:'ITESSA',code:p.source_identity.code}).toUpperCase()===colorCode({provider:'ITESSA',code:color.code}).toUpperCase();
 return photos.find(p=>p.id===profile.reference_photo_id&&compatible(p))||photos.find(p=>ids.has(p.color_id)&&compatible(p))||photos.find(p=>!p.color_id&&[color.yarn_id,profile.reference_yarn_id].includes(p.yarn_id));
}
export function applyColorProfiles(data,profiles=[]){const map=new Map(profiles.map(p=>[p.color_id,p]));return {...data,color_profiles:profiles,colors:data.colors.map(c=>({...c,family:chromaticFamily({...c,...(map.get(c.id)?.family?{family:map.get(c.id).family}:{})}),color_profile:map.get(c.id)||c.color_profile}))};}
export function garmentColorChoices(data,itemId){const choices=new Map();for(const color of data.colors.filter(c=>c.active!==false&&!c.deleted_at&&(c.color_profile?.scope!=='items'||c.color_profile.bound_item_ids?.includes(itemId)))){const key=visualColorKey(color);if(!choices.has(key)||color.color_profile?.scope==='items'&&color.color_profile.bound_item_ids?.includes(itemId))choices.set(key,{id:color.id,name:color.name,code:color.code||''});}return [...choices.values()].sort((a,b)=>a.name.localeCompare(b.name,'es')||a.code.localeCompare(b.code,'es',{numeric:true}));}
