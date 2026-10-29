import {normalize} from './domain.mjs';
import {compositionKey} from './composition.mjs';
const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'es',{numeric:true,sensitivity:'base'});
export const textileCount=(n,singular,plural=singular+'s')=>n+' '+(n===1?singular:plural);
export function organizeProviderColors(rows,{suppliers,yarns}){
 const groups=new Map();
 for(const color of rows){const yarn=yarns.find(y=>y.id===color.yarn_id),provider=yarn&&suppliers.find(s=>s.id===yarn.supplier_id);if(!provider)continue;
  if(!groups.has(provider.id))groups.set(provider.id,{provider,colors:[],yarns:new Map()});const group=groups.get(provider.id);group.colors.push(color);
  const key=JSON.stringify([normalize(yarn.name),normalize(yarn.fiber),compositionKey(yarn.composition)]);if(!group.yarns.has(key))group.yarns.set(key,{yarn,colors:[],titles:new Set()});const thread=group.yarns.get(key);thread.colors.push(color);if(yarn.title)thread.titles.add(yarn.title);
 }
 return [...groups.values()].sort((a,b)=>compare(a.provider.name,b.provider.name)).map(group=>({...group,yarns:[...group.yarns.values()].sort((a,b)=>compare(a.yarn.name,b.yarn.name)).map(thread=>({...thread,titles:[...thread.titles].sort(compare),colors:thread.colors.slice().sort((a,b)=>compare(a.name,b.name)||compare(a.code,b.code))}))}));
}
