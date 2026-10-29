Entregas y traslados usan un selector con búsqueda por modelo, SKU, color, talla, material y lote. Las tarjetas muestran la foto privada del modelo, sus características y el stock disponible en el origen elegido. Agregar una tarjeta selecciona la variante exacta; las cantidades se validan antes de guardar y conservan la trazabilidad del lote.

Para requerimientos, aplicar `supabase/yarn-requirement-catalog.sql` antes de desplegar esta interfaz. Requiere la migración anterior `supabase/inventory-textile-links.sql`.

Un requerimiento puede referirse a un color existente de Gestión textil o guardar una propuesta de hilo/color en `textile_requirements.proposed_yarn`. Una propuesta no crea proveedores, hilos ni colores en el catálogo hasta recibir completamente la orden. Las recepciones parciales quedan registradas en `textile_receipts`; al completar, se reutiliza o crea la ficha compartida y se añaden todos los kilos recibidos una sola vez, dentro de la misma transacción.

Los hilos existentes mantienen el cálculo de compra contra su stock confirmado y las recepciones incrementan ese stock. Si una propuesta coincide con una ficha existente sin conteo confirmado, se pide confirmar ese conteo antes de completar, para conservar el significado del stock desconocido.

Las recepciones son idempotentes y validan cantidades, estado y permisos. Una solicitud con recepciones conserva su material y cantidad original. Las prendas, sus SKU, sus fotografías y sus cantidades no se modifican por estos cambios.

Validación: `npm test`, `npm run build` y `node tests/linked-workflows-browser.mjs`. La prueba de navegador usa datos locales aislados, comprueba el selector con fotos, un traslado, el flujo de recepción parcial/completa y la vista móvil. No crea registros en producción.
