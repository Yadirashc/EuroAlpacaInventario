import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import encode,{init} from '@jsquash/jxl/encode.js';
import {decodePhotoUpload} from '../server/photo-upload.mjs';
import {savePhoto} from '../server/photo-storage.mjs';
import {PHOTO_ACCEPT,photoMime} from '../src/photo-formats.mjs';

test('JXL se reconoce con MIME y con extensión cuando Windows omite el tipo',()=>{
 assert.match(PHOTO_ACCEPT,/image\/jxl,\.jxl/);
 for(const type of ['','application/octet-stream','image/jxl'])assert.equal(photoMime({name:'Color.JXL',type}),'image/jxl');
 assert.equal(photoMime({name:'otro.exe',type:'application/octet-stream'}),null);
 assert.equal(photoMime({name:'color.png',type:'image/png'}),'image/png');
});

test('un JXL real conserva sus píxeles y produce foto y miniatura WebP privadas',async()=>{
 await init({wasmBinary:await readFile(new URL('../node_modules/@jsquash/jxl/codec/enc/jxl_enc.wasm',import.meta.url))});
 const data=new Uint8ClampedArray([220,30,80,255,40,210,60,255,20,60,220,255,240,210,30,255]);
 const encoded=await encode({data,width:2,height:2},{lossless:true});
 const converted=await decodePhotoUpload({mime_type:'image/jxl',data:Buffer.from(encoded).toString('base64')});
 assert.deepEqual(await sharp(converted).raw().toBuffer(),Buffer.from(data));
 const original=global.fetch,uploads=[];
 global.fetch=async(url,options)=>{uploads.push({url,options});return new Response('{}');};
 try{
  const paths=await savePhoto({stage:'production',url:'https://example.test',key:'test'},'photo-jxl',converted,{color:true});
  assert.equal(paths.storage_full,'production/photo-jxl/full.webp');
  assert.equal(uploads.length,2);
  for(const {url,options} of uploads){
   assert.match(url,/textile-private\/production\/photo-jxl\/(full|thumb)\.webp$/);
   assert.equal(options.headers['Content-Type'],'image/webp');
   assert.deepEqual(await sharp(options.body).ensureAlpha().raw().toBuffer(),Buffer.from(data));
  }
 }finally{global.fetch=original;}
});

test('rechaza JXL falsos, incompletos y archivos demasiado grandes; conserva JPG y PNG',async()=>{
 for(const bytes of [Buffer.from('not a photo'),Buffer.from([255,10,0])])await assert.rejects(decodePhotoUpload({mime_type:'image/jxl',data:bytes.toString('base64')}),/JXL/);
 await assert.rejects(decodePhotoUpload({mime_type:'image/jxl',data:'a'.repeat(4_000_001)}),/3 MB/);
 for(const format of ['png','jpeg']){
  const buffer=await sharp({create:{width:3,height:2,channels:3,background:'#cc2244'}})[format]().toBuffer();
  assert.deepEqual(await decodePhotoUpload({mime_type:'image/'+format,data:buffer.toString('base64')}),buffer);
 }
});
