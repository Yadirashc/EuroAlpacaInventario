# Un solo apartado de Gestión textil — 23/10/2026

Los accesos independientes **Panel textil**, **Carta de colores** e **Hilos y almacén** se sustituyeron por **Gestión textil** en el menú.

La página principal contiene una tabla agrupada por proveedor con:

- Hilo comercial, material y composición.
- Nombre del color encima de su foto y código.
- Título técnico, kilos de hilo en almacén y unidades de prendas vinculadas.
- Disponibilidad del proveedor y accesos a ficha, edición, fotografía y conteo.

Los filtros permiten buscar por proveedor, referencia comercial, material y familia cromática. Las referencias técnicas de los hilos se consultan en un bloque desplegable de la misma página, incluyendo los hilos que aún no tengan colores. La planificación, las alertas y el seguimiento anteriores se conservan en otro bloque desplegable administrativo.

Las fichas y los accesos desde el inventario vuelven al apartado único. Se conservan el catálogo por proveedor, las fotografías privadas, la relación con las prendas y los controles de edición. Los usuarios de consulta pueden consultar la tabla; los controles de escritura y el seguimiento administrativo mantienen sus restricciones.

No se cambian cantidades ni se vuelven a migrar los registros del catálogo.

Validación: 64 pruebas automatizadas, compilación, `node tests/textile-unified-browser.mjs` y `node tests/inventory-color-browser.mjs`. Se comprobaron navegación única, filtros, carga de foto sin formulario de autorización, edición, kilos, cambio de referencia/proveedor, vínculos con inventario, vista móvil y rol de consulta.
