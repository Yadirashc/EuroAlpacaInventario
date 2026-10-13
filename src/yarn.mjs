// El Excel original usa numFmtId 164, formatCode d/m, para estas celdas.
// Devuelve el valor que muestra el Excel, sin inventar una relación 2/18.
export function displayYarnTitle(value){const s=String(value??'').trim();const date=s.match(/^\d{4}-(\d{2})-(\d{2})(?:[ T].*)?$/);if(date)return Number(date[2])+'/'+Number(date[1]);if(/^\d{5}(?:\.0+)?$/.test(s)){const d=new Date(Date.UTC(1899,11,30)+Number(s)*86400000);return d.getUTCDate()+'/'+(d.getUTCMonth()+1);}return s;}
