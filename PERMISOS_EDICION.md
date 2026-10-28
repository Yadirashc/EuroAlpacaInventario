# Permisos de edición — 28/10/2026

Se corrigió en producción el error `42501: permission denied for table items` que aparecía al guardar una ficha con referencia de color. La cuenta ya era administradora; faltaba el permiso de actualización de la columna `items.source_snapshot`, que utiliza la web para vincular o quitar colores de una prenda.

La corrección está incluida en `schema.sql` para nuevas instalaciones y en `admin-edit-permissions.sql` para bases existentes. Las políticas de filas mantienen la edición de fichas exclusivamente para administración. Las cantidades siguen editándose mediante los ajustes e historial de movimientos de la aplicación.

Verificación en producción: los 30 campos del formulario de inventario y los campos editables de ocho tablas textiles aceptan solicitudes con la sesión de administradora. Se ejecutó además `tests/helpers/admin-edit-check.sql` con el rol PostgreSQL `authenticated` y una identidad administrativa: inserción y edición de una ficha temporal, vinculación del color, ajuste de cantidad, creación y edición de hilos/colores/stock/fotografías, eliminación y restauración. Toda la prueba se revirtió con `ROLLBACK`; no quedaron registros temporales.

La regresión `tests/admin-edit-permissions.test.mjs` reproduce el permiso faltante, aplica dos veces la migración y verifica que administración guarda los cambios mientras los roles de consulta y operadora mantienen su alcance. La corrección de base de datos entra en vigor sin redesplegar la web.
