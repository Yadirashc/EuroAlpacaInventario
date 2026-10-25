import {randomUUID} from 'node:crypto';
export function memoryDb(seed,options={}){
 const state=structuredClone(seed);for(const table of ['textile_photo_sources','logistics_clients','logistics_shipments','logistics_lines','logistics_lots','logistics_events','movements','stock_operations'])state[table]??=[];
 const copy=value=>structuredClone(value),db=async(path,config={})=>{
  const [table,query='']=path.split('?'),params=new URLSearchParams(query),body=config.body;
  if(table.startsWith('rpc/')){
   if(table==='rpc/logistics_save_client'){if(!state.logistics_clients.some(c=>c.id===body.p_id))state.logistics_clients.push({id:body.p_id,...body.p_data,version:1});return body.p_id;}
   if(table==='rpc/logistics_save_shipment'){
    if(state.logistics_shipments.some(s=>s.id===body.p_id))throw Error('Ya existe');
    const shipment={id:body.p_id,...body.p_data,code:'ENV-'+state.logistics_shipments.length,status:'Pendiente',created_by:options.actor||'actor',version:1,created_at:new Date().toISOString()};state.logistics_shipments.push(shipment);
    for(const line of body.p_lines)state.logistics_lines.push({...line,id:randomUUID(),shipment_id:body.p_id,snapshot:copy(state.items.find(i=>i.id===line.item_id))});return body.p_id;
   }
   if(table==='rpc/transfer_stock'){
    if(state.movements.some(m=>m.id===body.p_request))return null;
    if(options.failTransfer?.(body))throw Error('Fallo temporal simulado');
    const from=state.items.find(i=>i.id===body.p_from),to=state.items.find(i=>i.id===body.p_to);if(!from||!to||from.quantity<body.p_amount)throw Error('Stock insuficiente');from.quantity-=body.p_amount;to.quantity+=body.p_amount;state.movements.push({id:body.p_request,item_id:from.id,amount:body.p_amount,kind:'traslado_salida'});return null;
   }
   if(table==='rpc/stock_operate'){
    if(state.stock_operations.some(o=>o.id===body.p_id))return body.p_id;
    const item=state.items.find(i=>i.id===body.p_item);if(item.quantity<body.p_quantity)throw Error('Stock insuficiente');const snapshot=copy(item);item.quantity-=body.p_quantity;state.stock_operations.push({id:body.p_id,kind:body.p_kind,details:copy(body.p_details),quantity:body.p_quantity,snapshot});return body.p_id;
   }
   throw Error('RPC inesperado '+table);
  }
  if(!state[table])throw Error('Tabla inesperada '+table);
  const matches=row=>[...params].every(([key,value])=>{
   if(['select','order','limit','offset','on_conflict'].includes(key))return true;
   const actual=key.includes('->>')?row[key.split('->>')[0]]?.[key.split('->>')[1]]:row[key];
   if(value.startsWith('eq.'))return String(actual)===value.slice(3);
   if(value.startsWith('in.('))return value.slice(4,-1).split(',').includes(String(actual));
   if(value==='is.null')return actual==null;
   if(value.startsWith('like.'))return String(actual).startsWith(value.slice(5).replaceAll('*',''));
   return true;
  });
  if(config.method==='POST'){
   const rows=Array.isArray(body)?body:[body];for(const row of rows){const existing=table==='textile_photo_sources'&&state[table].find(r=>r.stage===row.stage&&r.source_key===row.source_key);if(existing&&config.merge)Object.assign(existing,copy(row));else{if(row.id&&state[table].some(r=>r.id===row.id))throw Error('ID duplicado');state[table].push(copy(row));}}return copy(rows);
  }
  const rows=state[table].filter(matches);
  if(config.method==='PATCH'){for(const row of rows)Object.assign(row,copy(body));return copy(rows);}
  return copy(rows);
 };
 return {state,db};
}
