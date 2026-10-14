# Ampliación de EUROALPACA para revisión

Esta rama amplía la aplicación existente. Conserva login, roles, inventario, códigos por material y modelo, precios, movimientos, fichas y las tres hojas del inventario. No reemplaza el sistema ni publica la ampliación en el dominio de producción.

## Versión de prueba

El despliegue Preview muestra un aviso permanente. Lee el inventario existente y conserva una copia de trabajo en memoria para que las pruebas de prendas no modifiquen los datos originales. El cliente bloquea también las escrituras directas a las tablas y RPC originales. Los nuevos módulos guardan registros separados con `stage = preview`; las referencias de producción futura usarán `stage = production`.

La migración `supabase/textile.sql` solo crea tablas y funciones nuevas. No modifica `items`, `movements` o sus cantidades. Las imágenes usan el bucket privado `textile-private`, sin políticas de acceso público. `supabase/textile-storage.sql` lo crea. Las referencias iniciales se derivan de los campos de hilos y colores del Excel, con proveedor y disponibilidad pendientes cuando no exista confirmación. No se convierten cantidades de prendas o pesos de prendas en stock de hilo.

## Funciones

- **Panel textil:** colores, hilos por proveedor, requerimientos, órdenes por recibir, alertas de insuficiencia, notificaciones y fechas de actualización.
- **Carta de colores:** fotografías reales, búsqueda por nombre o código, filtros por proveedor, fibra y familia, comparación de hasta cuatro colores, alta, edición y desactivación.
- **Hilos y almacén:** composición, título y características, proveedor original, colores y conteos internos en kg. Un stock no contado permanece desconocido.
- **Proveedores:** ITESSA, MICHELL e INCATOPS, enlaces originales, notas de viabilidad y actualización manual o importación revisada de Excel/CSV.
- **Requerimientos:** número automático, fecha, colección, modelo, hilo, composición, proveedor, color y foto, kg requeridos, stock interno, kg por comprar, entrega, responsable y los ocho estados solicitados. Una recepción suma kg al almacén y registra entrega parcial o completa sin duplicar reintentos.
- **Fotografías:** carga autorizada, relaciones con colección, modelo, hilo o color, permisos de administradora o equipo y ampliación para observar el tejido.
- **Conexiones:** carpetas de Drive, sincronización manual, estado de credenciales y fuentes de proveedor autorizadas.
- **Historial:** altas y cambios de los registros textiles y de su disponibilidad.

`Pendiente de compra = max(requerido − stock interno, 0)`. Si el stock interno no está confirmado, el pendiente también queda sin confirmar. El cálculo se valida en PostgreSQL con precisión de tres decimales. La planificación consulta stock por requerimiento; no reserva automáticamente material para otras solicitudes. Las recepciones requieren un conteo interno inicial confirmado.

## Google Drive

El conector de esta conversación permite localizar archivos de la cuenta conectada; no concede credenciales de ejecución a la aplicación web. No se encontraron carpetas identificadas como EUROALPACA o hilos en la búsqueda disponible. Se necesitan sus enlaces para verificar la ubicación correcta.

La aplicación implementa lectura mediante cuenta de servicio de Google con alcance `drive.readonly`. Configuración:

1. Crear una cuenta de servicio y habilitar Google Drive API en el proyecto de Google Cloud de la empresa.
2. Guardar su JSON en **GOOGLE_SERVICE_ACCOUNT_JSON**, variable secreta solo del servidor de Vercel. No subirlo al repositorio ni usar variables `VITE_` para secretos.
3. Compartir únicamente las carpetas elegidas con el correo de esa cuenta como **Lector**. No cambiar los archivos a públicos.
4. Abrir **Conexiones y actualización**, comprobar conexión y vincular la carpeta con su colección, modelo, hilo o color.
5. Confirmar autorización de uso y ejecutar **Sincronizar**.

