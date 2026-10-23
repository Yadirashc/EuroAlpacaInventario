# Orden del inventario

Publicado el 23/10/2026 en el dominio oficial con `dpl_ALr4kse9fLPvnwErLEoYPwQ57uAs`, READY, código `3b5834636688a77cf646dd2179de58c973e19939`. Los cuatro módulos servidos coinciden con el código probado. La prueba de navegador publicada pasó. Se comprobó el orden en Chrome real y el inventario completo es idéntico antes/después: 297 registros, SHA-256 `a24044783d2d5bef8afc9136dbdba0287ae33f35530f1966b1ab390b9546e351`.

El orden predeterminado es modelo (A–Z), color (A–Z) y talla (de menor a mayor). Las tallas siguen XXS, XS, S, M, L, XL, XXL, 3XL, 4XL y extensiones; las tallas numéricas conservan orden numérico y las tallas únicas o sin registrar aparecen después. Las ubicaciones y materiales se usan para desempatar sin mezclar existencias.

Se aplica a inventario resumido, vista con columnas del Excel, modo de edición, filtros, paginación, precios, fichas de modelos y exportación CSV. La vista del Excel conserva la hoja y los números de fila originales, pero los presenta en el orden solicitado. No se escriben datos de prendas, cantidades ni movimientos para ordenar.

Comprobación del 23/10/2026: 46 pruebas automatizadas, compilación, navegador con tallas hasta 4XL, orden de modelos y colores, navegación entre páginas, filtros, edición, fichas de modelo y regresión de agrupación Allin. La referencia privada y el script de comprobación visual están en `data/`, fuera de Git y del despliegue.
