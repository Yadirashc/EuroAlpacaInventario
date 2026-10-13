# Inventario fiel al Excel y edición de cantidades

La única fuente de este trabajo es **INVENTARIO PRENDAS.xlsx** de Google Drive. No se usa el catálogo de otra web para definir prendas o características.

Se descargó de nuevo el XLSX y se comprobaron **4.506 campos de 226 filas**. Las hojas contienen 64, 84 y 78 filas con prendas. Se conservaron todas las filas, incluidos datos vacíos y posibles repeticiones. No se reemplazan cantidades desconocidas por cero. Los nombres completos del Excel permanecen en los datos; las tarjetas limitan el texto para evitar deformaciones.

Los nombres equivalentes se agrupan usando nombre normalizado y familia de prenda: mayúsculas, minúsculas y espacios no crean otro modelo. Falda Wayra y blusa Wayra siguen siendo prendas distintas. Las filas no se consolidan ni se suman automáticamente para borrar registros; mantienen sus materiales, colores, tallas, estados, hoja y fila original.

## Cómo editar

1. Abre **Inventario** y selecciona la hoja del Excel.
2. Pulsa **Modo edición** y escribe las cantidades finales en la columna **CANTIDAD**.
3. Pulsa **Guardar cantidades**, revisa el resumen y confirma el motivo.

También puedes abrir una ficha y pulsar **Editar cantidad**. Para modificar material, color, talla, proveedor u otros campos, usa **Editar ficha**. **Descartar cambios** solo borra cambios todavía no guardados.

La edición de cantidades solo está disponible para la administradora. Se guarda en Supabase mediante una transacción: todos los cambios se aplican juntos, cada uno registra un ajuste en el historial y los reintentos no duplican movimientos. Si alguien cambió una cantidad mientras editabas, la operación se rechaza para que puedas revisarla. Cantidades negativas y fraccionarias no se aceptan. Cero representa stock agotado.

Los cambios del sistema no escriben automáticamente en Google Sheets. Las cantidades de la vista Excel representan el inventario actual de Supabase; los valores originales del archivo se conservan en cada ficha. El hilo **18/2** sigue el formato **d/m** original del XLSX; **2/28** y **2/40** se conservan.

## Instalación nueva

`supabase/schema.sql` ya incluye el modo edición. Para una base creada anteriormente, aplica únicamente `supabase/quantity-edit.sql`. No vuelvas a ejecutar el esquema completo sobre la base existente.
