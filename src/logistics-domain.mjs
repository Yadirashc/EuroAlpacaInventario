import {variantSku} from './catalog.mjs';
export const shipmentStates=['Pendiente','En preparación','Listo para despacho','En tránsito','Entregado','Recepción confirmada','Cancelado'];
export const supplierNames=['ITESSA','Michell','Inca Tops','Otros proveedores'];
export const editableShipment=s=>['Pendiente','En preparación','Listo para despacho'].includes(s.status);
export const nextShipmentStates=s=>({'Pendiente':['En preparación','Cancelado'],'En preparación':['Listo para despacho','Cancelado'],'Listo para despacho':['En tránsito','Cancelado'],'En tránsito':['Entregado','Recepción confirmada'],'Entregado':['Recepción confirmada']}[s.status]||[]);
export const destination=d=>[d.country,d.city,d.address].filter(Boolean).join(' · ');
export const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
export const materialFromItem=i=>({supplier:i.supplier||'',material:i.material||'',yarn:i.commercial_name||i.material_code||'',composition:i.composition||'',lot:''});
export function traceItemIds(id,lines,moves=[]){const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const l of lines){if(l.destination_item_id&&(ids.has(l.item_id)||ids.has(l.destination_item_id))){for(const key of [l.item_id,l.destination_item_id])if(!ids.has(key)){ids.add(key);changed=true;}}}for(const m of moves){if(['traslado_entrada','traslado_salida'].includes(m.kind)&&/^[0-9a-f-]{36}$/i.test(m.reference||'')&&(ids.has(m.item_id)||ids.has(m.reference))){for(const key of [m.item_id,m.reference])if(!ids.has(key)){ids.add(key);changed=true;}}}}return ids;}
export function validateShipment(data,lines,items){
 const d=data.details;
 for(const key of ['origin','country','city','address','prepared_by','carrier','authorized_by','issued_on'])if(!String(d[key]||'').trim())throw new Error('Completa origen, destino, emisión y responsables.');
 if(data.kind==='envio'&&!data.client_id)throw new Error('Selecciona un cliente.');
 if(!lines.length||lines.length>500)throw new Error('Incluye entre 1 y 500 líneas de prendas.');
 if(d.estimated_on&&d.estimated_on<d.issued_on)throw new Error('La llegada estimada es anterior a la emisión.');
 const totals=new Map();
 for(const l of lines){const i=items.find(i=>i.id===l.item_id);if(!i||i.archived||i.location!==d.origin||i.quantity==null)throw new Error('Revisa el stock y la ubicación de origen.');
  if(!Number.isSafeInteger(l.quantity)||l.quantity<=0)throw new Error('La cantidad debe ser un entero positivo.');
  totals.set(i.id,(totals.get(i.id)||0)+l.quantity);if(totals.get(i.id)>i.quantity)throw new Error('Existencias insuficientes para '+i.name+'.');
  if(!l.shipping_lot?.trim())throw new Error('Identifica el lote de envío.');
  if(!l.materials?.length||l.materials.some(m=>['supplier','material','yarn','composition'].some(k=>!String(m[k]||'').trim())))throw new Error('Completa proveedor, material, hilo y composición de cada línea.');
 }
}
export function shipmentMatches(s,lines,client,filters={}){
 const d=s.details||{},has=(v,q)=>!q||String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(String(q).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase());
 const on=filters.date_mode==='movement'?(d.received_on||d.departed_on||d.issued_on):d.issued_on;
 if(filters.client&&s.client_id!==filters.client||filters.status&&s.status!==filters.status||filters.from&&on<filters.from||filters.to&&on>filters.to)return false;
 if(!has(destination(d),filters.destination)||!has(d.origin,filters.origin)||!has([d.prepared_by,d.carrier,d.authorized_by,d.received_by].join(' '),filters.responsible))return false;
 if(!has([s.code,client?.name,s.client_snapshot?.name,d.order_reference].join(' '),filters.search))return false;
 return lines.some(l=>has([l.production_lot,l.lot_code,l.lot_label].join(' '),filters.lot)&&has([l.snapshot.name,l.snapshot.model_code,variantSku(l.snapshot),l.snapshot.sku].join(' '),filters.model)&&has(l.snapshot.color,filters.color)&&has(l.snapshot.size,filters.size)&&has([l.snapshot.material,...l.materials.map(m=>m.material)].join(' '),filters.material)&&has(l.materials.map(m=>m.supplier).join(' '),filters.supplier));
}
export function reportRows(shipments,lines,lots){return shipments.flatMap(s=>lines.filter(l=>l.shipment_id===s.id).map(l=>({
 'Envío':s.code,'Tipo':s.kind,'Estado':s.status,'Cliente':s.client_snapshot?.name||'Traslado interno','Código de cliente':s.client_snapshot?.code||'','Empresa':s.client_snapshot?.company||'','Correo':s.client_snapshot?.email||'','Teléfono':s.client_snapshot?.phone||'',
 'Pedido / referencia':s.details.order_reference||'','Emisión':s.details.issued_on,'Salida':s.details.departed_on||'','Llegada estimada':s.details.estimated_on||'','Recepción':s.details.received_on||'',
 'Lote de envío':lots.find(x=>x.id===l.lot_id)?.code||l.lot_code||'','Identificación del lote':lots.find(x=>x.id===l.lot_id)?.label||'','Lote de producción':l.production_lot,
 'Código prenda':variantSku(l.snapshot),'Registro inventario':l.snapshot.sku,'Modelo':l.snapshot.name,'Categoría':l.snapshot.category,'Color':l.snapshot.color,'Talla':l.snapshot.size,
 'Material':l.materials.map(m=>m.material).join(' / '),'Composición':l.materials.map(m=>m.composition).join(' / '),'Proveedor':l.materials.map(m=>m.supplier).join(' / '),'Hilo':l.materials.map(m=>m.yarn).join(' / '),'Lote material':l.materials.map(m=>m.lot||'').join(' / '),
 'Cantidad':l.quantity,'Origen':s.details.origin,'País':s.details.country,'Ciudad':s.details.city,'Dirección':s.details.address,'Preparó':s.details.prepared_by,'Transportó':s.details.carrier,'Emitió / autorizó':s.details.authorized_by,'Recibió':s.details.received_by||'','Observaciones':s.details.notes||''
})));}
