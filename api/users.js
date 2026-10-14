export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).json({error:'Método no permitido'});
 if(process.env.VERCEL_ENV==='preview'&&req.method!=='GET')return res.status(409).json({error:'La versión de prueba no modifica cuentas reales.'});
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)return res.status(503).json({error:'Configura las variables de servidor en Vercel.'});
 const token=req.headers.authorization?.replace(/^Bearer /,'');if(!token)return res.status(401).json({error:'Inicia sesión'});
 async function call(route,{method='GET',body,auth=key}={}){const response=await fetch(url+route,{method,headers:{apikey:key,Authorization:'Bearer '+auth,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.msg||data?.message||'No se pudo completar la operación');return data;}
 try{
 let user;try{user=await call('/auth/v1/user',{auth:token});}catch{return res.status(401).json({error:'Sesión inválida'});}
 const [profile]=await call('/rest/v1/profiles?id=eq.'+user.id+'&select=role,active');if(profile?.role!=='admin'||!profile.active)return res.status(403).json({error:'Solo administradora'});
 if(req.method==='GET')return res.json(await call('/rest/v1/profiles?select=*&order=full_name'));
 const b=req.body||{};
 if(req.method==='POST'){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||typeof b.password!=='string'||b.password.length<12||!b.full_name?.trim()||!['admin','operadora','consulta'].includes(b.role))return res.status(400).json({error:'Revisa nombre, correo, rol y contraseña de al menos 12 caracteres.'});
 const created=await call('/auth/v1/admin/users',{method:'POST',body:{email:b.email,password:b.password,email_confirm:true,user_metadata:{full_name:b.full_name.trim()}}});const id=created.id||created.user?.id;
 try{await call('/rest/v1/profiles?id=eq.'+id,{method:'PATCH',body:{role:b.role,full_name:b.full_name.trim()}});}catch(e){await call('/auth/v1/admin/users/'+id,{method:'DELETE'});throw e;}
 return res.status(201).json({id});
 }
 if(b.id===user.id)return res.status(400).json({error:'No puedes cambiar tus propios permisos.'});
 if(!/^[0-9a-f-]{36}$/i.test(b.id||''))return res.status(400).json({error:'Usuario inválido'});
 const changes={};if(b.role!==undefined){if(!['admin','operadora','consulta'].includes(b.role))return res.status(400).json({error:'Rol inválido'});changes.role=b.role;}if(typeof b.active==='boolean')changes.active=b.active;
 await call('/rest/v1/profiles?id=eq.'+b.id,{method:'PATCH',body:changes});return res.json({ok:true});
 }catch(e){return res.status(400).json({error:e.message||'No se pudo completar la operación'});}
}
