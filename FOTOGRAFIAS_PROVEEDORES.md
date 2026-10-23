# Sincronización de fotografías de proveedores

La ampliación usa `textile_colors`, `textile_yarns`, `textile_suppliers`, `textile_photos`, `textile_photo_checks`, `textile_photo_sources`, el bucket privado `textile-private` y el historial existente. No crea páginas, proveedores, hilos ni colores nuevos, ni escribe cantidades de prendas.

En **Conexiones y actualización** están **Sincronizar fotografías de proveedores** y **Configurar fuente de fotografías**. Cada fuente se vincula a un hilo existente con producto, enlace, método, evidencia del permiso, vigencia y opciones de carga automática. La autorización de consulta y la de almacenamiento se registran por separado. No se deduce un permiso de un `robots.txt` permisivo ni de una página pública.

La prueba inicial selecciona hasta cinco colores de varios proveedores. Solo una fuente con una fotografía de prueba verificada y almacenada puede procesar sus pendientes. La ejecución manual recorre lotes de cinco; cerrar el reporte detiene los siguientes lotes. Las fuentes pendientes, ambiguas, bloqueadas o sin permiso dejan sus fotografías pendientes y registran el motivo. No hay reconocimiento generativo ni aproximaciones digitales.

## Métodos compatibles

- `essentials-html`: página pública de producto autorizada de Stock Service Essentials. Cruza los datos de producto, la ficha técnica, el código de opción, el SKU, el ID de variante y la imagen asignada explícitamente a esa variante. El adaptador se comprobó con MUHU 2/28 y código 8080; producto `7461990334549`, variante `42702403993685`, SKU `100HC22808080-IN`. Un nombre genérico como «Baby alpaca» requiere documentar expresamente a qué producto del proveedor corresponde; no se renombra el registro.
- `official-html`: fichas compatibles revisadas de Itessa y Michell. Las cartas recortadas de Itessa se comprueban contra un hash conocido. Cancas con subtipo Tangüis requiere revisión técnica explícita porque la ficha pública consultada indica algodón sin precisar el subtipo.
- `official-json` y `official-csv`: exportaciones autorizadas con `provider,yarn,title,composition,color_code,product_code,sku,image_url`. Cada fila debe identificar el producto completo. Las URLs y redirecciones se limitan al proveedor correspondiente.

La configuración y la caché utilizan registros en `textile_photo_sources`; no requieren nuevas columnas para la ejecución manual. Los permisos de acceso existentes siguen vigentes. La imagen se guarda como WebP sin pérdidas con perfil ICC conservado, sin transformaciones de tono o saturación. Se guardan origen, identidad, producto, SKU, método, hash, fechas, ruta y referencia del permiso. Una foto central verificada se reutiliza por la misma variante, aunque haya varios registros locales idénticos.

## Galería y reutilización

La ficha del hilo incorpora imagen principal y selectores circulares por color, con código e indicador de selección. Solo agrupa colores del mismo ID de hilo. Las tarjetas de la Carta de colores conservan su estructura. Una foto no verificada nunca sustituye un pendiente.

La referencia central sirve a Carta de colores, Hilos y almacén y a la fotografía de hilo dentro de la ficha de una prenda. Los demás módulos pueden resolverla mediante `GET /api/textile?action=photo-resolve&color_id=...`, o `yarn_id=...&code=...`. La recuperación de la imagen sigue pasando por el endpoint privado `media` y sus permisos. No se sustituye la fotografía de una prenda por la de un hilo.

## Programación

La carga programada requiere aplicar `supabase/provider-photo-sync.sql`, configurar `TEXTILE_SYNC_ACTOR` con una administradora activa y habilitar `TEXTILE_PHOTO_SYNC_ENABLED=true`. El cron existente conserva su secreto y horario. La opción programada de una fuente solo se habilita cuando el servidor confirma esas capacidades. La función SQL de almacenamiento programado se concede únicamente a `service_role`, comprueba a la responsable y usa el mismo bloqueo por color de la confirmación manual. El script es aditivo y no cambia prendas, colores ni fotografías existentes.

Esta migración y las opciones de servidor no deben declararse aplicadas sin acceso verificado al proyecto. Mientras falte esa configuración, funciona la ruta manual autenticada y la programación permanece desactivada.

## Comprobaciones y límites de la entrega

Se probaron coincidencias y rechazos por proveedor, producto, código, título y composición; ceros iniciales; enlaces ajenos; vínculos producto/variante/imagen; ausencia de consultas sin permiso; almacenamiento autorizado; reutilización sin volver a descargar; permisos de medios y migración SQL local. La regresión de navegador cubre cartas, filtros, fotos privadas, galería, ampliación, configuración de fuentes, reportes, requerimientos y móvil.

Los datos privados de producción y su reporte final requieren sesión autenticada. Una comprobación con la copia local de 14 hilos y 82 colores es una referencia de desarrollo, no prueba del conteo actual en producción. Sin permiso documentado no se cargan fotografías de proveedores, y sin prueba real validada no se ejecuta una sincronización masiva.

Fuentes revisadas el 23/10/2026:

- https://stockserviceessentials.com/es-pe/products/muhu-2-28
- https://stockserviceessentials.com/es-pe/pages/terminos-y-condiciones-de-uso
- https://www.itessa.com.pe/es/producto/cancas-nu
- https://www.michell.com.pe/es/colecciones/stock-service
