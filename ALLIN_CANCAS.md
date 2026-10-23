# Ficha única Allin / Cancas

## Desglose por ubicación, color y talla — 23/10/2026

Publicado y verificado en el dominio oficial: despliegue `dpl_FN9rcoUhcVAnpm9EWvpnDxySm3Pt`, READY, código `30bb62e775fe6effb3f2a4646a6b177f1b38c42b`. Pasaron 46 pruebas, compilación y prueba de navegador local y publicada. La lectura autenticada de los 297 registros de inventario coincide exactamente antes y después: SHA-256 `a24044783d2d5bef8afc9136dbdba0287ae33f35530f1966b1ab390b9546e351`. La ficha real quedó abierta en Chrome con 93 España, 7 Lima y 5 Muestras / revisión.

Allin se muestra en entradas separadas por ubicación, color y talla, manteniendo distintos materiales y composiciones separados. Los registros que coinciden en esos campos se presentan en una sola entrada con sus cantidades sumadas; los distintos acabados se conservan al consultar los registros originales. La ficha completa tiene secciones por ubicación y un selector para consultar solo una ubicación. No se asigna talla única a los registros «No califica».

La lectura previa actual contiene 33 registros activos de Allin y 105 unidades: España 93, Lima 7, Muestras / revisión 5. El desglose tiene 23 grupos, incluidos los registros de cantidad cero. Estos totales son una referencia de la comprobación; la interfaz calcula siempre los valores actuales. El cambio es de presentación: no escribe en inventario, movimientos ni historial.

Validación de navegador: `node tests/allin-split-browser.mjs`. Se puede utilizar una copia privada del inventario con `ALLIN_FIXTURE=data/allin-split-before-20261023.json`. Comprueba sumas por ubicación, agrupación de muestras con distinto acabado, acceso a registros, CSV, móvil y ausencia de escrituras.

## Publicación anterior

Publicada el 22/10/2026 en https://euroalpaca-inventario.vercel.app/, despliegue `dpl_dw2fT1gAyETeVJ9zJLpZxq7svgJ9`, READY, código `fabdd8434cd2fec9b7d2c92eeb64d1d4d147b1f5`. El código servido y la ficha del dominio oficial se comprobaron con datos aislados. La comparación integral del inventario antes/después coincide: 297 registros, 398 unidades conocidas, hash `32ea884d99b297afeea6f06d02d733ab`. Los 34 registros Allin y todos sus movimientos, operaciones e historial permanecen idénticos.

Allin, Cancas y Bufanda Cancas se reúnen en una sola ficha de modelo. En Inventario, tanto la vista resumida como la vista Excel presentan una entrada agrupada dentro de los filtros y la hoja seleccionados. Abrirla muestra el total completo del modelo, sumas por ubicación y el desglose por material, composición, color, talla y ubicación.

La agrupación suma cada ID una sola vez. No crea unidades ni modifica cantidades en Supabase. Las cantidades desconocidas permanecen indicadas como pendientes y las ventas se separan de las existencias actuales. La ficha agrupa materiales para su presentación y mantiene el detalle de cada variante; no convierte baby alpaca pura en Cancas.

**Ver desglose** conserva acceso a los registros originales y sus proveedores, hilo, acabado, precios, ubicación e historial. Las operaciones y la edición de cantidades siguen ejecutándose sobre los registros reales. En modo de edición se muestran esos registros para evitar editar un total agregado como si fuese una fila. El CSV conserva los registros y cantidades originales correspondientes a los filtros, sin añadir la fila de presentación como stock adicional.

## Revisión de cantidades

La revisión del 22/10/2026 encontró 34 registros de Allin, con 106 unidades conocidas: 93 España, 7 Lima y 6 Muestras / revisión. Por material: 105 unidades de Cancas (baby alpaca + algodón) y 1 de baby alpaca pura. Los títulos de hilo y estados de acabado no son idénticos en todos los registros; se conservan al consultar el desglose.

La referencia privada de la revisión está en `data/allin-before-20261022.json`, excluida de Git y del despliegue. El inventario completo en esa lectura tenía 297 registros y 398 unidades conocidas. Estos valores son una referencia de comprobación, no valores fijos de la interfaz: la ficha siempre suma las cantidades actuales.

## Validación

45 pruebas automatizadas pasaron, además de la compilación y las regresiones de navegador de logística y distribución. La prueba de navegador de Allin verificó una entrada por ficha, las 106 unidades del conjunto revisado, desglose, filtros, consulta del registro original, CSV, móvil y ausencia de escrituras de inventario. Las pruebas unitarias cubren alias, exclusión de archivados y vendidos de stock, cantidades desconocidas, IDs repetidos y separación de materiales y ubicaciones.
