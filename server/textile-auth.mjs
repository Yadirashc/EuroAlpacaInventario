export const stage=()=>process.env.VERCEL_ENV==='production'?'production':'preview';
export async function context(req,{admin=false,cron=false}={}){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw Object.assign(new Error('Conexión de servidor pendiente'),{status:503});
 const token=req.headers.authorization?.replace(/^Bearer /,'');
 async function db(path,{method='GET',body,service=false,merge=false}={}){const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+(service?key:token),'Content-Type':'application/json',Prefer:'return=representation'+(merge?',resolution=merge-duplicates':'')},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null);if(!r.ok)throw Object.assign(new Error(data?.message||'No se pudo guardar la información'),{status:400});return data;}
 if(cron){if(!process.env.CRON_SECRET||token!==process.env.CRON_SECRET)throw Object.assign(new Error('Acceso denegado'),{status:401});const [profile]=await db('profiles?id=eq.'+encodeURIComponent(process.env.TEXTILE_SYNC_ACTOR||'')+'&select=id,role,active',{service:true});if(profile?.role!=='admin'||!profile.active)throw Object.assign(new Error('Configura la responsable de sincronización'),{status:503});return {url,key,token,db,profile,stage:stage(),cron:true};}
 if(!token)throw Object.assign(new Error('Inicia sesión'),{status:401});
 const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:key,Authorization:'Bearer '+token}});if(!auth.ok)throw Object.assign(new Error('Sesión inválida'),{status:401});const user=await auth.json();
 const [profile]=await db('profiles?id=eq.'+user.id+'&select=id,role,active,full_name');if(!profile?.active)throw Object.assign(new Error('Tu cuenta no tiene acceso'),{status:403});if(admin&&profile.role!=='admin')throw Object.assign(new Error('Solo administradora'),{status:403});
 return {url,key,token,db,profile,stage:stage(),cron:false};
}
export function fail(res,e){return res.status(e.status||400).json({error:e.message||'No se pudo completar la operación'});}
export async function limitedBuffer(response,max=20_000_000){if(!response.ok)throw new Error('No se pudo leer la fotografía autorizada');const chunks=[];let n=0;for await(const chunk of response.body){n+=chunk.length;if(n>max)throw new Error('El archivo supera el tamaño permitido');chunks.push(chunk);}return Buffer.concat(chunks);}
