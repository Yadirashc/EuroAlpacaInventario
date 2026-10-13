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

Coinciden los 11 modelos del catálogo web: Kinti, Munay, Sumaq, Illa, Qori, Killa, Suyay, Aruma, Kuyay, Ayni y Allin. Se ajustaron los colores del sistema a la paleta de la web pública.

Se verificaron login real de administradora, creación de operadora y consulta desde la API publicada, lectura de inventario, bloqueo de administración para ambos roles, rechazo de lectura anónima, bloqueo de modificación directa de stock, ajustes, dos salidas simultáneas y recepción real de eventos Realtime. Todas las cuentas y prendas de prueba se eliminaron. Las 226 filas originales quedaron intactas.

Hay 2 cantidades desconocidas y 116 registros señalados para revisión por faltantes, posibles repeticiones o títulos del hilo convertidos a fechas en Excel. Las 396 unidades son suma de filas antes de resolver repeticiones, no un conteo físico certificado. Los 44 códigos se agrupan provisionalmente por nombre y tipo; no se fusionaron nombres parecidos.

## Uso y actualizaciones

Las credenciales de administradora se entregaron por separado; no se guardan en este repositorio. El registro público está desactivado. Las cuatro variables de Supabase ya se configuraron en Vercel; la clave privada solo está en el servidor.

Esta versión se desplegó directamente desde el contenido del commit de GitHub. Falta instalar la integración oficial Vercel–GitHub para despliegues automáticos con cada push:

1. En Vercel, abre el proyecto → Settings → Git.
2. Instala/autoriza Vercel para el repositorio `Yadirashc/EuroAlpacaInventario`.
3. Vincula ese repositorio y selecciona `main` como rama de producción.

El catálogo de www.euroalpaca.com no fue modificado. Para usar `inventario.euroalpaca.com`, añade ese dominio al proyecto y configura el DNS que Vercel indique. El inventario todavía no sincroniza cantidades con el catálogo público ni escribe cambios a Google Sheets.
