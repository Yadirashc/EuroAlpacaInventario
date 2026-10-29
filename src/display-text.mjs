// Presentación únicamente: los identificadores y códigos conservan sus valores.
export function displayText(value){return String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es').replace(/\p{L}/u,letter=>letter.toLocaleUpperCase('es'));}
