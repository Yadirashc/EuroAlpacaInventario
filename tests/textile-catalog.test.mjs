import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {textileCatalog,textileFibers,catalogProduct,normalizeTextileData,catalogYarnGroups,catalogColorGroups,canonicalInventoryItem} from '../src/textile-catalog.mjs';
import {standardizeTextiles} from '../scripts/standardize-textiles.mjs';

test('catálogo autorizado: seis familias, siete referencias y KORI de INCA TOPS',()=>{
 assert.equal(textileFibers.length,6);assert.equal(textileCatalog.length,7);
 assert.equal(catalogProduct({name:'KORi',composition:'100% Royal alpaca',supplier:'itessa'}).provider,'INCA TOPS');
 assert.equal(catalogProduct({name:'baby alpaca',composition:'100% baby alpaca',supplier:'INCA TOPS'}).name,'MUHU');
 assert.equal(catalogProduct({name:'baby alpaca',composition:'100% baby alpaca',supplier:'ITESSA'}).name,'BABY ALPACA');
 assert.equal(catalogProduct({name:'Eco baby PET',composition:'30% baby alpaca + 70% PET'}).key,'eco-baby-pet');
 assert.notEqual(catalogProduct({name:'Eco baby PET'}).key,catalogProduct({name:'BABY MICROFIBRA'}).key);
 assert.equal(canonicalInventoryItem({commercial_name:'Cancas',supplier:'INCATOPS',composition:'15% baby alpaca + 85% algodón Tangüis'}).supplier,'ITESSA');
});

test('los prefijos de color se unifican y las fotografías conservan procedencia al corregir proveedor',()=>{
 const suppliers=[{id:'itessa',code:'ITESSA',name:'ITESSA'},{id:'inca',code:'INCATOPS',name:'INCA TOPS'}];
 const yarns=[{id:'cancas',supplier_id:'itessa',name:'Cancas',fiber:'Baby alpaca + algodón',composition:'15% baby alpaca + 85% algodón Tangüis',title:'18/2'},{id:'kori',supplier_id:'itessa',name:'Kori',fiber:'Royal alpaca',composition:'100% Royal alpaca',title:'2/28'}];
 const colors=[{id:'a',yarn_id:'cancas',name:'Guinda',code:'NU - 6330'},{id:'b',yarn_id:'cancas',name:'Guinda',code:'6330'},{id:'k',yarn_id:'kori',name:'Rojo',code:'001'}];
 const source={color_id:'k',yarn_id:'kori',supplier_id:'itessa',provider:'ITESSA',yarn:'Kori',fiber:'Royal alpaca',composition:'100% Royal alpaca',title:'2/28',code:'001'};
 const photos=[{id:'manual',color_id:'k',source_url:'manual',source_identity:source,storage_full:'private/manual.webp',verification_status:'verified'},{id:'official',color_id:'k',source_url:'https://www.itessa.com.pe/',source_identity:source,storage_full:'private/official.webp',verification_status:'verified'}];
 const data=normalizeTextileData({suppliers,yarns,colors,photos});assert.equal(catalogColorGroups(data.colors,data.yarns).length,2);assert.equal(data.photos[0].source_identity.provider,'INCA TOPS');assert.equal(data.photos[0].catalog_source_identity.provider,'ITESSA');assert.equal(data.photos[1].verification_status,'pending');assert.equal(data.photos[1].storage_full,'private/official.webp');assert.equal(source.provider,'ITESSA');
});

