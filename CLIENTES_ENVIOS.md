# Gestión de Clientes y Envíos / Ubicación

Versión de prueba implementada el 20/10/2026. No modifica automáticamente la web oficial ni su base de datos.

## Revisar la versión local

Ejecutar `npm.cmd run dev` en Windows y abrir http://127.0.0.1:4173. Usar el acceso local existente o **Explorar demostración**. Entrar a **Clientes y envíos** o **Ubicación**. En demostración los registros y documentos duran únicamente durante la sesión abierta; no se guardan en la base de datos real.

Las cinco pestañas son Panel general, Clientes, Registrar envío, Control de lotes e Historial de envíos. La ficha de cliente muestra sus pedidos (referencias), envíos y lotes. Los códigos de cliente, envío y lote de envío son automáticos; un lote de producción se registra por separado y puede utilizarse en varios envíos. El módulo no sustituye un sistema independiente de pedidos comerciales.

1. Crear un cliente con sus datos y dirección.
2. Registrar un envío, seleccionar origen y agregar variantes del inventario. Los datos técnicos se recuperan de sus fichas.
3. Indicar cantidades, lote de producción cuando se conoce, e identificación del lote de envío (por ejemplo, Caja 1). Las líneas con la misma identificación se agrupan en un lote con código LEN automático.
4. Verificar materiales. El selector propone ITESSA, Michell, Inca Tops y Otros proveedores; también admite el nombre real de otro proveedor. Cada línea admite varios materiales, con hilo, composición porcentual y lote del material. Los datos desconocidos no se inventan: deben completarse y verificarse antes de guardar.
5. Avanzar Pendiente → En preparación → Listo para despacho → En tránsito. Confirmar la fecha real de salida. El despacho descuenta stock de origen en una transacción.
6. Marcar Entregado cuando corresponda y **Confirmar recepción** con receptor y fecha real. También puede confirmarse directamente desde En tránsito. Solo la recepción confirmada incorpora las prendas al inventario de destino.

## Ubicación y trazabilidad

**Registrar movimiento** abre el mismo flujo para un traslado sin cliente obligatorio. Admite prendas individuales o lotes completos, cantidades parciales y destinos diferentes para el mismo lote de producción.

Ubicación muestra existencias por ubicación, cantidades en tránsito, producción y vínculos al envío. Los filtros cubren lote, modelo/código, color, talla, material, proveedor, cliente, destino, origen, responsable, fechas y estado. En Ubicación las fechas filtran por recepción, salida o emisión (en ese orden según estén registradas); en Envíos filtran por emisión.

**Ver movimientos** sigue los registros relacionados de origen y recepción, incluso en traslados sucesivos, e incluye los movimientos anteriores del inventario. Los movimientos originales conservan los datos que tenían; los nuevos campos no se pueden reconstruir de forma fiable para registros históricos que nunca los incluyeron.

Los estados Entregado y Recepción confirmada distinguen la entrega informada de la incorporación confirmada a existencias. Un envío despachado no puede cancelarse ni editar sus prendas: una devolución requiere un movimiento nuevo que conserve el historial. Los borradores sí pueden editarse y cancelarse con motivo. El sistema conserva los códigos LEN de los grupos que permanecen al editar y registra los datos anteriores en el historial.

No se reservan cantidades al preparar borradores. El stock se comprueba al guardar y nuevamente al despachar con bloqueos de filas; la suma de líneas de una variante no puede superar lo disponible. Dos despachos que compiten por las mismas existencias se serializan. Repetir la misma confirmación no vuelve a descontar ni recibir unidades. La versión del registro detecta cambios de otra persona antes de guardar.

La recepción crea una variante de destino por línea de envío, conservando el vínculo al origen y el lote de producción. No fusiona lotes ni mezcla falda/blusa WAYRA aunque compartan código comercial. Las cantidades anteriores de origen permanecen en su registro, con los movimientos de salida y entrada correspondientes.

## Documentos y reportes

Cada envío acepta PDF, JPG/JPEG, PNG, WebP, XLSX y DOCX de hasta 10 MB, almacenados en un bucket privado. Los usuarios de consulta pueden leer documentos; únicamente administradora y operadora pueden adjuntar. No hay enlaces públicos ni permisos anónimos.

**Exportar Excel** genera XLSX con detalles completos por línea y una hoja de historial con usuario y fecha/hora. **Exportar PDF** abre un reporte imprimible; pulsar **Imprimir / Guardar como PDF** y elegir Guardar como PDF en Chrome. Los reportes pueden generarse para un envío o los envíos que cumplen los filtros. Al filtrar por una característica de prenda se exporta el envío completo coincidente, para conservar el contexto de todos sus lotes.

## Activación en Supabase y Vercel

Aplicar primero a un entorno de pruebas y revisar antes de publicar en la web oficial:

1. Copia de seguridad de la base y comprobación de las cantidades por ubicación.
2. Ejecutar `supabase/logistics.sql`, después del esquema existente. Es una migración aditiva y repetible: seis tablas nuevas, cuatro funciones transaccionales y un campo opcional `items.production_lot`; no elimina filas existentes.
3. Ejecutar `supabase/logistics-storage.sql` para crear el bucket privado y sus políticas. No se requieren claves nuevas en el navegador.
4. Publicar el código con las variables de Supabase existentes y `VERCEL_ENV=production` solo para la versión oficial aprobada. El modo de prueba existente permanece en memoria y bloquea escrituras del inventario real.
5. Probar con registros ficticios: guardar cliente, preparar, despachar, recibir, adjuntar documento y exportar. Verificar lectura con consulta y denegación de escritura. Conciliar origen + tránsito + destino.

Si la migración aún no está aplicada, el módulo muestra el error de conexión/carga y permite reintentar, sin impedir consultar el inventario existente. La actualización se refresca con la consulta periódica de 15 segundos del sistema y tras cada operación; no sustituye el control transaccional del servidor.

## Validación

- `npm.cmd run build`
- `npm.cmd test`: pruebas existentes más PostgreSQL real embebido (PGlite), roles/RLS, almacenamiento privado, migración repetible, ediciones concurrentes, suma de filas, códigos de lote, conservación de unidades, fechas, recepción idempotente y trazabilidad sucesiva.
- Con el servidor local en marcha: `node tests/logistics-browser.mjs`, `node tests/browser-check.mjs`, `node tests/wayra-browser.mjs`.
- La prueba del módulo usa únicamente clientes, prendas y documentos ficticios. Revisa XLSX con ExcelJS y genera el PDF desde la vista imprimible con Chrome. Capturas y reportes quedan en `data/qa/`, excluido de Git.
