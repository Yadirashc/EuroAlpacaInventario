import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const prod=process.argv.includes('--production'),base=path.resolve(prod?'dist':'.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const credentials=!prod&&fs.existsSync('.local-access.json')?JSON.parse(fs.readFileSync('.local-access.json','utf8')):null;
const sessions=new Map();
const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(p.startsWith('/local/')&&!prod&&credentials){
  const token=req.headers.cookie?.match(/(?:^|;\s*)ea_local=([^;]+)/)?.[1];const expires=sessions.get(token);const valid=expires>Date.now();
  if(req.method==='POST'){
   if(req.headers.origin!=='http://127.0.0.1:4173'&&req.headers.origin!=='http://localhost:4173')return send(res,403,{error:'Origen inválido'});
  }
  if(p==='/local/login'&&req.method==='POST'){
   let body='';for await(const part of req){body+=part;if(body.length>4096)return send(res,413,{error:'Solicitud demasiado grande'});}
   const data=JSON.parse(body);const hash=crypto.scryptSync(String(data.password||''),credentials.salt,64);const expected=Buffer.from(credentials.hash,'hex');
   if(data.email!==credentials.email||!crypto.timingSafeEqual(hash,expected))return send(res,401,{error:'Correo o contraseña incorrectos'});
   const key=crypto.randomBytes(32).toString('hex');sessions.set(key,Date.now()+8*3600000);res.setHeader('Set-Cookie',`ea_local=${key}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);return send(res,200,{ok:true});
  }
  if(p==='/local/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','ea_local=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
  if(!valid)return send(res,401,{error:'Inicia sesión local'});
  if(p==='/local/inventory'&&req.method==='GET')return send(res,200,{profile:{id:'local-yadira',full_name:'Yadira',email:credentials.email,role:'admin'},items:JSON.parse(fs.readFileSync('data/inventory.json','utf8'))});
  return send(res,404,{error:'No encontrado'});
 }
 if(p==='/config.js'&&!prod){res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');return res.end('window.EURO_CONFIG='+JSON.stringify({url:'',key:'',local:!!credentials})+';');}
 if(!prod&&!/^\/(src\/|assets\/|$|index.html$)/.test(p)){res.writeHead(404);return res.end('No encontrado');}
 const relative=p==='/'?'/index.html':p;
 let target=path.resolve(base,'.'+relative);if(!prod&&p.startsWith('/assets/'))target=path.resolve(base,'public','.'+p);
 if(!target.startsWith(base+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);return res.end('No encontrado');}
 res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');fs.createReadStream(target).pipe(res);
 }catch{send(res,400,{error:'Solicitud inválida'});}
});server.listen(4173,'127.0.0.1',()=>console.log('http://127.0.0.1:4173'+(credentials?' · Acceso local activado':'')));
