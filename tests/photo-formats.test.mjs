import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import bmp from 'bmp-js';
import {photoMime} from '../src/photo-formats.mjs';
import {decodePhotoUpload} from '../server/photo-upload.mjs';
import {savePhoto} from '../server/photo-storage.mjs';

test('reconoce extensiones sin MIME, JPG/JPEG y tipos alternativos de Windows y móviles',()=>{
 for(const [ext,mime] of Object.entries({jpg:'jpeg',jpeg:'jpeg',jfif:'jpeg',png:'png',gif:'gif',webp:'webp',avif:'avif',jxl:'jxl',heic:'heic',heif:'heif',tif:'tiff',tiff:'tiff',bmp:'bmp',svg:'svg+xml'})){
  for(const type of ['','application/octet-stream'])assert.equal(photoMime({name:'foto.'+ext.toUpperCase(),type}),'image/'+mime);
 }
 for(const [type,mime] of Object.entries({'image/jpg':'image/jpeg','image/pjpeg':'image/jpeg','image/x-ms-bmp':'image/bmp','image/heic-sequence':'image/heic'}))assert.equal(photoMime({name:'foto',type}),mime);
 assert.equal(photoMime({name:'archivo.exe',type:'application/octet-stream'}),null);
 assert.equal(photoMime({name:'foto.jpg',type:'application/pdf'}),null);
});

test('convierte los formatos admitidos en fotografía y miniatura WebP con los colores correctos',async()=>{
 const fixtures=[];
 for(const format of ['jpeg','png','webp','avif','gif','tiff'])fixtures.push({mime:'image/'+format,bytes:await sharp({create:{width:3,height:2,channels:3,background:'#cc2244'}})[format]().toBuffer()});
 fixtures.push({mime:'image/svg+xml',bytes:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"><rect width="3" height="2" fill="#cc2244"/></svg>')});
 fixtures.push({mime:'image/bmp',bytes:bmp.encode({width:3,height:2,data:Buffer.from(Array(6).fill([255,68,34,204]).flat())}).data});
 const original=global.fetch;
 try{
  for(const {mime,bytes} of fixtures){
   const data=await decodePhotoUpload({mime_type:mime,data:bytes.toString('base64')}),uploads=[];
   global.fetch=async(url,options)=>{uploads.push(options.body);return new Response('{}');};
   await savePhoto({stage:'preview',url:'https://example.test',key:'test'},'format-test',data,{color:true});
   assert.equal(uploads.length,2,mime);
   for(const photo of uploads){
    const meta=await sharp(photo).metadata();assert.equal(meta.format,'webp',mime);assert.equal(meta.width,3);assert.equal(meta.height,2);
    const pixels=await sharp(photo).removeAlpha().raw().toBuffer();
    for(let i=0;i<pixels.length;i+=3){assert.ok(Math.abs(pixels[i]-204)<12,mime+' red');assert.ok(Math.abs(pixels[i+1]-34)<12,mime+' green');assert.ok(Math.abs(pixels[i+2]-68)<12,mime+' blue');}
   }
  }
 }finally{global.fetch=original;}
});

test('rechaza archivos corruptos, base64 inválido y dimensiones excesivas antes de guardar',async()=>{
 for(const mime of ['image/jpeg','image/heic','image/heif','image/tiff','image/gif','image/bmp','image/svg+xml'])await assert.rejects(decodePhotoUpload({mime_type:mime,data:Buffer.from('not an image').toString('base64')}),/No se pudo leer/);
 await assert.rejects(decodePhotoUpload({mime_type:'image/jpeg',data:'!!!!'}),/incompletos/);
 const bytes=bmp.encode({width:1,height:1,data:Buffer.from([255,0,0,255])}).data;bytes.writeUInt32LE(40_000_001,18);
 await assert.rejects(decodePhotoUpload({mime_type:'image/bmp',data:bytes.toString('base64')}),/megapíxeles/);
 const truncated=bmp.encode({width:1,height:1,data:Buffer.from([255,0,0,255])}).data.subarray(0,55);
 await assert.rejects(decodePhotoUpload({mime_type:'image/bmp',data:truncated.toString('base64')}),/No se pudo leer/);
});
