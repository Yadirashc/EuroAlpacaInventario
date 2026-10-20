# Estado de EUROALPACA

## Corrección del 20/10/2026: ubicación dentro de Inventario

Publicado y verificado en el dominio oficial con el despliegue `dpl_6BsXu77NuueUGkFHbXiZGcr6qdVX` (READY), código `b3568895a63eef89235bb28618a2e779c983d99d`.

Se retiró la opción independiente Ubicación del menú. Sus datos, registro de movimientos, filtros e historial se integraron en la columna **Ubicación** de la tabla existente de **Inventario**, en las vistas resumida y Excel. Pulsar la ubicación de una fila permite consultar traslados y registrar un movimiento con esa prenda y su origen seleccionados. La web quedó abierta en Chrome en Inventario, vista resumida, con sus encabezados originales.

Pasaron las 34 pruebas automatizadas y las pruebas de navegador de logística e inventario. No fue necesaria ninguna migración ni modificación de datos. La comparación completa de inventario antes y después coincide: 226 registros y 396 unidades conocidas.

## Actualización del 20/10/2026: clientes, envíos y ubicación

Publicado en el dominio oficial con el despliegue `dpl_ALMBMRgjfShpceUcSHrrShRSDUhy`, estado READY. Código publicado: `ec53d0539a0c5ca84ba306b48d34b9662c8dd994`, rama `feature/clientes-envios`, guardada en GitHub.

Se aplicaron `supabase/logistics.sql` y `supabase/logistics-storage.sql`. Están disponibles Gestión de Clientes y Envíos (cinco pestañas), Ubicación y trazabilidad, formularios vinculados al inventario, documentos privados y reportes. Instrucciones: [CLIENTES_ENVIOS.md](CLIENTES_ENVIOS.md).

Validación en producción: acceso autenticado a las seis tablas nuevas; lectura anónima rechazada; panel y formularios verificados en Chrome; despacho y recepción idempotentes comprobados dentro de una transacción revertida. No quedaron clientes, envíos ni prendas ficticias. La comparación de todos los campos anteriores de inventario coincide antes y después: 226 registros, 396 unidades conocidas y 2 cantidades pendientes. Se guardó una copia privada de inventario y movimientos en `data/logistics-deploy/inventory-before.json`, excluida de Git.

La compilación y las 34 pruebas automatizadas pasaron antes de publicar; también las pruebas de navegador de logística, inventario y WAYRA. El panel quedó abierto en Chrome en el dominio oficial.

## Publicación inicial

Publicado y verificado el 13/10/2026.

- Web: https://euroalpaca-inventario.vercel.app
- Código: https://github.com/Yadirashc/EuroAlpacaInventario
- Supabase: https://supabase.com/dashboard/project/sdxfmtbtyoibtpxxchdj
- Vercel: proyecto `euroalpaca-inventario`, equipo `Yadira Corp`.

## Importación y comprobaciones

Se importaron las tres hojas del Excel original de Google Drive. Se contrastaron, fila a fila, prenda, cantidad, composición, color y talla. Cada ficha guarda nombre de hoja, número real de fila y todos los campos originales en `source_snapshot`.

| Hoja | Filas | Cantidades conocidas |
| --- | ---: | ---: |
| INVENTARIO - TALLER | 64 | 74 |
| PRODUCCIÓN QURI | 84 | 140 |
| INFO DE ENVIOS | 78 | 182 |
| Total | 226 | 396 |

El Excel es la única fuente. Se comprobaron 4.506 campos originales y se añadió una vista por hoja con todos sus campos y modo de edición de cantidades para la administradora.

Se verificaron login real de administradora, creación de operadora y consulta desde la API publicada, lectura de inventario, bloqueo de administración para ambos roles, rechazo de lectura anónima, bloqueo de modificación directa de stock, ajustes, dos salidas simultáneas y recepción real de eventos Realtime. Todas las cuentas y prendas de prueba se eliminaron. Las 226 filas originales quedaron intactas.

Hay 2 cantidades desconocidas. Las 396 unidades son la suma de cantidades conocidas. Hay 40 grupos de modelos: mayúsculas, minúsculas y espacios no crean modelos separados. Las 226 filas permanecen intactas. El título del hilo 18/2 sigue el formato original del XLSX.

## Uso y actualizaciones

Los códigos comerciales identifican únicamente material y modelo, y son iguales para todos sus colores y tallas. Por ejemplo, `ACSU38` se conserva al elegir beige u olivo, en S o M; `AC` significa Baby Alpaca + algodón; los porcentajes no cambian el código. Cada talla mantiene sus propias existencias. La ficha permite guardar un precio de venta y moneda; los importes todavía no confirmados permanecen vacíos. Consulta [CODIGOS.md](CODIGOS.md) y [PRECIOS.md](PRECIOS.md).

Las credenciales de administradora se entregaron por separado; no se guardan en este repositorio. El registro público está desactivado. Las cuatro variables de Supabase ya se configuraron en Vercel; la clave privada solo está en el servidor.

Esta versión se desplegó directamente desde el contenido del commit de GitHub. Falta instalar la integración oficial Vercel–GitHub para despliegues automáticos con cada push:

1. En Vercel, abre el proyecto → Settings → Git.
2. Instala/autoriza Vercel para el repositorio `Yadirashc/EuroAlpacaInventario`.
3. Vincula ese repositorio y selecciona `main` como rama de producción.

El inventario guarda los cambios en Supabase; no escribe automáticamente en Google Sheets. Instrucciones de edición: MODO_EDICION.md.

