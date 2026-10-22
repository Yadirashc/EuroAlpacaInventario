# Ficha única Allin / Cancas

Allin, Cancas y Bufanda Cancas se reúnen en una sola ficha de modelo. En Inventario, tanto la vista resumida como la vista Excel presentan una entrada agrupada dentro de los filtros y la hoja seleccionados. Abrirla muestra el total completo del modelo, sumas por ubicación y el desglose por material, composición, color, talla y ubicación.

La agrupación suma cada ID una sola vez. No crea unidades ni modifica cantidades en Supabase. Las cantidades desconocidas permanecen indicadas como pendientes y las ventas se separan de las existencias actuales. La ficha agrupa materiales para su presentación y mantiene el detalle de cada variante; no convierte baby alpaca pura en Cancas.

**Ver desglose** conserva acceso a los registros originales y sus proveedores, hilo, acabado, precios, ubicación e historial. Las operaciones y la edición de cantidades siguen ejecutándose sobre los registros reales. En modo de edición se muestran esos registros para evitar editar un total agregado como si fuese una fila. El CSV conserva los registros y cantidades originales correspondientes a los filtros, sin añadir la fila de presentación como stock adicional.

## Revisión de cantidades

La revisión del 22/10/2026 encontró 34 registros de Allin, con 106 unidades conocidas: 93 España, 7 Lima y 6 Muestras / revisión. Por material: 105 unidades de Cancas (baby alpaca + algodón) y 1 de baby alpaca pura. Los títulos de hilo y estados de acabado no son idénticos en todos los registros; se conservan al consultar el desglose.

La referencia privada de la revisión está en `data/allin-before-20261022.json`, excluida de Git y del despliegue. El inventario completo en esa lectura tenía 297 registros y 398 unidades conocidas. Estos valores son una referencia de comprobación, no valores fijos de la interfaz: la ficha siempre suma las cantidades actuales.

## Validación

45 pruebas automatizadas pasaron, además de la compilación y las regresiones de navegador de logística y distribución. La prueba de navegador de Allin verificó una entrada por ficha, las 106 unidades del conjunto revisado, desglose, filtros, consulta del registro original, CSV, móvil y ausencia de escrituras de inventario. Las pruebas unitarias cubren alias, exclusión de archivados y vendidos de stock, cantidades desconocidas, IDs repetidos y separación de materiales y ubicaciones.
