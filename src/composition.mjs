export function compositionKey(value){
 const text=String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
 const parts=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*%\s*([^%]+?)(?=\s*\d+(?:[.,]\d+)?\s*%|$)/g)];
 if(!parts.length)return text.replace(/[^A-Z0-9]/g,'');
 return parts.map(m=>Number(m[1].replace(',','.'))+'%'+m[2].replace(/[^A-Z]/g,'')).sort().join('|');
}
export const compositionLegend={BA:'100% baby alpaca',AC:'15% baby alpaca · 85% algodón Tangüis',AM:'30% baby alpaca · 70% microfibra',AP:'30% baby alpaca · 70% PET',RA:'100% royal alpaca',IA:'100% imperial alpaca'};
const known=new Map(Object.entries(compositionLegend).map(([code,text])=>[compositionKey(text),code]));
export function compositionCode(value){
 const key=compositionKey(value);if(!key)return 'NC';if(known.has(key))return known.get(key);
 let hash=2166136261;for(const c of key){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return 'C'+(hash>>>0).toString(36).toUpperCase().padStart(7,'0');
}
