# Control de existencias — 22/10/2026

Integrado en la web actual: https://euroalpaca-inventario.vercel.app/

En Inventario, abrir una ficha. **Distribución de inventario** consolida la misma variante (modelo, categoría, material, composición, color, código de color y talla) entre las ubicaciones existentes. Muestra Lima, España, tránsito de envíos despachados aún sin recepción, ventas netas, custodia temporal y disponibilidad. Las ubicaciones no reconocidas se mantienen en **Ubicación por verificar**; no se asignan a Lima.

La cantidad superior corresponde explícitamente a la ubicación de la fila. Fotografías, campos originales, precios, descripción, proveedor y Excel de origen permanecen en la ficha.

- **Registrar traslado** reutiliza Clientes y envíos. Un pendiente no descuenta. El despacho descuenta origen y aparece en tránsito. La recepción confirmada suma al destino y deja de contar en tránsito. Se conservan lotes, fechas y responsables.
- **Registrar venta** guarda comprador, persona que retira/recibe, responsable, variante, ubicación, cantidad, fecha, precio opcional, moneda, importe, referencia y observaciones. Descuenta únicamente la fila seleccionada.
- **Registrar entrega o retiro** crea custodia temporal por préstamo, muestra, exhibición u otro. Descuenta origen sin aumentar ventas. Para venta o traslado, usar sus botones respectivos.
- **Entregas y retiros** permite devoluciones parciales al registro de origen y muestra unidades pendientes y fecha prevista de devolución.
- **Corregir venta** añade un ajuste vinculado al original. Restituye unidades a la ubicación de origen y reduce ventas netas. No borra la venta; después se puede registrar la operación correcta.
- **Registrar producción** registra nuevas unidades e incrementa el stock de la fila seleccionada.
- **Confirmar producción histórica** requiere administradora, cantidad total acumulada, responsable, fecha y evidencia/motivo. No cambia existencias. Hasta confirmar se muestra **Por confirmar**. Una nueva confirmación conserva las anteriores; las producciones posteriores se suman a la última confirmación.
- **Historial de movimientos** reúne operaciones nuevas y movimientos anteriores, con filtros por fechas, producto, ubicación, cliente/persona, tipo y búsqueda libre. La ficha también ofrece su historial por variante. Los ajustes de conteo existentes siguen disponibles y auditados.

Las ventas/entregas históricas sin datos estructurados no se inventan: los contadores de ventas y custodia corresponden a operaciones del nuevo control.

## Persistencia y migración

`supabase/stock-control.sql` es aditiva y repetible. Agrega `stock_operations` y `stock_operate`, con RLS, instantánea de producto, responsable autenticado, referencias entre operaciones y bloqueo de escritura directa para usuarios. Cada operación se ejecuta en una transacción, bloquea stock, valida cantidades y utiliza un UUID de solicitud estable para reintentos. Las devoluciones y correcciones bloquean su operación original para impedir superar las unidades pendientes. Reutiliza `record_movement`, `items` y logística.

No reasigna ubicaciones, no establece producción histórica y no modifica cantidades previas. Comparación integral de `items` antes/después: **226 filas, 396 unidades conocidas**, hash idéntico `0f1d9022eedbdf2bb149edb8b83b4716`. No quedaron operaciones ficticias.

## Verificación

- Compilación y 40 pruebas automatizadas correctas.
- PostgreSQL: permisos, insuficiencia de stock, separación de variantes, reintentos, devoluciones parciales, correcciones de ventas e historial inmutable.
- Navegador: venta por doble clic, entrega, retorno parcial, recarga, filtros, distribución, confirmación de producción y presentación móvil.
- Regresión de logística: clientes, lotes, materiales, despacho, recepción, filtros y móvil.
- Prueba de RPC en producción dentro de transacción revertida; inventario original idéntico después.

Despliegue Vercel `dpl_91Qb4go3ZGZ1dkJiAVQfzyd9Mtct`, READY, dominio oficial verificado.
