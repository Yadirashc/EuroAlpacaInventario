# Fotografías JXL — 23/10/2026

La carga manual de fotografías textiles y de la Carta de colores admite JPEG XL (`.jxl`, también cuando Windows no informa el MIME). Conserva el límite de 3 MB por archivo y los controles de acceso y verificación existentes.

El servidor comprueba la firma JXL, decodifica mediante el módulo WASM de @jsquash/jxl y genera las versiones WebP privadas para consulta y ampliación. Para las fotografías de colores se utiliza WebP sin pérdida. El decodificador produce una imagen RGBA de 8 bits; esta función es para visualizar fotografías, no para conservar un original HDR o de alta profundidad de bits. El almacenamiento sigue utilizando el bucket privado existente; no necesita migración de base de datos.

Validación: JXL real con comparación de píxeles, generación de fotografía y miniatura, MIME vacío/genérico, rechazo de archivos falsos e incompletos, límite de tamaño y regresión JPG/PNG. Chrome DevTools no pudo establecer conexión con el navegador en esta sesión.
