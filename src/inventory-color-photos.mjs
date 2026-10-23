import {sameVariant,verifiedPhoto} from './photo-identity.mjs';
import {displayYarnTitle} from './yarn.mjs';

// Coincidencia técnica completa: nunca inferir una fotografía solo por el nombre del color.
export function inventoryColorPhoto(item,data){
 const identity={provider:item.supplier,yarn:item.commercial_name,code:item.color_code,composition:item.composition,title:displayYarnTitle(item.yarn_title),fiber:item.material};
 const matches=[];
 for(const color of data.colors){
  if(color.active===false||color.deleted_at)continue;
  const yarn=data.yarns.find(row=>row.id===color.yarn_id&&row.active!==false&&!row.deleted_at);
  const supplier=yarn&&data.suppliers.find(row=>row.id===yarn.supplier_id&&row.active!==false&&!row.deleted_at);
  if(!yarn||!supplier)continue;
  const candidate={color_id:color.id,yarn_id:yarn.id,supplier_id:supplier.id,provider:supplier.name,yarn:yarn.name,code:color.code,composition:yarn.composition,title:displayYarnTitle(yarn.title),fiber:yarn.fiber};
  if(!sameVariant({...candidate,fiber:identity.fiber},identity))continue;
  const photo=verifiedPhoto(data.photos,{...candidate,title:yarn.title});
  if(photo)matches.push({color,photo});
 }
 // Varias fichas con fotografías diferentes requieren revisión antes de elegir una.
 const unique=new Map(matches.map(match=>[match.photo.storage_full||match.photo._url||match.photo.id,match]));
 return unique.size===1?[...unique.values()][0]:null;
}
