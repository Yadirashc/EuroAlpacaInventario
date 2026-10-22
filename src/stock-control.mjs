import {normalize} from './domain.mjs';
export const variantKey=i=>[i.model_code,i.name,i.category,i.material,i.composition,i.color,i.color_code,i.size,i.material_code,i.threads,i.yarn_title,i.gender,i.production_state].map(normalize).join('|');
export const locationGroup=s=>s==='Vendida'?'Vendida':s==='Muestras / revisión'?'Muestras / revisión':/^Lima(?: · |$)/i.test(s)?'Lima':/^Espa[ñn]a(?: · |$)/i.test(s)?'España':'Por verificar';
export function distribution(item,items,operations,logistics={lines:[],shipments:[]}){
 const key=variantKey(item),same=i=>variantKey(i)===key,rows=items.filter(i=>!i.archived&&same(i));
 const sum=rs=>rs.reduce((n,i)=>n+(i.quantity||0),0);
 const sold=operations.filter(o=>['venta','reversion'].includes(o.kind)&&same(o.snapshot)).reduce((n,o)=>n+(o.kind==='venta'?o.quantity:-o.quantity),0);
 const custody=operations.filter(o=>same(o.snapshot)).reduce((n,o)=>n+(o.kind==='entrega'?o.quantity:o.kind==='devolucion'?-o.quantity:0),0);
 const transit=logistics.lines.filter(l=>same(l.snapshot)&&logistics.shipments.some(s=>s.id===l.shipment_id&&['En tránsito','Entregado'].includes(s.status))).reduce((n,l)=>n+l.quantity,0);
 const confirmations=operations.filter(o=>o.kind==='conteo_produccion'&&same(o.snapshot)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const baseline=confirmations[0];
 const production=baseline?baseline.quantity+operations.filter(o=>o.kind==='produccion'&&same(o.snapshot)&&o.created_at>baseline.created_at).reduce((n,o)=>n+o.quantity,0):null;
 return {production,lima:sum(rows.filter(i=>locationGroup(i.location)==='Lima')),spain:sum(rows.filter(i=>locationGroup(i.location)==='España')),unverified:sum(rows.filter(i=>locationGroup(i.location)==='Por verificar')),unknown:rows.some(i=>i.quantity==null),sold,custody,transit,available:sum(rows.filter(i=>!['Por verificar','Vendida'].includes(locationGroup(i.location))))};
}
