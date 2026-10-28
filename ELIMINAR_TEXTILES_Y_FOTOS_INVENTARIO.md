# Gestión textil e Inventario — 28/10/2026

Gestión textil incorpora el acceso administrativo **Eliminar hilos y colores**. Incluye listas separadas de colores e hilos, búsqueda por nombre/código/proveedor, selección individual o de hasta 500 registros y eliminación mediante la confirmación y Papelera existentes. Muestra los bloqueos por stock, requerimientos pendientes o colores vinculados a un hilo. Las prendas, sus cantidades y las fotografías se conservan.

Inventario incorpora **Cambiar foto del modelo** en las vistas resumida y Excel, incluida la agrupación especial Allin, y **Editar color** en la ficha de la prenda. El formulario de color conserva la selección explícita de registros de la captura de referencia; se mantienen las modificaciones individuales sin propagarlas a otras prendas.

La foto admite PNG, JPG/JPEG y JXL de hasta 5 MB. La carga se vincula al modelo indicado sin abandonar Inventario. Si ya hay una foto principal privada, se reemplaza conservando su ID y creando rutas WebP nuevas para evitar mostrar una copia almacenada en caché. Las otras fotos y los otros modelos permanecen intactos. La foto se comparte entre las variantes de ese mismo modelo, como explica el formulario. La sustitución manual desvincula únicamente esa foto de una sincronización anterior de Drive.

Validación: 89 pruebas automatizadas; pruebas de navegador de edición individual, carga y sustitución de foto, selección/cancelación/eliminación/restauración de textiles, conservación de cantidades y otras fotos, y diseño móvil. Archivos: `tests/model-photo.test.mjs`, `tests/textile-deletion.test.mjs`, `tests/textile-management-browser.mjs`. No requiere migraciones de base de datos.
