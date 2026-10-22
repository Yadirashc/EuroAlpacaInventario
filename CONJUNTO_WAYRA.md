# Conjunto WAYRA · AMCR09

La falda y la blusa WAYRA comparten el modelo CR09 y el código comercial AMCR09. Los códigos anteriores CR10, WA39 y WA40 se reconocen como referencias del mismo conjunto al importar o consultar registros anteriores.

Modelos muestra una sola ficha, con fotografías y un selector Falda / Blusa. Las variantes se distinguen también por pieza: las cantidades de falda y blusa no se suman como si fueran unidades de una misma variante o conjuntos completos. Se conservan las categorías de las piezas, referencias internas de fila, precios, cantidades y campos originales del Excel. El catálogo público ofrece el mismo selector.

Aplicar `supabase/wayra-set.sql` antes de unificar los códigos guardados: conserva el control de permisos, bloqueos, reintentos y auditoría de los traslados, y añade el control de pieza para CR09. Actualizar únicamente `name` y `model_code` de los registros WAYRA existentes, con sesión de administradora para registrar su auditoría. Las fotos ya vinculadas a CR09 se comparten en la ficha del conjunto.

Validación: `npm test`, `npm run build`, `node tests/wayra-browser.mjs`. Incluye agrupación de códigos anteriores, cantidades separadas por pieza, conservación de referencias internas y rechazo de traslados entre falda y blusa.