test('la copia histórica se unifica sin perder títulos, colores ni referencias originales',{skip:!fs.existsSync('data/textile-seed.json')},()=>{
 const original=JSON.parse(fs.readFileSync('data/textile-seed.json')),snapshot=JSON.stringify(original),data=normalizeTextileData(original),groups=catalogYarnGroups(data.yarns,data.suppliers);
 assert.equal(groups.length,7);assert.equal(JSON.stringify(original),snapshot);assert.equal(data.colors.length,original.colors.length);assert.deepEqual(data.stock,original.stock);
 assert.equal(groups.find(y=>y.name==='KORI').supplier_id,data.suppliers.find(s=>s.code==='INCATOPS').id);
 assert.ok(groups.find(y=>y.name==='CANCAS').titles.includes('18/2'));assert.ok(groups.find(y=>y.name==='CANCAS').titles.includes('2/28'));
 const colors=catalogColorGroups(data.colors,data.yarns);assert.deepEqual(new Set(colors.flatMap(c=>c.color_group.map(row=>row.id))),new Set(original.colors.map(c=>c.id)));
 assert.deepEqual(catalogYarnGroups(normalizeTextileData(data).yarns,data.suppliers).map(y=>y.name),groups.map(y=>y.name));
});

test('unificación persistente conserva prendas y kg, respalda los registros y es idempotente',async()=>{
 const suppliers=[{id:'itessa',stage:'preview',code:'ITESSA',name:'Itessa'},{id:'inca',stage:'preview',code:'INCATOPS',name:'INCATOPS'}],yarns=textileCatalog.map(product=>({id:product.key,stage:'preview',supplier_id:product.providerCode==='ITESSA'?'itessa':'inca',name:product.name,fiber:product.fiber,composition:product.composition,title:'2/28',reference_key:product.key}));
 yarns.push({...yarns.find(y=>y.id==='cancas'),id:'cancas-antiguo',supplier_id:'inca',reference_key:'old-cancas'});
 const colors=yarns.map(y=>({id:'color-'+y.id,stage:'preview',yarn_id:y.id,code:'201',name:'Rojo'})),stock=colors.map(c=>({id:'stock-'+c.id,stage:'preview',color_id:c.id,stock_kg:1.25}));
 const state={textile_suppliers:suppliers,textile_yarns:yarns,textile_colors:colors,textile_stock:stock,textile_photos:[],items:[{id:'item',quantity:7,material:'Original',notes:'Conservar'}],textile_sync_runs:[]};
 const before=structuredClone(state);let writes=0;
 const fetcher=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer test-server-key');const parsed=new URL(url),table=parsed.pathname.split('/').at(-1);let rows=state[table];assert.ok(rows,table);let matches=rows.filter(row=>[...parsed.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3)));
  if(options.method==='POST'){const body=JSON.parse(options.body);rows.push(body);writes++;return Response.json([body]);}
  if(options.method==='PATCH'){const body=JSON.parse(options.body);for(const row of matches)Object.assign(row,body);writes++;return Response.json(matches);}
  matches=[...matches].sort((a,b)=>String(a.id).localeCompare(String(b.id)));const offset=Number(parsed.searchParams.get('offset')||0),limit=Number(parsed.searchParams.get('limit')||1000);return Response.json(matches.slice(offset,offset+limit));};
 const result=await standardizeTextiles({url:'https://example.test',key:'test-server-key',stage:'preview',fetcher});
 assert.equal(result.commercial_yarns,7);assert.equal(result.fiber_families,6);assert.equal(result.inventory_preserved,true);assert.equal(result.stock_preserved,true);
 assert.deepEqual(state.items,before.items);assert.deepEqual(state.textile_stock,before.textile_stock);assert.deepEqual(state.textile_colors.map(row=>[row.id,row.yarn_id]),before.textile_colors.map(row=>[row.id,row.yarn_id]));
 const backup=state.textile_sync_runs.find(row=>row.status==='Respaldo');assert.deepEqual(JSON.parse(backup.details).before.yarns,before.textile_yarns.toSorted((a,b)=>a.id.localeCompare(b.id)));
 const count=writes,repeat=await standardizeTextiles({url:'https://example.test',key:'test-server-key',stage:'preview',fetcher});assert.equal(repeat.already_applied,true);assert.equal(writes,count);
});
