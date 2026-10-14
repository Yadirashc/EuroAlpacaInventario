import fs from 'node:fs';
import {compositionLegend} from '../src/composition.mjs';
import {modelIdentity,variantSku} from '../src/catalog.mjs';
const rows=JSON.parse(fs.readFileSync('data/inventory.json'));
const models=new Map(rows.map(r=>{const m=modelIdentity(r);return [m.code,m.name];}));
const codes=new Map(rows.map(r=>[variantSku(r),r]));
const text='# Leyenda de códigos EUROALPACA\n\nEjemplo: **SU38AC**\n\n| Parte | Significado |\n| --- | --- |\n| SU38 | Modelo Suyay, número 38 |\n| AC | 15% baby alpaca y 85% algodón Tangüis |\n\nEl código solo depende del modelo y la composición completa, incluidos los porcentajes. Es igual en todos los colores y tallas. Cada variante mantiene su stock y precio. NC significa composición pendiente; nunca se completa con un material inventado. Las nuevas composiciones reciben un identificador propio hasta asignarles una abreviatura en la leyenda. Los registros internos permanecen estables para trazabilidad.\n\n## Composiciones\n\n| Código | Composición |\n| --- | --- |\n'+Object.entries(compositionLegend).map(([c,n])=>`| ${c} | ${n} |`).join('\n')+'\n\n## Modelos\n\n| Código | Nombre |\n| --- | --- |\n'+[...models].map(([c,n])=>`| ${c} | ${n} |`).join('\n')+'\n\n## Modelo y composición\n\n| Código de prenda | Modelo | Composición |\n| --- | --- | --- |\n'+[...codes].map(([c,r])=>`| ${c} | ${r.name} | ${r.composition||"Sin registrar"} |`).join('\n')+'\n';
fs.writeFileSync('CODIGOS.md',text);console.log('Leyenda escrita: '+models.size+' modelos, '+codes.size+' combinaciones.');
