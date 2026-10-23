import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import decode,{init} from '@jsquash/jxl/decode.js';

let decoder;
export async function decodePhotoUpload(body){
 if(!['image/jpeg','image/png','image/webp','image/avif','image/jxl'].includes(body.mime_type)||typeof body.data!=='string'||body.data.length>4_000_000)throw new Error('Sube JPG, PNG, WebP, AVIF o JXL de hasta 3 MB.');
 const bytes=Buffer.from(body.data,'base64');
 if(!bytes.length||bytes.length>3_000_000)throw new Error('La fotografía debe tener hasta 3 MB.');
 if(body.mime_type==='image/jxl'){
  const codestream=bytes[0]===0xff&&bytes[1]===0x0a;
  const container=bytes.subarray(0,12).equals(Buffer.from([0,0,0,12,0x4a,0x58,0x4c,0x20,13,10,135,10]));
  if(!codestream&&!container)throw new Error('El archivo no contiene una fotografía JXL válida.');
  try{
   decoder??=readFile(new URL('../node_modules/@jsquash/jxl/codec/dec/jxl_dec.wasm',import.meta.url)).then(bytes=>init({wasmBinary:bytes})).catch(error=>{decoder=undefined;throw error;});
   await decoder;
   const image=await decode(bytes);
   if(!image.width||!image.height||image.width*image.height>40_000_000)throw new Error('La fotografía supera el límite de 40 megapíxeles.');
   return await sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}}).png().toBuffer();
  }catch(error){if(error.message.includes('megapíxeles'))throw error;throw new Error('No se pudo leer el JXL. Comprueba que el archivo esté completo y sea una fotografía válida.');}
 }
 const meta=await sharp(bytes,{limitInputPixels:40_000_000}).metadata();
 if(!['jpeg','png','webp','avif','heif'].includes(meta.format))throw new Error('Formato de fotografía no admitido.');
 return bytes;
}
