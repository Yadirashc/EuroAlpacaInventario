# Limpieza, códigos y catálogo completo

Los datos ya se actualizaron en Supabase. Las cantidades, IDs, movimientos y campos originales permanecen conservados. La presentación usa nombres y colores con mayúsculas uniformes, composiciones con separadores consistentes y títulos cortos en las tarjetas.

## Códigos cortos

Ejemplo: `BA01MOM` = BA (Baby Alpaca) + 01 (modelo) + MO (mostaza) + M (talla). Sin guiones. Leyenda completa: [CODIGOS.md](CODIGOS.md) y sección **Leyenda de códigos** del sistema actualizado.

El código comercial distingue material, modelo, color y talla. El código interno añade tres números para distinguir filas y conserva trazabilidad mediante los IDs y `audit_log`. Los códigos del proveedor se mantienen en sus campos originales.

## Título del hilo

Se comprobó el archivo XLSX original: numFmtId 164 usa `d/m` en todas las celdas que la importación interpretó como fechas. El valor serial `46071` se muestra en Excel como **18/2**. Se normalizó a ese texto, sin horas ni año. Los valores **2/28** y **2/40** no se cambiaron. Las celdas vacías no se rellenan con valores inventados.

## Todas las prendas

El catálogo nuevo en `/catalogo.html` incluye los **44 grupos de modelos** del inventario, en lugar de los 11 de la web pública actual. La ficha permite seleccionar material, color y talla: el SKU cambia con la combinación elegida. Usa nombres de colores del inventario, no «Tono 01». Las variantes sin stock comercial confirmado no se anuncian como disponibles.

El endpoint `/api/catalog` publica únicamente características de las prendas. No devuelve cantidades exactas, proveedores, observaciones internas, ubicaciones ni los campos originales privados. Se actualiza desde Supabase con caché de 30 segundos.

## Publicación pendiente

El diseño nuevo se verificó localmente en Chrome, pero este entorno perdió su conexión al Chrome autenticado y no tiene credenciales de Vercel. Para publicarlo, conecta el repositorio en Vercel → proyecto `euroalpaca-inventario` → Settings → Git. Al desplegar `main`, las pantallas actualizadas y `/api/catalog` quedan disponibles.

Para actualizar **www.euroalpaca.com**, hace falta acceso al proyecto de esa web. Sus datos actuales se sirven desde su propio `/api/catalog`; ese catálogo no está conectado todavía a este inventario. El nuevo endpoint y la vista completa están preparados para integrarlos. No se afirma que la web principal ya haya sido modificada.
