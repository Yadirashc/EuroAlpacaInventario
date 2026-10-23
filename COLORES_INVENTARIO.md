# Fotografías en la columna Color — 23/10/2026

La columna **Color** del inventario muestra únicamente miniaturas circulares de las fotografías verificadas de la Carta de colores. El nombre y código se mantienen en los datos y en la ficha; la miniatura admite ampliación y conserva una etiqueta accesible y un título al pasar el cursor.

La asociación utiliza proveedor, nombre comercial del hilo, composición, título y código de color. No se elige una fotografía únicamente por el nombre del color. Los títulos de hilo convertidos a fechas por Excel se normalizan para la comparación. Cuando no existe una coincidencia verificada, aparece un indicador de fotografía pendiente, sin generar un tono aproximado.

Se aplica a la vista resumida, la columna COLOR de la vista Excel y las filas agrupadas, incluido Allin. Los grupos reúnen las imágenes de sus registros sin repetir una misma fotografía. La columna independiente de código del archivo y las fichas conservan sus datos originales. Las fotografías continúan usando almacenamiento privado y los permisos del usuario.

No hay migraciones, cambios de cantidades ni importaciones de imágenes. Validación: 59 pruebas automatizadas, compilación, pruebas de asociación exacta y recorrido de Chrome headless con datos aislados (`node tests/inventory-color-browser.mjs`), incluida carga en Carta de colores, visualización sin texto, ampliación, agrupación, filtros y vista Excel.
