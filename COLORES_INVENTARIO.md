# Fotografías en la columna Color — 23/10/2026

La columna **Color** del inventario muestra el nombre del color encima de la miniatura circular de su fotografía en la Carta de colores. Al pulsar el nombre se abre la misma ficha de color; al pulsar la fotografía se amplía. El código permanece en la ficha y en los datos del archivo.

La asociación utiliza proveedor, nombre comercial del hilo, composición, título y código de color. No se elige una fotografía únicamente por el nombre del color. Los títulos de hilo convertidos a fechas por Excel se normalizan para la comparación. Cuando no existe una coincidencia verificada, aparece un indicador de fotografía pendiente, sin generar un tono aproximado.

Se aplica a la vista resumida, la columna COLOR de la vista Excel y las filas agrupadas, incluido Allin. Los grupos reúnen las imágenes de sus registros sin repetir una misma fotografía. La columna independiente de código del archivo y las fichas conservan sus datos originales. Las fotografías continúan usando almacenamiento privado y los permisos del usuario.

Inventario, Carta de colores y Panel textil comparten los mismos registros. La Carta y las fichas incluyen enlaces para ver las prendas asociadas a ese color, abrirlo en el Panel y consultar el hilo en almacén. El inventario muestra un filtro contextual del color seleccionado, con acceso para quitarlo y volver a ver todas las prendas.

El Panel muestra una selección de hasta seis colores de la Carta (priorizando los que tienen fotografía), con nombre, código, proveedor, foto, kilos de hilo en almacén y unidades de prendas vinculadas. Cuando se llega desde una ficha, muestra el seguimiento del color elegido. Las cantidades desconocidas se distinguen; las prendas vendidas no se suman a las existencias. El Panel conserva su acceso administrativo.

Una corrección del nombre de la Carta se refleja en el rótulo del inventario y el Panel sin reescribir los datos originales de las prendas. La relación también funciona cuando aún no hay fotografía, siempre que exista una coincidencia técnica exacta.

No hay migraciones, cambios de cantidades ni importaciones de imágenes. Validación: 60 pruebas automatizadas, compilación y Chrome headless con datos aislados (`node tests/inventory-color-browser.mjs`): nombre sobre la foto, ampliación, agrupación, filtros, vista Excel, navegación en ambas direcciones, actualización de nombre y stock en las tres vistas y formato móvil.
