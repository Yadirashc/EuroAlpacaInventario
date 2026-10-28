import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import decode,{init} from '@jsquash/jxl/decode.js';
import decodeHeic from 'heic-decode';
import bmp from 'bmp-js';
import {PHOTO_MIMES,PHOTO_FORMATS} from '../src/photo-formats.mjs';

let decoder;
function checkDimensions(width,height){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>40_000_000)throw new Error('La fotografía supera el límite de 40 megapíxeles o tiene dimensiones inválidas.');
}
async function pngFromRgba(image){
 checkDimensions(image.width,image.height);
 return sharp(Buffer.from(image.data),{raw:{width:image.width,height:image.height,channels:4}}).png().toBuffer();
}
export async function decodePhotoUpload(body){
 if(!PHOTO_MIMES.includes(body.mime_type)||typeof body.data!=='string'||body.data.length>4_000_000)throw new Error('Sube '+PHOTO_FORMATS+' de hasta 3 MB.');
 if(body.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))throw new Error('Los datos de la fotografía están incompletos.');
 const bytes=Buffer.from(body.data,'base64');
 if(!bytes.length||bytes.length>3_000_000)throw new Error('La fotografía debe tener hasta 3 MB.');
 const codestream=bytes[0]===0xff&&bytes[1]===0x0a;
 const container=bytes.subarray(0,12).equals(Buffer.from([0,0,0,12,0x4a,0x58,0x4c,0x20,13,10,135,10]));
 if(body.mime_type==='image/jxl'||codestream||container){
  if(!codestream&&!container)throw new Error('El archivo no contiene una fotografía JXL válida.');
  try{
   decoder??=readFile(new URL('../node_modules/@jsquash/jxl/codec/dec/jxl_dec.wasm',import.meta.url)).then(bytes=>init({wasmBinary:bytes})).catch(error=>{decoder=undefined;throw error;});
   await decoder;
   const image=await decode(bytes);
   return await pngFromRgba(image);
  }catch(error){if(error.message.includes('megapíxeles'))throw error;throw new Error('No se pudo leer el JXL. Comprueba que el archivo esté completo y sea una fotografía válida.');}
 }
 try{
  // Detect the contents too: a MIME type supplied by Windows is not validation.
  if(bytes.toString('ascii',0,2)==='BM'){
   if(bytes.length<54||bytes.readUInt32LE(14)<40||bytes.readUInt32LE(10)<54||bytes.readUInt32LE(10)>=bytes.length)throw new Error('Cabecera BMP inválida');
   const width=bytes.readUInt32LE(18),height=Math.abs(bytes.readInt32LE(22));
   checkDimensions(width,height);
   if(bytes.readUInt32LE(30)!==0||![1,4,8,16,24,32].includes(bytes.readUInt16LE(28)))throw new Error('Variante BMP no admitida');
   const rowBytes=Math.ceil(width*bytes.readUInt16LE(28)/32)*4;
   if(bytes.readUInt32LE(10)+rowBytes*height>bytes.length)throw new Error('BMP incompleto');
   const image=bmp.decode(bytes),rgba=Buffer.alloc(width*height*4);
   // bmp-js returns ABGR, rather than RGBA.
   for(let i=0;i<rgba.length;i+=4){rgba[i]=image.data[i+3];rgba[i+1]=image.data[i+2];rgba[i+2]=image.data[i+1];rgba[i+3]=255;}
   return await pngFromRgba({data:rgba,width,height});
  }
  const heic=bytes.toString('ascii',4,8)==='ftyp'&&['mif1','msf1','heic','heix','hevc','hevx'].includes(bytes.toString('ascii',8,12));
  if(heic){
   const images=await decodeHeic.all({buffer:bytes});
   try{
    if(!images.length)throw new Error('HEIC sin imagen');
    checkDimensions(images[0].width,images[0].height);
    return await pngFromRgba(await images[0].decode());
   }finally{images.dispose();}
  }
  const photo=sharp(bytes,{limitInputPixels:40_000_000}),meta=await photo.metadata();
  if(!['jpeg','png','webp','avif','heif','gif','tiff','svg'].includes(meta.format))throw new Error('Formato no admitido');
  checkDimensions(meta.width,meta.height);
  // SVG is rasterized; animated and multipage files use their first image.
  if(['svg','gif','tiff'].includes(meta.format))return await photo.rotate().keepIccProfile().png().toBuffer();
  return bytes;
 }catch(error){
  if(error.message.includes('megapíxeles'))throw error;
  throw new Error('No se pudo leer la imagen. Usa '+PHOTO_FORMATS+'; comprueba que el archivo esté completo.');
 }
}
