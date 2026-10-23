export const PHOTO_ACCEPT='image/jpeg,image/png,image/webp,image/avif,image/jxl,.jxl';
export const PHOTO_FORMATS='JPG, PNG, WebP, AVIF o JXL';
export function photoMime(file){
 if(file.type==='image/jxl'||(/\.jxl$/i.test(file.name||'')&&['','application/octet-stream'].includes(file.type)))return 'image/jxl';
 return ['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)?file.type:null;
}
