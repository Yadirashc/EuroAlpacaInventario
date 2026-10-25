# Colores, hilos, entregas y traslados — 25/10/2026

Gestión textil reúne la ficha de color e hilo: nombre y código del color, familia (Neutros, Sólidos o Melange), nombre y código del hilo, composición, material, título y proveedor. Guardar crea una referencia independiente del color para no cambiar otros colores del mismo hilo. Las futuras normalizaciones del catálogo respetan estas referencias.

Las cantidades de prendas se consultan mediante una relación visual por color y código. No se reescriben cantidades, composición o proveedores de las prendas al editar la ficha textil. La fotografía del color, o la referencia disponible del hilo, aparece debajo del nombre del color en Inventario. El selector al crear una prenda muestra todos los colores activos con su nombre y código, sin información adicional de proveedores o composición.

Se retiran del menú Proveedores de hilos, Precios, Clientes y envíos y Por revisar. Sus registros históricos se conservan. Entregas y retiros pasa a Entregas y traslados, con dos módulos y un historial común por lote.

Entregas permite registrar fecha de salida, receptor, marca o empresa, origen, destino, responsable y productos. Cada producto conserva modelo, nombre, color, código, talla, cantidad, material, composición, proveedor, hilo y título. Traslados utiliza las prendas registradas y acumula en la variante equivalente del destino, o crea el registro de destino si aún no existe. Las tallas, materiales y lotes distintos siguen separados.

Las salidas y traslados usan funciones de stock existentes e identificadores estables. Si un lote queda a medias se muestra como pendiente y se puede completar sin repetir los movimientos aplicados. No se requieren migraciones nuevas; se utilizan las tablas y funciones previamente instaladas. La publicación no mueve existencias ni carga fotografías nuevas.

Validación: pruebas unitarias y de PostgreSQL, incluida la ejecución del servidor de lotes contra PostgreSQL local; pruebas de navegador con datos aislados para ficha independiente, selector, imagen en inventario, entregas, traslados, destino existente, permisos de consulta y vista móvil.
