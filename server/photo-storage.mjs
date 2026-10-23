import sharp from 'sharp';
export async function savePhoto(c,id,data,{color=false}={}){
 const base=c.stage+'/'+id;
 const full=await sharp(data,{limitInputPixels:40_000_000}).rotate().keepIccProfile().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp(color?{lossless:true}:{quality:92}).toBuffer();
 const thumb=await sharp(data,{limitInputPixels:40_000_000}).rotate().keepIccProfile().resize({width:720,height:900,fit:'inside',withoutEnlargement:true}).webp(color?{lossless:true}:{quality:82}).toBuffer();
 for(const [name,buffer] of [['full',full],['thumb',thumb]]){
  const r=await fetch(c.url+'/storage/v1/object/textile-private/'+base+'/'+name+'.webp',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'image/webp','x-upsert':'true'},body:buffer});
  if(!r.ok)throw new Error('No se pudo guardar la fotografía privada. Revisa el bucket textile-private.');
 }
 return {storage_full:base+'/full.webp',storage_thumb:base+'/thumb.webp'};
}
