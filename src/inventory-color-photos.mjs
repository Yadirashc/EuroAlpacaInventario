import {catalogColorGroups} from './textile-catalog.mjs';
import {visualColorMatches,colorReferencePhoto} from './color-profile.mjs';
// Relación visual: no reescribe composición, proveedor ni cantidades de la prenda.
export function inventoryColorMatches(item,data){return catalogColorGroups(data.colors.filter(c=>c.active!==false&&!c.deleted_at),data.yarns).filter(color=>visualColorMatches(item,color,data.colors)).map(color=>({color,photo:colorReferencePhoto(color,data)}));}
export function inventoryColorPhoto(item,data){const match=inventoryColorRecord(item,data);return match?.photo?match:null;}
export function inventoryColorRecord(item,data){const matches=inventoryColorMatches(item,data),selected=item.source_snapshot?._textile_color_id;return matches.find(match=>match.color.id===selected||match.color.color_group.some(c=>c.id===selected))||matches.find(match=>match.photo)||matches[0]||null;}
