Inventario y Gestión textil comparten `items.textile_color_id`, una clave foránea a `textile_colors`. El disparador mantiene compatible la referencia histórica de `source_snapshot`, sin modificar existencias ni SKU.

Aplicar `supabase/inventory-textile-links.sql` antes de desplegar la interfaz. La función `save_shared_textile_color` valida administración y guarda de forma atómica el hilo, el color y, cuando corresponde, las prendas seleccionadas. Reutiliza las fichas registradas; los disparadores rechazan nuevas copias del mismo hilo/título o color. Los cambios de una prenda conservan las otras relaciones y sus cantidades.

En Inventario, el selector ofrece colores de Gestión textil con hilo y proveedor. «Nuevo hilo y color» permite registrar la ficha y su fotografía, y vuelve al formulario conservando el borrador. Las prendas nuevas se incorporan a INFO PRODUCCIÓN o INFO DE ENVIOS según su ubicación.

La unificación de registros existentes conserva los originales en Papelera, las referencias de fotografías, el historial y los datos del Excel. Un color puede compartir fotografía entre prendas con distintos títulos técnicos; los títulos originales de las prendas se conservan.

Validación: `npm test` y `npm run build`. `tests/inventory-textile-links.test.mjs` comprueba relaciones, permisos, duplicados, fotografías compartidas y edición aislada en PostgreSQL.
