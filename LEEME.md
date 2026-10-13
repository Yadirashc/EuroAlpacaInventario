# EUROALPACA · Inventario

Sistema web en español, adaptable a celular, con login, perfiles de administradora/operadora/consulta, códigos de modelo, SKU únicos por registro, fichas técnicas, búsqueda, filtros, stock mínimo, entradas, salidas, ajustes, traslados, archivo de variantes, historial, exportación CSV e importación de nuevas variantes.

## Desplegar en 5 pasos

1. Crea un proyecto en **Supabase**. En **SQL Editor**, ejecuta `supabase/schema.sql` y después `supabase/seed.sql`.
2. En **Authentication → Users → Add user**, crea tu cuenta y contraseña. Ejecuta `supabase/bootstrap-admin.sql` cambiando `CAMBIA-POR-TU-CORREO` por tu correo. Desactiva el registro público en Authentication: las cuentas las crearás tú desde la web.
3. Sube el proyecto a un repositorio **privado** de GitHub. `.gitignore` excluye inventario, datos, archivos .env y dependencias. Conserva `data/` y `supabase/seed.sql` en tu equipo para importación y respaldo.
4. Importa el repositorio en **Vercel**, selecciona **Other** y configura estas variables en Settings → Environment Variables:

| Variable | Valor |
| --- | --- |
| VITE_SUPABASE_URL | URL del proyecto de Supabase |
| VITE_SUPABASE_ANON_KEY | Clave pública legacy `anon` de Supabase |
| SUPABASE_URL | La misma URL de Supabase |
| SUPABASE_SERVICE_ROLE_KEY | Clave legacy `service_role`, solo servidor |

5. Pulsa **Deploy**. Entra con tu cuenta. En **Usuarios**, crea las credenciales de tu equipo. En **Por revisar**, confirma los datos pendientes.

Build y salida incluidos en `vercel.json`: `npm run build` y `dist`. Si cambias variables públicas, vuelve a desplegar. No uses la clave `service_role` en ninguna variable `VITE_`: se conserva únicamente en `/api/users`.

## Verlo en tu equipo

Se añadió un login de prueba local para Yadira. La contraseña se valida mediante un hash en `.local-access.json`, excluido de Git y de la web publicada. El servidor escucha únicamente en tu equipo. Este acceso carga el inventario importado y permite explorar fichas y movimientos; los cambios son temporales y no reemplazan el login ni el almacenamiento de Supabase. Las credenciales locales no se incluyen en el ZIP.

## Relación con euroalpaca.com

El 13/10/2026 se verificó el catálogo en el Chrome conectado. Muestra Kinti, Munay, Sumaq, Illa, Qori, Killa, Suyay, Aruma, Kuyay, Ayni y Allin. El sistema puede gestionar esos modelos con códigos, variantes y composiciones. Publica el sistema por separado en `inventario.euroalpaca.com` agregando ese subdominio al proyecto Vercel y configurando el DNS indicado allí. El catálogo actual no consume automáticamente la base: esa integración requiere modificar su código y definir qué disponibilidad mostrar públicamente, sin exponer inventario interno ni credenciales.

Desde PowerShell:

```powershell
cd C:\Users\YADIRA\Downloads\euroalpaca-inventario
npm.cmd run dev
```

Abre `http://127.0.0.1:4173` y pulsa **Explorar demostración**. Funciona sin instalar paquetes. Muestra datos de ejemplo; los cambios se pierden al salir. Para una prueba local con Supabase, genera `dist` con ambas variables públicas configuradas y ejecuta `npm.cmd run preview`. La administración de usuarios utiliza la función de Vercel: probar en un deployment Preview de Vercel.

## Inventario preparado

Fuente: **INVENTARIO PRENDAS.xlsx**, leído mediante Google Drive el 13/10/2026, y archivos relacionados de Descargas. Se preservan las tres secciones. Los datos privados no se publican dentro de la web ni en la demostración.

- 226 filas, 44 códigos de modelo provisionales, 396 unidades conocidas antes de revisar duplicados.
- Ubicaciones: Muestras / revisión (74), Lima (140) y España (182). Se infieren de los archivos locales; confirmarlas antes de operar.
- 2 cantidades desconocidas se mantienen como NULL, no como cero.
- 116 filas marcadas para revisión por datos faltantes, títulos de hilo interpretados como fechas o combinaciones repetidas. No se consolidaron ni eliminaron filas automáticamente.
- `data/revision.json` detalla alertas y `data/inventory.json` conserva fichas normalizadas. `data/source.csv` conserva la lectura del conector, no los formatos ni imágenes de Excel.
- Códigos agrupados por nombre y tipo de prenda. Los nombres parecidos no se fusionan. Puede ser necesario unificar nombres/códigos después de validarlos.
- SKU: código de modelo, material, color, talla y referencia a la fila original. Los nuevos SKU los administra la administradora.
- Reejecutar `seed.sql` no sobreescribe registros ni movimientos existentes.

## Uso diario

Busca la prenda y abre su ficha. **Entrada** suma, **Salida** resta, **Ajuste** establece la cantidad final contada (solo administradora). Una cantidad desconocida exige un ajuste inicial. Para trasladar, crea primero la misma variante en la ubicación destino con stock cero; ambas existencias se actualizan en una transacción.

Google es el origen de importación. El sistema guarda cambios en Supabase y no sincroniza automáticamente la hoja. Exporta CSV para abrir en Google Sheets. Los CSV importan variantes nuevas con stock cero y requieren un ajuste inicial.

Realtime actualiza existencias entre sesiones, con consulta cada 15 segundos como respaldo. El historial muestra los últimos 250 movimientos; todos se conservan en la base. Cambios de fichas registrados en `audit_log`, consultable por administradora desde Supabase.

## Seguridad y validación

RLS y permisos por columna verifican roles en la base. Consulta no escribe; operadora ejecuta movimientos. Stock sin actualizaciones directas desde navegador. Funciones con transacciones y bloqueos de filas para evitar stock negativo concurrente. Un ID de solicitud evita repetir movimientos por reintentos. Administrar usuarios exige una sesión activa de administradora verificada por el servidor.

`npm.cmd test` verifica reglas, CSV, acceso API e importación. `npm.cmd run build` empaqueta. Se verificó en Chrome el login local, las 226 filas, búsqueda y ficha de SUYAY, y la visualización del resumen. Las rutas privadas locales devolvieron 401 sin sesión y los archivos de inventario y credenciales no se sirven públicamente. Falta probar login de producción, RLS, concurrencia y Realtime contra tu Supabase real: no se proporcionaron credenciales ni un proyecto conectado.

## Tecnologías y referencias

HTML, CSS, JavaScript modular, Node.js, funciones Vercel y Supabase Auth/PostgreSQL/Realtime. Sin dependencias de paquetes. Foto NINA desde tus archivos; Google Fonts con fuentes de sistema como respaldo.

Referencias oficiales: [seguridad RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Realtime](https://supabase.com/docs/guides/realtime/protocol), [build de Vercel](https://vercel.com/docs/builds/configure-a-build).
