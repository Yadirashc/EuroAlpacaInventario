import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {photoMime,PHOTO_MAX_BYTES} from '../src/photo-formats.mjs';
import {decodePhotoUpload} from '../server/photo-upload.mjs';
import {preparePhotoUpload,consumePhotoUpload} from '../server/photo-transfer.mjs';
import {uploadPhoto} from '../src/photo-transfer.mjs';

test('admite PNG, JPG/JPEG, JXL y WebP con MIME o extensión',()=>{
 for(const [ext,mime] of Object.entries({jpg:'jpeg',jpeg:'jpeg',png:'png',jxl:'jxl',webp:'webp'}))for(const type of ['','application/octet-stream'])assert.equal(photoMime({name:'foto.'+ext.toUpperCase(),type}),'image/'+mime);
 assert.equal(photoMime({type:'image/jpg'}),'image/jpeg');
 for(const ext of ['gif','tiff','bmp','heic','heif','svg','avif'])assert.equal(photoMime({name:'foto.'+ext,type:''}),null);
});

test('acepta hasta 5 MB exactos de PNG, JPG y WebP y rechaza un byte adicional y otros contenidos',async()=>{
 for(const format of ['png','jpeg','webp']){
  const photo=await sharp({create:{width:2,height:2,channels:3,background:'#cc2244'}})[format]().toBuffer();
  const bytes=Buffer.concat([photo,Buffer.alloc(PHOTO_MAX_BYTES-photo.length)]);
  assert.deepEqual(await decodePhotoUpload({mime_type:'image/'+format},bytes),bytes);
  await assert.rejects(decodePhotoUpload({mime_type:'image/'+format},Buffer.concat([bytes,Buffer.alloc(1)])),/5 MB/);
 }
 const gif=await sharp({create:{width:2,height:2,channels:3,background:'#cc2244'}}).gif().toBuffer();
 await assert.rejects(decodePhotoUpload({mime_type:'image/png'},gif),/No se pudo leer/);
 await assert.rejects(decodePhotoUpload({mime_type:'image/gif'},gif),/PNG, JPG\/JPEG, JXL o WebP/);
 await assert.rejects(decodePhotoUpload({mime_type:'image/png',data:'!!!!'}),/incompletos/);
});

test('carga directa de 5 MB usa un permiso privado, limita tamaño y limpia el archivo temporal',async()=>{
 const original=global.fetch,calls=[],c={url:'https://example.test',key:'test',stage:'production',profile:{id:'admin'}};
 global.fetch=async(url,options={})=>{
  calls.push({url,options});
  if(url.endsWith('/bucket/textile-uploads'))return Response.json({public:false,file_size_limit:5_000_000,allowed_mime_types:['application/octet-stream']});
  if(url.includes('/object/upload/sign/'))return Response.json({url:'/object/upload/sign/test?token=limited'});
  if(options.method==='DELETE')return Response.json({});
  return new Response(Buffer.alloc(5_000_000));
 };
 try{
  await assert.rejects(preparePhotoUpload(c,{mime_type:'image/png',size:5_000_001}),/5 MB/);assert.equal(calls.length,0);
  const upload=await preparePhotoUpload(c,{mime_type:'image/png',size:5_000_000});
  assert.match(upload.upload_path,/^production\/admin\//);
  assert.equal((await consumePhotoUpload(c,upload.upload_path)).length,5_000_000);
  assert.equal(calls.at(-1).options.method,'DELETE');
  const n=calls.length;await assert.rejects(consumePhotoUpload({...c,profile:{id:'other'}},upload.upload_path),/inválida/);assert.equal(calls.length,n);
  global.fetch=async(url,options={})=>{calls.push({url,options});return options.method==='DELETE'?Response.json({}):new Response(Buffer.alloc(5_000_001));};
  await assert.rejects(consumePhotoUpload(c,upload.upload_path),/tamaño/);assert.equal(calls.at(-1).options.method,'DELETE');
 }finally{global.fetch=original;}
});

test('el navegador envía 5 MB directamente al almacenamiento y solo la ruta al servidor',async()=>{
 const original=global.fetch,calls=[],file=new Blob([new Uint8Array(5_000_000)]);
 global.fetch=async(url,options)=>{assert.equal(options.body,file);assert.equal(options.method,'PUT');return Response.json({});};
 const api=async(action,body)=>{calls.push({action,body});return action==='prepare-upload'?{upload_path:'private-path',upload_url:'https://example.test/signed'}:{id:'saved'};};
 try{
  assert.deepEqual(await uploadPhoto(api,{name:'Foto'},file,'image/png'),{id:'saved'});
  assert.equal(calls[0].body.size,5_000_000);assert.equal(calls[1].body.upload_path,'private-path');assert.equal(calls[1].body.data,undefined);
  global.fetch=async()=>new Response('',{status:500});
  await assert.rejects(uploadPhoto(api,{},file,'image/png'),/No se pudo subir/);assert.equal(calls.at(-1).action,'discard-upload');
 }finally{global.fetch=original;}
});
