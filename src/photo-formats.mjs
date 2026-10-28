const extensions={jpg:'image/jpeg',jpeg:'image/jpeg',jfif:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif',jxl:'image/jxl',heic:'image/heic',heif:'image/heif',gif:'image/gif',tif:'image/tiff',tiff:'image/tiff',bmp:'image/bmp',svg:'image/svg+xml'};
const aliases={'image/jpg':'image/jpeg','image/pjpeg':'image/jpeg','image/x-png':'image/png','image/x-tiff':'image/tiff','image/x-ms-bmp':'image/bmp','image/heic-sequence':'image/heic','image/heif-sequence':'image/heif'};
export const PHOTO_MIMES=[...new Set(Object.values(extensions))];
export const PHOTO_ACCEPT='image/*,'+Object.entries(extensions).map(([ext,mime])=>mime+',.'+ext).join(',');
export const PHOTO_FORMATS='JPG, PNG, WebP, AVIF, JXL, HEIC/HEIF, GIF, TIFF, BMP o SVG';
export function photoMime(file){
 const type=String(file.type||'').toLowerCase(),mime=aliases[type]||type;
 if(PHOTO_MIMES.includes(mime))return mime;
 if(['','application/octet-stream','binary/octet-stream'].includes(type))return extensions[String(file.name||'').split('.').pop().toLowerCase()]||null;
 return null;
}
