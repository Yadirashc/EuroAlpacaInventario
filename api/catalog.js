import {publicCatalog} from '../src/catalog.mjs';
export default async function handler(req,res){
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','public, max-age=0, s-maxage=30');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='OPTIONS')return res.status(204).end();if(req.method!=='GET')return res.status(405).json({error:'Método no permitido'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return res.status(503).json({error:'Catálogo no configurado'});
 try{let rows=[],offset=0;while(true){const fields='id,sku,model_code,name,category,material,material_code,composition,color,color_code,size,status,production_state,quantity,archived,deleted_at,location,source_snapshot';const r=await fetch(url+'/rest/v1/items?select='+fields+'&archived=eq.false&order=id&limit=1000&offset='+offset,{headers:{apikey:key,Authorization:'Bearer '+key}});if(!r.ok)throw new Error('Base de datos no disponible');const chunk=await r.json();rows.push(...chunk);if(chunk.length<1000)break;offset+=1000;}return res.json({models:publicCatalog(rows),updated_at:new Date().toISOString()});}catch{return res.status(502).json({error:'No se pudo consultar el catálogo'});}
}
