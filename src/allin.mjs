import {normalize} from './domain.mjs';
import {compareInventory,compareText} from './inventory-order.mjs';

export const isAllin=i=>normalize(i.category).startsWith('BUFAND')&&/^(?:BUFANDAS?\s+(?:DE\s+)?)?(?:ALLIN|CANCAS)(?:\s*\/\s*(?:ALLIN|CANCAS))?$/.test(normalize(i.name));
export function uniqueRows(rows){const seen=new Set();return rows.filter(i=>{if(seen.has(i.id))return false;seen.add(i.id);return true;});}
export function allinTotals(rows){
 const original=uniqueRows(rows).filter(i=>!i.archived);
 return {rows:original,quantity:original.filter(i=>i.location!=='Vendida').reduce((n,i)=>n+(i.quantity??0),0),sold:original.filter(i=>i.location==='Vendida').reduce((n,i)=>n+(i.quantity??0),0),unknown:original.filter(i=>i.quantity==null).length};
}
export function allinBreakdown(rows){
 const groups=new Map();
 for(const i of uniqueRows(rows).filter(i=>!i.archived)){
  const key=JSON.stringify([i.location,i.material,i.composition,i.color,i.size].map(normalize));
  if(!groups.has(key))groups.set(key,{material:i.material,composition:i.composition,color:i.color,size:i.size,location:i.location,production_state:i.production_state,quantity:0,unknown:0,items:[]});
  const group=groups.get(key);group.quantity+=i.quantity??0;group.unknown+=i.quantity==null?1:0;group.items.push(i);group.production_state=new Set(group.items.map(row=>row.production_state||'Sin registrar')).size>1?'Varios acabados (ver registros)':i.production_state;
 }
 return [...groups.values()].sort((a,b)=>compareText(a.location,b.location)||compareInventory(a,b));
}
export function groupAllinRows(rows){
 const members=uniqueRows(rows.filter(i=>!i.archived&&isAllin(i)));
 if(!members.length)return rows;
 let emitted=false;return rows.flatMap(i=>{if(!isAllin(i))return [i];if(emitted)return [];emitted=true;return allinBreakdown(members).map((g,n)=>({...g.items[0],id:'allin-split-'+n,name:'Allin',quantity:g.quantity,production_state:g.production_state,allin_group:g.items,allin_unknown:g.unknown,allin_sold:g.location==='Vendida'?g.quantity:0}));});
}
export const expandAllinRows=rows=>rows.flatMap(i=>i.allin_group||[i]);
