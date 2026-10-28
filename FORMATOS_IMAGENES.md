# Formatos de fotografías — 28/10/2026

La carga de Fotografías y Gestión textil (incluidas las fotos de la Carta de colores) admite JPG/JPEG/JFIF, PNG, WebP, AVIF, JXL, HEIC/HEIF, GIF, TIFF/TIF, BMP y SVG. Reconoce las extensiones aunque Windows no comunique el tipo MIME, y contempla nombres en mayúsculas y tipos MIME alternativos.

El servidor verifica el contenido y convierte los archivos en las versiones WebP privadas existentes. HEIC/HEIF se decodifica con heic-decode/libheif WASM; BMP sin compresión con bmp-js; JXL conserva su decodificador WASM. SVG se rasteriza. Los GIF animados y TIFF de varias páginas se guardan como imagen fija de la primera imagen/página. Se mantienen el límite de 3 MB de archivo y 40 megapíxeles, las imágenes de colores sin pérdida y los permisos existentes. No requiere migración de base de datos.

Validación automatizada: detección por extensión/MIME, conversión de imágenes reales JPG, PNG, WebP, AVIF, GIF, TIFF, BMP y SVG, comparación de colores, almacenamiento WebP y rechazo de archivos corruptos, base64 inválido y dimensiones excesivas. La regresión JXL compara sus píxeles y ambas versiones guardadas. Se verificó además un HEIC real de 718.114 bytes y 1280 × 854 píxeles, procedente del ejemplo del proyecto libheif: https://github.com/strukturag/libheif/blob/master/examples/example.heic (descargado solo en data/photo-format-qa, excluido de Git).

La compatibilidad corresponde a estos formatos y a las variantes que puedan decodificarse; no incluye archivos de edición PSD/AI, RAW de cámaras o documentos PDF.
