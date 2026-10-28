# Fotografías: PNG, JPG, JXL y WebP hasta 5 MB — 28/10/2026

Por indicación de Yadira, la carga manual admite únicamente PNG, JPG/JPEG, JXL y WebP, con un máximo de 5.000.000 bytes por archivo. Reconoce extensiones en mayúsculas y archivos cuyo MIME no se informa. El servidor comprueba el contenido real y genera las versiones WebP privadas existentes; las imágenes anteriormente guardadas siguen disponibles.

Los archivos mayores de 3 MB se envían directamente a Supabase mediante un permiso de carga para una ruta de la administradora. Esto permite subir los 5 MB completos sin superar el límite de solicitudes de Vercel. El depósito temporal `textile-uploads` es privado, admite hasta 5 MB y se configura al preparar la primera carga. El servidor comprueba la propiedad de la ruta, descarga el archivo con límite y elimina el temporal tanto al recibirlo como cuando la lectura falla. El navegador también solicita su limpieza si el envío falla. Los originales de cargas que se abandonen cerrando el navegador antes de finalizar pueden permanecer en el depósito privado temporal.

Se mantienen el límite de 40 megapíxeles, el almacenamiento final privado y los controles de acceso. Las solicitudes de preparación y limpieza requieren una sesión de administradora. No cambia el inventario ni necesita migraciones de tablas.

Validación: archivos de PNG y JPG de exactamente 5 MB, rechazo de un byte adicional, rechazo de formatos diferentes incluso renombrados, conversión JXL con comparación de píxeles, carga directa sin base64, aislamiento entre usuarios y limpieza tras lectura fallida.
