export const PHOTO_MAX_BYTES=5_000_000;
export const PHOTO_INLINE_BYTES=3_000_000;
export const PHOTO_MIMES=['image/jpeg','image/png','image/jxl'];
export const PHOTO_ACCEPT='image/jpeg,.jpg,.jpeg,image/png,.png,image/jxl,.jxl';
export const PHOTO_FORMATS='PNG, JPG/JPEG o JXL';
export function photoMime(file){
 const aliases={'image/jpg':'image/jpeg','image/pjpeg':'image/jpeg','image/x-png':'image/png'};
 const type=String(file.type||'').toLowerCase(),mime=aliases[type]||type;
 if(PHOTO_MIMES.includes(mime))return mime;
 if(['','application/octet-stream','binary/octet-stream'].includes(type))return {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',jxl:'image/jxl'}[String(file.name||'').split('.').pop().toLowerCase()]||null;
 return null;
}
