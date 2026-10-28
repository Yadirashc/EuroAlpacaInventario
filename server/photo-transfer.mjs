import {randomUUID} from 'node:crypto';
import {PHOTO_MAX_BYTES,PHOTO_MIMES,PHOTO_FORMATS} from '../src/photo-formats.mjs';
import {limitedBuffer} from './textile-auth.mjs';

const bucket='textile-uploads';
function headers(c){return {apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'};}
function ownedPath(c,path){
 const prefix=c.stage+'/'+c.profile.id+'/';
 if(typeof path!=='string'||!path.startsWith(prefix)||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(path.slice(prefix.length)))throw new Error('Carga temporal inválida. Selecciona nuevamente la imagen.');
 return path;
}
async function ensureBucket(c){
 const url=c.url+'/storage/v1/bucket',options={headers:headers(c),signal:AbortSignal.timeout(20000)};
 let response=await fetch(url+'/'+bucket,options);
 if(!response.ok){
  if(response.status!==404&&response.status!==400)throw new Error('No se pudo comprobar la carga de imágenes.');
  const created=await fetch(url,{...options,method:'POST',body:JSON.stringify({id:bucket,name:bucket,public:false,file_size_limit:PHOTO_MAX_BYTES,allowed_mime_types:['application/octet-stream']})});
  if(!created.ok){response=await fetch(url+'/'+bucket,options);if(!response.ok)throw new Error('No se pudo preparar la carga de imágenes.');}
  else return;
 }
 const config=await response.json();
 if(config.public!==false||Number(config.file_size_limit)!==PHOTO_MAX_BYTES||!config.allowed_mime_types?.includes('application/octet-stream'))throw new Error('Revisa la configuración privada de la carga temporal.');
}
export async function preparePhotoUpload(c,body){
 if(!PHOTO_MIMES.includes(body.mime_type)||!Number.isInteger(body.size)||body.size<1||body.size>PHOTO_MAX_BYTES)throw new Error('Sube '+PHOTO_FORMATS+' de hasta 5 MB.');
 await ensureBucket(c);
 const path=c.stage+'/'+c.profile.id+'/'+randomUUID();
 const response=await fetch(c.url+'/storage/v1/object/upload/sign/'+bucket+'/'+path,{method:'POST',headers:headers(c),body:'{}',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('No se pudo autorizar la carga de la imagen.');
 const result=await response.json();
 return {upload_path:path,upload_url:c.url+'/storage/v1'+result.url};
}
export async function discardPhotoUpload(c,path){
 ownedPath(c,path);
 const response=await fetch(c.url+'/storage/v1/object/'+bucket,{method:'DELETE',headers:headers(c),body:JSON.stringify({prefixes:[path]}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('No se pudo limpiar la carga temporal.');
}
export async function consumePhotoUpload(c,path){
 ownedPath(c,path);
 try{
  const response=await fetch(c.url+'/storage/v1/object/authenticated/'+bucket+'/'+path,{headers:headers(c),signal:AbortSignal.timeout(20000)});
  return await limitedBuffer(response,PHOTO_MAX_BYTES);
 }finally{await discardPhotoUpload(c,path);}
}