La sincronización recorre subcarpetas, pagina resultados, evita duplicados por ID de Drive, actualiza metadatos modificados y desactiva referencias eliminadas después de una lectura completa. No asocia nombres ambiguos: las fotos sin código inequívoco se revisan manualmente. Cada acceso comprueba sesión, rol, visibilidad y pertenencia a la carpeta autorizada. No se devuelven tokens de Google, enlaces de descarga privados ni URLs públicas permanentes de archivos.

Las fotos se optimizan en el servidor a WebP, con versión de consulta y versión de detalle de hasta 2.400 px, sin metadatos EXIF. La carga es diferida y la caché del navegador usa objetos privados. Se admiten JPG, PNG, WebP y AVIF; carga manual hasta 3 MB por archivo. No se admiten SVG ni contenido ejecutable.

## Proveedores: verificación del 14/10/2026

| Proveedor | Fuente observada | Integración habilitada |
| --- | --- | --- |
| ITESSA | [Stock Service](https://www.itessa.com.pe/es/productos/stock-service), catálogo web público | Consulta por enlace y Excel/CSV. API pública documentada no verificada. |
| MICHELL | [Web oficial](https://www.michell.com.pe/es), la carta detallada dirige a [inicio de sesión](https://www.michell.com.pe/login) | Consulta autorizada por cuenta y Excel/CSV. Sin extracción detrás del login. |
| INCATOPS | [Stock Service](https://www.incatops.com/stockservice/) y [catálogo PDF](https://www.incatops.com/stockservice/wp-content/uploads/2025/08/Stock-Service-FW-26-27-Essentials.pdf) | Consulta por enlace y Excel/CSV. Las [condiciones](https://stockserviceessentials.com/es-pe/policies/terms-of-service) requieren consentimiento previo escrito para reutilizar contenidos e imágenes. |

No se activó scraping ni se copiaron fotos de proveedores. La disponibilidad del catálogo no se toma como stock interno. Una confirmación exige fecha y fuente. Los cambios verificados generan historial y alertas cuando el color esté utilizado en requerimientos.

Para una API o archivo periódico con autorización del proveedor, configurar **TEXTILE_SUPPLIER_FEEDS** solo en el servidor. Ejemplo de estructura, no de fuente real:

```json
[{"supplier":"ITESSA","url":"https://www.itessa.com.pe/RUTA-AUTORIZADA","format":"json","authorized":true,"token_env":"TEXTILE_FEED_ITESSA_TOKEN"}]
```

El formato puede ser `json` con una lista o `rows`, o `csv`, usando los encabezados de la plantilla descargable. Las URL deben ser HTTPS de dominios del proveedor; no se siguen redirecciones. El secreto opcional se configura por separado. Activar solamente tras verificar API, permiso y estructura con el proveedor.

La importación admite hasta 500 filas y 5 MB, ofrece revisión antes de guardar y se aplica en una transacción. No importa cantidades del proveedor como stock de almacén. Las referencias existentes se actualizan sin duplicarse.

## Programación e instalación

El cron está preparado para las 07:00 UTC, 02:00 de Lima. Permanece desactivado hasta configurar `TEXTILE_SYNC_ENABLED=true`, `CRON_SECRET` y `TEXTILE_SYNC_ACTOR` con una administradora activa. Vercel ejecuta los cron en producción; el Preview permite revisar las acciones manualmente. La integración de Drive y los feeds de proveedor se configuran de forma independiente.

Para otra base, aplicar `supabase/textile.sql`, después `supabase/textile-storage.sql`, y cargar las referencias desde `scripts/seed-textile.mjs` en la etapa de prueba. Los archivos generados en `data/` son privados y están excluidos del repositorio. No ejecutar `supabase/schema.sql` completo sobre la base existente.

Tras revisar y aprobar el Preview, se podrá preparar la promoción a producción y la carga de referencias en su etapa. Los registros de pruebas no se mezclan automáticamente con los definitivos.
