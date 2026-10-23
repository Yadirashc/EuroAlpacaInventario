import {createHash,randomUUID} from 'node:crypto';
import {normalizeTextileData,catalogYarnGroups,catalogColorGroups,textileFibers} from '../src/textile-catalog.mjs';

// Ejecutar una sola vez por versión del catálogo, con la identidad de servidor ya configurada.
export async function standardizeTextiles({url,key,stage='production',fetcher=fetch}){
 const call=async(path,options={})=>{const response=await fetcher(url+'/rest/v1/'+path,{method:options.method||'GET',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:options.body===undefined?undefined:JSON.stringify(options.body)});const body=await response.json();if(!response.ok)throw new Error('No se pudo unificar '+path.split('?')[0]+': '+(body.message||response.status));return body;};
 const read=async table=>{const result=[];for(let offset=0;;offset+=1000){const rows=await call(table+'?select=*&'+(table==='items'?'':'stage=eq.'+stage+'&')+'order=id&limit=1000&offset='+offset);result.push(...rows);if(rows.length<1000)return result;}};
 const source='Catálogo textil unificado v1.1 — 2026-10-23';
 const complete=await call('textile_sync_runs?stage=eq.'+stage+'&source=eq.'+encodeURIComponent(source)+'&status=eq.Completado&limit=1');if(complete.length)return {already_applied:true,...JSON.parse(complete[0].details).summary};
 const tables={suppliers:'textile_suppliers',yarns:'textile_yarns',colors:'textile_colors',stock:'textile_stock',photos:'textile_photos',items:'items'};
 const pairs=await Promise.all(Object.entries(tables).map(async([name,table])=>[name,await read(table)])),before=Object.fromEntries(pairs);
 const hash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex'),inventoryHash=hash(before.items),stockHash=hash(before.stock);
 const backupID=randomUUID();await call('textile_sync_runs',{method:'POST',body:{id:backupID,stage,source,status:'Respaldo',details:JSON.stringify({before,inventoryHash,stockHash})}});
 const projected=normalizeTextileData({...before,requirements:[],folders:[]});
 let yarnsChanged=0,photosChanged=0,suppliersChanged=0,availabilityReset=0;
 for(const supplier of projected.suppliers){const old=before.suppliers.find(row=>row.id===supplier.id);if(old.active===false||old.deleted_at)continue;if(old.name!==supplier.name){await call('textile_suppliers?id=eq.'+supplier.id+'&stage=eq.'+stage,{method:'PATCH',body:{name:supplier.name}});suppliersChanged++;}}
 for(const yarn of projected.yarns){const old=before.yarns.find(row=>row.id===yarn.id);if(!yarn.catalog_key||old.active===false||old.deleted_at)continue;
  const body={supplier_id:yarn.supplier_id,name:yarn.name,fiber:yarn.fiber,composition:yarn.composition,title:yarn.title,reference_key:'catalog-v1|'+yarn.catalog_key+'|'+(yarn.title||'pendiente')+'|'+yarn.id};
  if(Object.entries(body).every(([key,value])=>old[key]===value))continue;
  const saved=await call('textile_yarns?id=eq.'+yarn.id+'&stage=eq.'+stage,{method:'PATCH',body});if(saved.length!==1||Object.entries(body).some(([key,value])=>saved[0][key]!==value))throw new Error('No se pudo verificar el hilo actualizado '+yarn.id);yarnsChanged++;
  if(old.supplier_id!==yarn.supplier_id){await call('textile_colors?yarn_id=eq.'+yarn.id+'&stage=eq.'+stage,{method:'PATCH',body:{supplier_availability:'Pendiente de confirmación',availability_verified_at:null,availability_source:''}});availabilityReset++;}
 }
 for(const photo of projected.photos){const old=before.photos.find(row=>row.id===photo.id);if(!old.color_id||old.deleted_at||old.active===false)continue;
  const body=photo.catalog_photo_review?{verification_status:'pending',verified_at:null,verified_by:null}:photo.catalog_source_identity?{source_identity:{...photo.source_identity,original_identity:old.source_identity.original_identity||photo.catalog_source_identity}}:null;
  if(!body||Object.entries(body).every(([key,value])=>JSON.stringify(old[key])===JSON.stringify(value)))continue;
  await call('textile_photos?id=eq.'+photo.id+'&stage=eq.'+stage,{method:'PATCH',body});photosChanged++;
 }
 if(hash(await read('items'))!==inventoryHash||hash(await read('textile_stock'))!==stockHash)throw new Error('La comprobación del inventario o stock no coincide; revisa el respaldo '+backupID);
 const summary={stage,backup_id:backupID,source_yarns:before.yarns.length,commercial_yarns:catalogYarnGroups(projected.yarns.filter(y=>y.active!==false&&!y.deleted_at),projected.suppliers).length,fiber_families:textileFibers.length,source_colors:before.colors.length,unified_colors:catalogColorGroups(projected.colors.filter(c=>c.active!==false&&!c.deleted_at),projected.yarns).length,yarns_changed:yarnsChanged,suppliers_changed:suppliersChanged,photos_updated_or_pending:photosChanged,supplier_availability_reset:availabilityReset,inventory_preserved:true,stock_preserved:true};
 await call('textile_sync_runs',{method:'POST',body:{stage,source,status:'Completado',details:JSON.stringify({summary})}});return summary;
}
if(process.argv.includes('--production-build')){
 if(process.env.VERCEL_ENV!=='production')console.log('Catálogo: comprobación local; sin cambios de base.');
 else{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Falta la conexión de servidor para unificar el catálogo.');console.log('TEXTILE_CATALOG_RESULT '+JSON.stringify(await standardizeTextiles({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY})));}
}
