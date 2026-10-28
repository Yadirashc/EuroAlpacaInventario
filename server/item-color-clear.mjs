export async function clearItemColors(c,body){
 if(c.profile.role!=='admin')throw Object.assign(new Error('Solo administradora'),{status:403});
 if(!Array.isArray(body.item_ids)||!body.item_ids.length||body.item_ids.length>500||body.item_ids.some(id=>typeof id!=='string'||! /^[0-9a-z-]+$/i.test(id)))throw Error('Selecciona los registros cuyo color quieres quitar.');
 const ids=[...new Set(body.item_ids)],items=await c.db('items?id=in.('+ids.join(',')+')&archived=eq.false&deleted_at=is.null');
 if(items.length!==ids.length)throw Error('Una prenda ya no está disponible. Actualiza el inventario.');
 const updated=[];
 for(const item of items){
  const snapshot={...(item.source_snapshot||{}),_textile_color_cleared:true};delete snapshot._textile_color_id;
  const rows=await c.db('items?id=eq.'+item.id+(item.updated_at?'&updated_at=eq.'+encodeURIComponent(item.updated_at):''),{method:'PATCH',body:{color:'',color_code:'',source_snapshot:snapshot}});
  if(rows.length!==1)throw Error('La prenda cambió mientras editabas. Actualiza el inventario.');
  updated.push(rows[0]);
 }
 return {items:updated};
}
