import {normalize} from './domain.mjs';
import {modelKey,materialCode,isWayraSet} from './catalog.mjs';
import {compositionKey} from './composition.mjs';

const keyText=value=>normalize(value).replace(/\s+/g,' ');
export function groupInventoryRows(rows){
 const groups=new Map(),result=[],seen=new Set();
 for(const row of rows){
  if(row.allin_group||row.inventory_group||!row.name||!row.color||!row.location){result.push(row);continue;}
  if(seen.has(row.id))continue;seen.add(row.id);
  const key=JSON.stringify([modelKey(row),isWayraSet(row)?keyText(row.category):'',materialCode(row),compositionKey(row.composition),keyText(row.color),keyText(row.color_code),row.source_snapshot?._textile_color_id||'',keyText(row.size),keyText(row.location)]);
  if(!groups.has(key)){const group={...row,inventory_group:[row]};groups.set(key,group);result.push(group);}
  else groups.get(key).inventory_group.push(row);
 }
 return result.map(row=>{
  if(!row.inventory_group||row.inventory_group.length===1)return row.inventory_group?.[0]||row;
  return {...row,id:'inventory-group-'+row.inventory_group[0].id,quantity:row.inventory_group.reduce((sum,item)=>sum+(item.quantity??0),0),inventory_unknown:row.inventory_group.filter(item=>item.quantity==null).length};
 });
}
export const expandInventoryRows=rows=>rows.flatMap(row=>row.inventory_group||[row]);
