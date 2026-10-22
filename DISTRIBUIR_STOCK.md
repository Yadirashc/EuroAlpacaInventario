# Distribuir stock y ubicación Vendida

Implementación sobre la tabla existente. Conserva columnas, fotografías, estilos, vistas Excel/resumida, filtros y paginación.

## Uso

- Abre una fila y elige **Distribuir stock**. También está en **Editar ficha** y **Editar cantidad**.
- Selecciona Lima, España o Muestras / revisión, indica unidades, fecha, persona que lleva o recibe, responsable y observaciones. El movimiento descuenta del origen y crea o acumula en la fila de destino.
- Elige **Vendida** para registrar una venta; aparece además el comprador. También sigue disponible **Registrar venta**, con su precio opcional.
- Una venta de 3 sobre 8 unidades en España deja 5 en España y 3 en Vendida. Las ventas sucesivas se acumulan en la fila Vendida; cada operación conserva su comprador, fecha, persona, responsable y ubicación de origen en **Ver historial**.
- **Corregir venta** conserva el registro original, reduce el saldo vendido y devuelve unidades al origen.
- Los cambios de ubicación desde Editar ficha abren el formulario de distribución para solicitar cuántas unidades mover. No reasignan todas las unidades.
- Las filas en cero permanecen consultables. Vendida se muestra como **No disponible** y se excluye de totales disponibles y de la disponibilidad del catálogo público.

## Base de datos y publicación

Esta modificación necesita aplicar `supabase/stock-distribution.sql` **después** de las migraciones actuales, incluida `supabase/stock-control.sql`, antes de publicar el código nuevo en Vercel. No se ha aplicado a producción en esta sesión: falta una conexión operativa a Supabase y Vercel.

La migración es transaccional y repetible. Reutiliza `items`, `movements` y `stock_operations`; añade el tipo traslado, la RPC `distribute_stock` y la sincronización de ventas con las filas Vendida. Materializa las ventas históricas netas existentes sin volver a descontarlas del origen ni modificar sus registros.

La identidad de destino compara modelo, nombre, categoría, material, composición, color, código de color, talla, código de material, hebras, título, género y estado de producción. Cada movimiento conserva una instantánea del origen. No modifica los campos originales de producción. Los precios y atributos del destino existente se conservan; una fila nueva copia los del origen.

Los movimientos y ventas se serializan con un bloqueo transaccional, validan permisos y existencias en PostgreSQL y usan un identificador estable para reintentos. Se impide reasignar una fila con stock mediante edición de ubicación, ajustar unidades vendidas mediante ajustes ordinarios, archivar una fila Vendida o convertirla en otra variante.

## Verificación

```text
npm.cmd test
npm.cmd run build
node scripts/server.mjs
node tests/stock-distribution-browser.mjs
node tests/stock-control-browser.mjs
node tests/logistics-browser.mjs
```

La prueba nueva de navegador usa PostgreSQL PGlite real para las RPC y datos ficticios aislados. Verifica el caso Lima 10 → Lima 2 / España 8 → España 5 / Vendida 3, doble clic, comprador/persona/origen en historial, recarga, filtros, total disponible y móvil. Las pruebas SQL cubren acumulación en destino, insuficiencia de stock, separación de color y talla, permisos, correcciones, historial inmutable, migración de ventas anteriores y repetición de migración.

La compilación local sin variables públicas genera una demostración. En Vercel se deben conservar las variables de Supabase ya configuradas; no reemplazar el sitio publicado con un `dist` local sin conexión.

## Selector de prendas de envíos

El selector de **Registrar movimiento → Prendas y lotes del envío** incluye las filas no archivadas con cantidad mayor a cero en la ubicación de origen. Tanto **En stock** como **Stock bajo** son seleccionables, incluida una única unidad. Las opciones muestran código, modelo, categoría, color, talla, ubicación, cantidad y estado calculado con el stock mínimo de la fila. Cero, cantidades sin confirmar y Vendida no se ofrecen para envío.

Esta corrección del selector no necesita migración adicional. Conserva las validaciones acumuladas por prenda, los lotes, materiales y responsables, el descuento al confirmar despacho y la recepción idempotente. Pruebas específicas: `node tests/shipment-picker-browser.mjs`; regresiones: `node --test tests/logistics.test.mjs` y `node tests/logistics-browser.mjs`. Todas pasaron, junto con la compilación.
