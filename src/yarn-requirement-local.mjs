import {pendingKg} from './textile-domain.mjs';
import {sharedColorKey,textileText} from './textile-link.mjs';
export function saveLocalRequirement(data,body,old,{stage='preview',id=crypto.randomUUID(),actor}={}){
 const received=Number(old?.received_kg||0),fresh=!body.color_id,stock=data.stock.find(s=>s.color_id===body.color_id&&!s.deleted_at),available=fresh?0:stock?.stock_kg??null;
 if(received&&(Number(old.required_kg)!==body.required_kg||old.color_id!==body.color_id))throw Error('Conserva el hilo y la cantidad del requerimiento con recepciones');
 const purchasing=['Orden de compra emitida','En tránsito','Recibido parcialmente','Recibido completamente'].includes(body.status);if(purchasing&&available===null)throw Error('Confirma el stock interno antes de emitir la orden');
 const values={...body,id:old?.id||id,stage,created_by:actor,sequence:old?.sequence||data.requirements.length+1,received_kg:received,available_kg:available,pending_kg:available===null?null:Math.max(0,pendingKg(body.required_kg,available)-(fresh?received:0)),purchase_kg:old?.purchase_kg??(purchasing?pendingKg(body.required_kg,available):null),updated_at:new Date().toISOString()};
 if(old)Object.assign(old,values);else data.requirements.push(values);return old||values;
}
export function receiveLocalRequirement(data,r,amount,id=crypto.randomUUID()){
 data.local_receipts??=[];if(data.local_receipts.some(x=>x.id===id))return;
 if(!['Orden de compra emitida','En tránsito','Recibido parcialmente'].includes(r.status)||!(amount>0)||r.received_kg+amount>r.purchase_kg)throw Error('Revisa el estado y la cantidad de la recepción');
 const total=Number(r.received_kg)+amount,fresh=!r.color_id,complete=total===Number(r.purchase_kg);let color=data.colors.find(c=>c.id===r.color_id),stock=color&&data.stock.find(s=>s.color_id===color.id&&!s.deleted_at);
 if(!fresh&&stock?.stock_kg==null)throw Error('Confirma primero el stock interno');
 if(fresh&&complete){const p=r.proposed_yarn;let supplier=data.suppliers.find(s=>s.id===p.supplier_id),target={name:p.name,code:p.code};
  if(!supplier&&p.supplier_id==='__new')supplier=data.suppliers.find(s=>textileText(s.name)===textileText(p.supplier_name));
  const technical={name:p.yarn_name,fiber:p.fiber,composition:p.composition};
  color=supplier&&data.colors.filter(c=>!c.deleted_at&&c.active!==false).find(c=>{const y=data.yarns.find(y=>y.id===c.yarn_id);return y&&y.supplier_id===supplier.id&&sharedColorKey(c,y,supplier)===sharedColorKey(target,technical,supplier);});
  stock=color&&data.stock.find(s=>s.color_id===color.id&&!s.deleted_at);if(color&&stock?.stock_kg==null)throw Error('El hilo ya existe: confirma su stock interno');
  if(!supplier){supplier={id:crypto.randomUUID(),name:p.supplier_name,code:'CUSTOM-'+crypto.randomUUID(),active:true,stage:r.stage};data.suppliers.push(supplier);}
  if(!color){let yarn=data.yarns.find(y=>y.supplier_id===supplier.id&&textileText(y.name)===textileText(p.yarn_name)&&textileText(y.composition)===textileText(p.composition)&&textileText(y.fiber)===textileText(p.fiber)&&y.title===(p.title||'')&&!y.deleted_at&&y.active!==false);if(!yarn){yarn={id:crypto.randomUUID(),stage:r.stage,supplier_id:supplier.id,reference_key:'shared-yarn:'+crypto.randomUUID(),name:p.yarn_name,code:p.yarn_code||'',fiber:p.fiber,composition:p.composition,title:p.title||'',active:true};data.yarns.push(yarn);}
   color={id:crypto.randomUUID(),stage:r.stage,yarn_id:yarn.id,reference_key:'shared-color:'+crypto.randomUUID(),name:p.name,code:p.code||'',family:'Sin clasificar',active:true};data.colors.push(color);stock={id:crypto.randomUUID(),stage:r.stage,color_id:color.id,stock_kg:0};data.stock.push(stock);data.color_profiles??=[];data.color_profiles.push({color_id:color.id,scope:'catalog',family:p.family||'Sólidos'});
  }
  r.color_id=color.id;r.catalog_registered_at=new Date().toISOString();
 }
 if(!fresh||complete){stock.stock_kg=Number(stock.stock_kg)+(fresh?total:amount);stock.verified_at=new Date().toISOString();for(const req of data.requirements.filter(q=>q.color_id===r.color_id&&!['Cancelado','Recibido completamente'].includes(q.status))){req.available_kg=stock.stock_kg;req.pending_kg=pendingKg(req.required_kg,stock.stock_kg);}}
 r.received_kg=total;r.status=complete?'Recibido completamente':'Recibido parcialmente';if(fresh&&!complete)r.pending_kg=Math.max(0,r.required_kg-total);r.updated_at=new Date().toISOString();data.local_receipts.push({id,requirement_id:r.id,amount_kg:amount});
}
