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

Publicada el 22/10/2026 en https://euroalpaca-inventario.vercel.app/. Se aplicó `supabase/stock-distribution.sql` después de `stock-control.sql`, registrada como `stock_distribution_and_sold_rows`. Despliegue Vercel `dpl_EdmLr152JYUiXt7TxsY4XMcUEosA`, READY, código `3c0ca0a37f99f11ae09d4a8c8076a392479baf80`.

Las 226 filas y las 396 unidades conocidas conservan todos sus campos: hash integral anterior y posterior `f11e752d12e084708e77b788898c5859`. Las RPC de traslado y venta, sus reintentos y el historial se comprobaron en producción dentro de una transacción revertida. No quedaron registros ficticios. El dominio oficial sirve los cinco módulos nuevos y conserva la configuración de Supabase y el modo producción. Las pruebas de navegador del código publicado, con datos aislados, comprobaron distribución, ventas y selección de stock normal y bajo.

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

Junto a **Seleccionar prenda del inventario**, el selector **Disponibilidad** permite elegir **Stock y Stock bajo**, **STOCK** o **STOCK BAJO**. Este ajuste está publicado con el despliegue `dpl_G4qxUWzmAhHbKtJi3DvpXNQNvJQZ`, READY, código `d846095c2ea8eacf77cfa2486e0337e8fd72d21c`. Se comprobaron las tres opciones y la selección de una sola unidad contra el código del dominio oficial, usando datos aislados.

El selector de **Registrar movimiento → Prendas y lotes del envío** incluye las filas no archivadas con cantidad mayor a cero en la ubicación de origen. Tanto **En stock** como **Stock bajo** son seleccionables, incluida una única unidad. Las opciones muestran código, modelo, categoría, color, talla, ubicación, cantidad y estado calculado con el stock mínimo de la fila. Cero, cantidades sin confirmar y Vendida no se ofrecen para envío.

Esta corrección del selector no necesita migración adicional. Conserva las validaciones acumuladas por prenda, los lotes, materiales y responsables, el descuento al confirmar despacho y la recepción idempotente. Pruebas específicas: `node tests/shipment-picker-browser.mjs`; regresiones: `node --test tests/logistics.test.mjs` y `node tests/logistics-browser.mjs`. Todas pasaron, junto con la compilación.
