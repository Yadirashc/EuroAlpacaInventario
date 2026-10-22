import {normalize} from './domain.mjs';

export const isAllin=i=>normalize(i.category).startsWith('BUFAND')&&/^(?:BUFANDAS?\s+(?:DE\s+)?)?(?:ALLIN|CANCAS)(?:\s*\/\s*(?:ALLIN|CANCAS))?$/.test(normalize(i.name));
export function uniqueRows(rows){const seen=new Set();return rows.filter(i=>{if(seen.has(i.id))return false;seen.add(i.id);return true;});}
export function allinTotals(rows){
 const original=uniqueRows(rows).filter(i=>!i.archived);
 return {rows:original,quantity:original.filter(i=>i.location!=='Vendida').reduce((n,i)=>n+(i.quantity??0),0),sold:original.filter(i=>i.location==='Vendida').reduce((n,i)=>n+(i.quantity??0),0),unknown:original.filter(i=>i.quantity==null).length};
}
export function allinBreakdown(rows){
 const groups=new Map();
 for(const i of uniqueRows(rows).filter(i=>!i.archived)){
  const key=JSON.stringify([i.material,i.composition,i.color,i.size,i.location].map(normalize));
  if(!groups.has(key))groups.set(key,{material:i.material,composition:i.composition,color:i.color,size:i.size,location:i.location,quantity:0,unknown:0,items:[]});
  const group=groups.get(key);group.quantity+=i.quantity??0;group.unknown+=i.quantity==null?1:0;group.items.push(i);
 }
 return [...groups.values()].sort((a,b)=>a.material.localeCompare(b.material,'es')||a.color.localeCompare(b.color,'es')||a.size.localeCompare(b.size,'es')||a.location.localeCompare(b.location,'es'));
}
export function groupAllinRows(rows){
 const members=uniqueRows(rows.filter(i=>!i.archived&&isAllin(i)));
 if(!members.length)return rows;
 let emitted=false;return rows.flatMap(i=>{if(!isAllin(i))return [i];if(emitted)return [];emitted=true;const totals=allinTotals(members);return [{...members[0],id:'allin-unified',name:'Allin / Cancas',quantity:totals.quantity,allin_group:members,allin_unknown:totals.unknown,allin_sold:totals.sold}];});
}
export const expandAllinRows=rows=>rows.flatMap(i=>i.allin_group||[i]);
