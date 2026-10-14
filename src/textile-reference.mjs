import {supplierSources,keyText,colorFamily} from './textile-domain.mjs';
export function textileSeed(items,id=()=>crypto.randomUUID(),stage='preview'){
 const suppliers=supplierSources.map(s=>({...s,id:id('supplier|'+s.code),stage,active:true,last_checked_at:null,last_catalog_at:null})),yarns=[],colors=[],stock=[];
 const yarnMap=new Map(),colorMap=new Map();
 for(const item of items){const code=keyText(item.supplier).replace(/[^A-Z]/g,'');let supplier=suppliers.find(s=>s.code===code||s.code==='INCATOPS'&&code==='INCATOP');
 if(!supplier){const name=item.supplier||'Proveedor por confirmar';supplier=suppliers.find(s=>s.name===name);if(!supplier){supplier={id:id('supplier|'+name),stage,code:code||'PENDIENTE',name,website:'',catalog_url:'',integration_status:'Pendiente de confirmación',integration_notes:'Nombre registrado en el inventario de origen.',active:true};suppliers.push(supplier);}}
 const name=item.commercial_name||item.material||'Hilo sin nombre comercial',reference_key=[name,item.material,item.composition,item.yarn_title].map(keyText).join('|'),yk=supplier.id+'|'+reference_key;
 let yarn=yarnMap.get(yk);if(!yarn){yarn={id:id('yarn|'+yk),stage,supplier_id:supplier.id,reference_key,code:item.material_code||'',name,fiber:item.material||'',composition:item.composition||'',title:item.yarn_title||'',technical_notes:item.threads?'Hebras registradas: '+item.threads:'',collection:'',source_url:'',source_note:'Referencia del inventario Excel. Código de material original; confirmar referencia comercial del hilo con el proveedor.',verified_at:null,active:true};yarnMap.set(yk,yarn);yarns.push(yarn);}
 if(!item.color)continue;const ck=keyText(item.color_code||'')+'|'+keyText(item.color),unique=yarn.id+'|'+ck;if(colorMap.has(unique))continue;
 const color={id:id('color|'+unique),stage,yarn_id:yarn.id,reference_key:ck,code:item.color_code||'',name:item.color,family:colorFamily(item.color),collection:'',supplier_availability:'Pendiente de confirmación',availability_verified_at:null,availability_source:'',active:true};colorMap.set(unique,color);colors.push(color);stock.push({id:id('stock|'+unique),stage,color_id:color.id,stock_kg:null,verified_at:null,notes:'Stock de hilo en kg pendiente de conteo; no se deriva de las cantidades de prendas.'});
 }
 return {suppliers,yarns,colors,stock,requirements:[],photos:[],folders:[],history:[],notifications:[],runs:[]};
}
