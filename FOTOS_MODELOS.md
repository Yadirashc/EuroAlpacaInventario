# Fotografías de modelos

Actualización del 16/10/2026: las portadas de Modelos y las miniaturas del inventario resumido usan las fotografías de producto vinculadas al modelo. La ficha de cada variante y el detalle de modelo muestran una galería con ampliación. Las imágenes conservan su proporción para identificar la prenda completa.

Se seleccionaron tres referencias por cada uno de los 12 SKU de la carpeta autorizada `catalogo digital`: ACPE08, RAKI37, RAAY35, BATR03, BAKU36, ACSU29, ACQO17, ACMU30, ACKI23, ACIL33, ACBA22 y AMCR09. El nombre conserva el SKU y la referencia original; la numeración establece la portada. Las fotografías identifican el modelo y no confirman el color ni la disponibilidad de una variante.

La importación utiliza la API autenticada existente y el bucket privado `textile-private`, con visibilidad para el equipo que tiene acceso al sistema. Los originales de Drive mantienen sus permisos. No se copian imágenes al repositorio ni al catálogo público. La carpeta `3 MODELOS` requiere identificación antes de vincular sus imágenes.

Esta importación es una copia optimizada. La actualización automática desde Drive sigue pendiente de configurar la cuenta de servicio; cambiar una foto en Drive no actualiza por sí solo la copia importada. Las siguientes fotos pueden añadirse o cambiarse en Fotografías.

Validación: `npm test`, `npm run build` y `node tests/model-photos-browser.mjs`. La prueba de navegador comprueba portadas, miniaturas, galería en fichas, ampliación, separación entre modelos y vista móvil.
