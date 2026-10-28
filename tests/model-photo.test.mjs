import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {memoryDb} from './helpers/memory-db.mjs';
import {replaceModelPhoto} from '../server/model-photo.mjs';

test('cambiar la foto conserva el modelo y su ID, crea versiones nuevas y no toca otras fotos',async()=>{
 const id='10000000-0000-0000-0000-000000000001',other='10000000-0000-0000-0000-000000000002';
 const original={id,stage:'production',kind:'producto',model_code:'QA01',name:'Foto original',active:true,visibility:'team',folder_id:'folder',drive_file_id:'drive',storage_full:'production/'+id+'/full.webp',storage_thumb:'production/'+id+'/thumb.webp'};
 const {state,db}=memoryDb({textile_photos:[original,{...original,id:other,model_code:'QA02'}]}),before=structuredClone(state.textile_photos[1]),uploads=[],previous=global.fetch;
 global.fetch=async(url,options)=>{uploads.push({url,options});return Response.json({});};
 try{
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#dd1144'}}).png().toBuffer();
  const saved=await replaceModelPhoto({db,url:'https://example.test',key:'test',stage:'production',profile:{role:'admin'}},{replace_photo_id:id,model_code:'QA01'},bytes);
  assert.equal(saved.id,id);assert.equal(saved.model_code,'QA01');assert.equal(saved.name,'Foto original');assert.equal(saved.folder_id,null);assert.equal(saved.drive_file_id,null);assert.equal(saved.storage_asset_id,null);assert.equal(state.textile_photos.length,2);assert.deepEqual(state.textile_photos[1],before);
  assert.match(saved.storage_full,new RegExp('^production/'+id+'/full-[0-9a-f-]+\\.webp$'));assert.notEqual(saved.storage_full,original.storage_full);assert.equal(uploads.length,2);
  for(const upload of uploads){assert.ok(upload.url.includes('/textile-private/production/'+id+'/'));assert.equal((await sharp(upload.options.body).metadata()).format,'webp');}
 }finally{global.fetch=previous;}
});

test('rechaza reemplazos de otro modelo, fotos de color y roles de consulta antes de guardar',async()=>{
 const id='10000000-0000-0000-0000-000000000001';const {db}=memoryDb({textile_photos:[{id,stage:'production',model_code:'QA01',kind:'producto',active:true}]}),c={db,stage:'production',profile:{role:'admin'}};
 await assert.rejects(replaceModelPhoto({...c,profile:{role:'consulta'}},{},Buffer.alloc(0)),/Solo administradora/);
 await assert.rejects(replaceModelPhoto(c,{replace_photo_id:id,model_code:'QA02'},Buffer.alloc(0)),/no corresponde/);
 await assert.rejects(replaceModelPhoto(c,{replace_photo_id:id,model_code:'QA01',color_id:'color'},Buffer.alloc(0)),/no corresponde/);
});
