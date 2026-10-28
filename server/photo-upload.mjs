import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import decode,{init} from '@jsquash/jxl/decode.js';
import {PHOTO_MIMES,PHOTO_FORMATS,PHOTO_MAX_BYTES} from '../src/photo-formats.mjs';

let decoder;
export async function decodePhotoUpload(body,raw){
 if(!PHOTO_MIMES.includes(body.mime_type))throw new Error('Sube '+PHOTO_FORMATS+' de hasta 5 MB.');
 let bytes=raw;
 if(!bytes){
  if(typeof body.data!=='string'||body.data.length>Math.ceil(PHOTO_MAX_BYTES/3)*4)throw new Error('Sube '+PHOTO_FORMATS+' de hasta 5 MB.');
  if(body.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))throw new Error('Los datos de la fotografía están incompletos.');
  bytes=Buffer.from(body.data,'base64');
 }
 if(!bytes.length||bytes.length>PHOTO_MAX_BYTES)throw new Error('La fotografía debe tener hasta 5 MB.');
 const codestream=bytes[0]===0xff&&bytes[1]===0x0a;
 const container=bytes.subarray(0,12).equals(Buffer.from([0,0,0,12,0x4a,0x58,0x4c,0x20,13,10,135,10]));
 if(body.mime_type==='image/jxl'){
  if(!codestream&&!container)throw new Error('El archivo no contiene una fotografía JXL válida.');
  try{
   decoder??=readFile(new URL('../node_modules/@jsquash/jxl/codec/dec/jxl_dec.wasm',import.meta.url)).then(bytes=>init({wasmBinary:bytes})).catch(error=>{decoder=undefined;throw error;});
   await decoder;
   const image=await decode(bytes);
   if(!image.width||!image.height||image.width*image.height>40_000_000)throw new Error('La fotografía supera el límite de 40 megapíxeles.');
   return await sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}}).png().toBuffer();
  }catch(error){if(error.message.includes('megapíxeles'))throw error;throw new Error('No se pudo leer el JXL. Comprueba que el archivo esté completo y sea una fotografía válida.');}
 }
 try{
  const meta=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();
  if(!['jpeg','png','webp'].includes(meta.format)||'image/'+meta.format!==body.mime_type)throw new Error('Formato no admitido');
  return bytes;
 }catch{throw new Error('No se pudo leer la imagen. Usa '+PHOTO_FORMATS+' y comprueba que el archivo esté completo.');}
}
