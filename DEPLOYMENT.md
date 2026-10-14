# Estado de EUROALPACA

Publicado y verificado el 13/10/2026.

- Web: https://euroalpaca-inventario.vercel.app
- Código: https://github.com/Yadirashc/EuroAlpacaInventario
- Supabase: https://supabase.com/dashboard/project/sdxfmtbtyoibtpxxchdj
- Vercel: proyecto `euroalpaca-inventario`, equipo `Yadira Corp`.

## Importación y comprobaciones

Se importaron las tres hojas del Excel original de Google Drive. Se contrastaron, fila a fila, prenda, cantidad, composición, color y talla. Cada ficha guarda nombre de hoja, número real de fila y todos los campos originales en `source_snapshot`.

| Hoja | Filas | Cantidades conocidas |
| --- | ---: | ---: |
| INVENTARIO - TALLER | 64 | 74 |
| PRODUCCIÓN QURI | 84 | 140 |
| INFO DE ENVIOS | 78 | 182 |
| Total | 226 | 396 |

El Excel es la única fuente. Se comprobaron 4.506 campos originales y se añadió una vista por hoja con todos sus campos y modo de edición de cantidades para la administradora.

Se verificaron login real de administradora, creación de operadora y consulta desde la API publicada, lectura de inventario, bloqueo de administración para ambos roles, rechazo de lectura anónima, bloqueo de modificación directa de stock, ajustes, dos salidas simultáneas y recepción real de eventos Realtime. Todas las cuentas y prendas de prueba se eliminaron. Las 226 filas originales quedaron intactas.

Hay 2 cantidades desconocidas. Las 396 unidades son la suma de cantidades conocidas. Hay 40 grupos de modelos: mayúsculas, minúsculas y espacios no crean modelos separados. Las 226 filas permanecen intactas. El título del hilo 18/2 sigue el formato original del XLSX.

## Uso y actualizaciones

Los códigos comerciales identifican modelo y composición, y son iguales para todos sus colores y tallas. Por ejemplo, `SU38AC` se conserva al elegir beige u olivo, en S o M; `AC` significa 15% baby alpaca y 85% algodón Tangüis. Cada talla mantiene sus propias existencias. La ficha permite guardar un precio de venta y moneda; los importes todavía no confirmados permanecen vacíos. Consulta [CODIGOS.md](CODIGOS.md) y [PRECIOS.md](PRECIOS.md).

Las credenciales de administradora se entregaron por separado; no se guardan en este repositorio. El registro público está desactivado. Las cuatro variables de Supabase ya se configuraron en Vercel; la clave privada solo está en el servidor.

Esta versión se desplegó directamente desde el contenido del commit de GitHub. Falta instalar la integración oficial Vercel–GitHub para despliegues automáticos con cada push:

1. En Vercel, abre el proyecto → Settings → Git.
2. Instala/autoriza Vercel para el repositorio `Yadirashc/EuroAlpacaInventario`.
3. Vincula ese repositorio y selecciona `main` como rama de producción.

El inventario guarda los cambios en Supabase; no escribe automáticamente en Google Sheets. Instrucciones de edición: MODO_EDICION.md.

