import {PHOTO_INLINE_BYTES,PHOTO_MAX_BYTES} from './photo-formats.mjs';

export async function uploadPhoto(api,body,file,mime){
 if(!file?.size||file.size>PHOTO_MAX_BYTES)throw new Error('Elige una imagen de hasta 5 MB.');
 if(file.size<=PHOTO_INLINE_BYTES){
  const dataURL=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
  return api('upload',{...body,mime_type:mime,data:String(dataURL).split(',')[1]});
 }
 const prepared=await api('prepare-upload',{mime_type:mime,size:file.size});
 try{
  const response=await fetch(prepared.upload_url,{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:file});
  if(!response.ok)throw new Error('No se pudo subir la imagen. Inténtalo nuevamente.');
  return await api('upload',{...body,mime_type:mime,upload_path:prepared.upload_path});
 }catch(error){
  await api('discard-upload',{upload_path:prepared.upload_path}).catch(()=>{});
  throw error;
 }
}
