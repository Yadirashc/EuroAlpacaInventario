# Precios de venta

Se consultaron el catálogo público, su endpoint `/api/catalog` y su interfaz el 13 de octubre de 2026. Los 11 productos de euroalpaca.com no publican importes ni moneda; la web remite a cotización. Por ello no se asignaron precios a las prendas.

La implementación permite guardar un precio de venta y moneda por registro de variante, desde **Editar ficha**. Se muestra en inventario, ficha y exportación CSV. El campo vacío aparece como **Por confirmar**. Solo la administradora puede editarlo y cada cambio queda en la auditoría, con fecha de actualización.

No existe sincronización automática de precios con la web. Hace falta una lista de precios o un enlace que publique los importes para realizar la importación y verificar cada correspondencia.

## Publicación pendiente

El código está verificado localmente. Aplicar `supabase/prices.sql` a la base existente y después desplegar este commit en Vercel. `supabase/schema.sql` incluye la migración para instalaciones nuevas. No ejecutar todo el esquema sobre una base ya creada.
