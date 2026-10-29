import {normalize} from './domain.mjs';
import {variantSku} from './catalog.mjs';
export function batchProductOptions(items,origin,query=''){
 const words=normalize(query).split(/\s+/).filter(Boolean);
 return items.filter(i=>!i.archived&&!i.deleted_at&&!i.source_snapshot?._inventory_history_only&&i.location===origin&&i.location!=='Vendida'&&i.quantity>0).filter(i=>{const text=normalize([i.name,variantSku(i),i.category,i.color,i.color_code,i.size,i.material,i.composition,i.commercial_name,i.supplier,i.production_lot].join(' '));return words.every(word=>text.includes(word));});
}
