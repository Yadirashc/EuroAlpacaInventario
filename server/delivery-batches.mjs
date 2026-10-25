import {createHash} from 'node:crypto';
const clean=value=>String(value||'').trim();
const uuid=value=>{const hash=createHash('sha256').update(value).digest('hex');return hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);};
const variantFields=['model_code','name','category','material','composition','color','color_code','size','material_code','threads','yarn_title','gender','production_state','supplier','commercial_name','production_lot'];
export const sameBatchVariant=(a,b)=>variantFields.every(key=>String(a[key]??'')===String(b[key]??''));
export async function listDeliveryBatches(c){const [shipments,lines,lots,events,legacy]=await Promise.all(['logistics_shipments?select=*&order=created_at.desc&limit=10000','logistics_lines?select=*&limit=10000','logistics_lots?select=*&limit=10000','logistics_events?select=*&order=created_at.desc&limit=10000','stock_operations?select=*&kind=in.(entrega,devolucion,traslado)&order=created_at.desc&limit=10000'].map(path=>c.db(path)));return {shipments:shipments.filter(s=>!s.deleted_at),lines,lots,events,legacy:legacy.filter(o=>!o.details?.batch_id)};}
export async function saveDeliveryBatch(c,body){
 if(!['admin','operadora'].includes(c.profile.role))throw Object.assign(new Error('Tu cuenta solo permite consultar.'),{status:403});
 const id=clean(body.id||body.batch_id);if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Identificador de lote inválido.');
 let [batch]=await c.db('logistics_shipments?id=eq.'+id+'&select=*');
 if(batch&&batch.details?.batch_schema!=='delivery-v1')throw Error('Este registro corresponde al historial anterior.');
 if(batch&&c.profile.role!=='admin'&&batch.created_by!==c.profile.id)throw Object.assign(new Error('Solo el responsable o la administradora puede completar este lote.'),{status:403});
 const fingerprint=createHash('sha256').update(JSON.stringify({kind:body.kind,details:body.details,lines:body.lines})).digest('hex');
 if(batch&&!body.resume&&batch.details.batch_fingerprint!==fingerprint)throw Error('El número de solicitud ya se utilizó con otros datos.');
 if(!batch){
  const kind=body.kind,d=body.details||{},rows=Array.isArray(body.lines)?body.lines:[];
  if(!['entrega','traslado'].includes(kind))throw Error('Selecciona Entrega o Traslado.');
  for(const field of ['number','date','origin','destination','responsible'])if(!clean(d[field]))throw Error('Completa número de lote, fecha, ubicaciones y responsable.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||d.date>new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'}))throw Error('La fecha de salida no puede estar en el futuro.');
  if(kind==='traslado'&&d.origin===d.destination)throw Error('El destino debe ser diferente del origen.');
  if(kind==='entrega'&&(!clean(d.recipient)||!clean(d.company)))throw Error('Completa quién recibe y la marca o empresa.');
  if(!rows.length||rows.length>500)throw Error('Agrega entre 1 y 500 prendas al lote.');
  const [duplicate]=await c.db('logistics_shipments?details->>batch_number=eq.'+encodeURIComponent(clean(d.number))+'&deleted_at=is.null&limit=1');if(duplicate)throw Error('Ya existe un lote con ese número.');
  const ids=[...new Set(rows.map(row=>row.item_id))];if(ids.some(value=>!/^[0-9a-f-]{36}$/i.test(value)))throw Error('Selecciona prendas registradas en el inventario.');
  const items=await c.db('items?id=in.('+ids.join(',')+')&select=*'),totals=new Map(),lines=[];
  for(const row of rows){const item=items.find(i=>i.id===row.item_id&&!i.archived&&i.location===d.origin&&i.location!=='Vendida');if(!item||item.quantity==null||!Number.isSafeInteger(row.quantity)||row.quantity<1)throw Error('Revisa prendas, cantidades y origen.');const sum=(totals.get(item.id)||0)+row.quantity;if(sum>item.quantity)throw Error('Stock insuficiente para '+item.name);totals.set(item.id,sum);
   const material={supplier:clean(row.supplier||item.supplier),material:clean(row.material||item.material),yarn:clean(row.yarn||item.commercial_name||item.material_code),composition:clean(row.composition||item.composition),title:clean(row.title||item.yarn_title),lot:item.production_lot||''};
   if(['supplier','material','yarn','composition'].some(field=>!material[field]))throw Error('Completa el material y proveedor de '+item.name+' en el lote.');
   lines.push({item_id:item.id,quantity:row.quantity,production_lot:item.production_lot||'',shipping_lot:clean(d.number),materials:[material]});
  }
  let clientId=null;if(kind==='entrega'){clientId=uuid(id+':client');const [existing]=await c.db('logistics_clients?id=eq.'+clientId+'&select=id');if(!existing)await c.db('rpc/logistics_save_client',{method:'POST',body:{p_id:clientId,p_data:{name:clean(d.recipient),company:clean(d.company),country:'',city:'',address:clean(d.destination),phone:clean(d.phone),email:'',notes:'Cliente del lote '+clean(d.number)},p_version:0}});}
  const details={batch_schema:'delivery-v1',batch_kind:kind,batch_number:clean(d.number),batch_fingerprint:fingerprint,batch_state:'Preparado',origin:clean(d.origin),destination:clean(d.destination),country:'Por confirmar',city:'Por confirmar',address:clean(d.destination),prepared_by:clean(d.responsible),carrier:clean(d.carrier||d.responsible),authorized_by:clean(d.responsible),issued_on:d.date,departed_on:d.date,received_by:clean(d.recipient||d.responsible),received_on:d.date,recipient:clean(d.recipient),company:clean(d.company),notes:clean(d.notes)};
  try{await c.db('rpc/logistics_save_shipment',{method:'POST',body:{p_id:id,p_data:{kind:kind==='entrega'?'envio':'traslado',client_id:clientId,details},p_lines:lines,p_version:0}});}catch(error){const [saved]=await c.db('logistics_shipments?id=eq.'+id+'&select=*');if(!saved||saved.details.batch_fingerprint!==fingerprint)throw error;}
  [batch]=await c.db('logistics_shipments?id=eq.'+id+'&select=*');
 }
 if(batch.details.batch_state==='Completado')return {batch_id:id,completed:true,already_applied:true};
 const lines=await c.db('logistics_lines?shipment_id=eq.'+id+'&select=*&order=id'),d=batch.details,kind=d.batch_kind;
 let completed=0;
 await c.db('logistics_shipments?id=eq.'+id,{method:'PATCH',service:true,body:{details:{...d,batch_state:'En proceso'},updated_at:new Date().toISOString()}});
 try{
  for(const line of lines){
   const operation=uuid(id+':'+line.id+':'+kind),details={date:d.issued_on,person:d.received_by,responsible:d.prepared_by,destination:d.destination,client:d.recipient,company:d.company,reason:'otro',reference:d.batch_number,notes:d.notes,batch_id:id,batch_number:d.batch_number};
   if(kind==='entrega')await c.db('rpc/stock_operate',{method:'POST',body:{p_id:operation,p_item:line.item_id,p_kind:'entrega',p_quantity:line.quantity,p_details:details,p_related:null}});
   else{
    const [done]=await c.db('movements?id=eq.'+operation+'&select=id');if(!done){
     const [source]=await c.db('items?id=eq.'+line.item_id+'&select=*');if(!source)throw Error('La prenda de origen ya no existe.');
     const candidates=await c.db('items?archived=eq.false&location=eq.'+encodeURIComponent(d.destination)+'&select=*');
     let target=candidates.find(row=>row.id!==source.id&&sameBatchVariant(row,line.snapshot));
     if(!target){const targetId=uuid(id+':'+line.id+':destination');const [oldTarget]=await c.db('items?id=eq.'+targetId+'&select=*');target=oldTarget;
      if(!target){const copy={...line.snapshot,id:targetId,sku:'LOTE-'+targetId,location:d.destination,quantity:0,archived:false};if('created_at' in copy)copy.created_at=new Date().toISOString();if('updated_at' in copy)copy.updated_at=new Date().toISOString();try{[target]=await c.db('items',{method:'POST',service:true,body:copy});}catch(error){[target]=await c.db('items?id=eq.'+targetId+'&select=*');if(!target)throw error;}}
     }
     if(!target||target.location!==d.destination||!sameBatchVariant(target,line.snapshot))throw Error('La variante de destino cambió. Revisa el traslado.');
     await c.db('rpc/transfer_stock',{method:'POST',body:{p_from:line.item_id,p_to:target.id,p_amount:line.quantity,p_reason:'Traslado '+d.batch_number,p_request:operation}});
     await c.db('logistics_lines?id=eq.'+line.id,{method:'PATCH',service:true,body:{destination_item_id:target.id}});
    }
   }
   completed++;
  }
 }catch(error){await c.db('logistics_shipments?id=eq.'+id,{method:'PATCH',service:true,body:{details:{...d,batch_state:'Pendiente de completar',completed_lines:completed,last_error:error.message},updated_at:new Date().toISOString()}});throw Object.assign(new Error('Lote '+d.batch_number+': '+error.message+' Los movimientos ya guardados se conservan; puedes completar el lote sin repetirlos.'),{status:400,batch_id:id});}
 await c.db('logistics_shipments?id=eq.'+id,{method:'PATCH',service:true,body:{status:kind==='traslado'?'Recepción confirmada':'Entregado',details:{...d,batch_state:'Completado',completed_lines:lines.length,last_error:''},received_at:new Date().toISOString(),dispatched_at:batch.dispatched_at||new Date().toISOString(),updated_at:new Date().toISOString()}});
 await c.db('logistics_events',{method:'POST',service:true,body:{shipment_id:id,actor:c.profile.id,actor_name:c.profile.full_name||'',action:kind==='traslado'?'Traslado de lote completado':'Entrega de lote completada',previous_status:batch.status,status:kind==='traslado'?'Recepción confirmada':'Entregado',details:{batch_number:d.batch_number,lines:lines.length}}});
 return {batch_id:id,completed:true};
}
