import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import handler from '../api/textile.js';

test('carga manual guarda un color sin casilla ni referencia de autorización y comprueba la identidad',async()=>{
 const before={...process.env},original=global.fetch;
 process.env.SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';process.env.VERCEL_ENV='production';
 let saved,uploads=0;
 global.fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return Response.json({id:'admin'});
  if(url.includes('/profiles?'))return Response.json([{id:'admin',role:'admin',active:true}]);
  if(url.includes('/textile_colors?'))return Response.json([{id:'c',active:true,yarn_id:'y',code:'8080',name:'Color'}]);
  if(url.includes('/textile_yarns?'))return Response.json([{id:'y',active:true,supplier_id:'s',name:'MUHU',composition:'100% Baby Alpaca',title:'2/28'}]);
  if(url.includes('/textile_suppliers?'))return Response.json([{id:'s',name:'Inca Tops'}]);
  if(url.includes('/textile_photos')&&options.method==='POST'){saved=JSON.parse(options.body);return Response.json([saved]);}if(url.includes('/textile_photos?'))return Response.json([]);if(url.includes('/textile_photo_sources'))return Response.json([]);
  if(url.includes('/storage/')){uploads++;return Response.json({});}
  if(url.includes('/rpc/confirm_color_photo')){saved=JSON.parse(options.body).p_photo;return Response.json(saved);}
  throw Error('Unexpected request: '+url);
 };
 const res=()=>({statusCode:200,setHeader(){},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
 try{
  const data=(await sharp({create:{width:2,height:2,channels:3,background:'#cc2244'}}).png().toBuffer()).toString('base64');
  const body={name:'Color',color_id:'c',yarn_id:'y',exact_confirmed:true,mime_type:'image/png',data};
  const result=res();await handler({method:'POST',query:{action:'upload'},headers:{authorization:'Bearer test-session'},body},result);
  assert.equal(result.statusCode,201,JSON.stringify(result.body));assert.equal(saved.color_id,'c');assert.equal(uploads,2);
  assert.match(saved.permission_reference,/sin declaración/);assert.equal(saved.source_url,'manual');
  const rejected=res();await handler({method:'POST',query:{action:'upload'},headers:{authorization:'Bearer test-session'},body:{...body,exact_confirmed:false}},rejected);
  assert.equal(rejected.statusCode,400);assert.equal(uploads,2);
 }finally{global.fetch=original;for(const name of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','VERCEL_ENV'])if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}
});
