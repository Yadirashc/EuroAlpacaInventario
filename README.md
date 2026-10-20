# EUROALPACA · Gestión de inventario

Aplicación web para gestionar modelos, variantes, fichas técnicas, existencias, movimientos y permisos. Fuente de inventario: el Excel de Google Drive proporcionado por Yadira. Backend Supabase Auth/PostgreSQL/Realtime y despliegue Vercel. HTML/CSS/JavaScript modular, con Sharp para imágenes y ExcelJS para importar catálogos.

La rama de prueba añade cartas de colores, proveedores, hilos, stock en kg, requerimientos, fotografías privadas e importación Excel/CSV. Instrucciones y límites de las integraciones: [GESTION_TEXTIL.md](GESTION_TEXTIL.md). La ampliación requiere revisión antes de publicarse en producción.

Web publicada: https://euroalpaca-inventario.vercel.app. Consulta [MODO_EDICION.md](MODO_EDICION.md) para la vista fiel al Excel y edición de cantidades; [DEPLOYMENT.md](DEPLOYMENT.md) describe el despliegue y [LEEME.md](LEEME.md) la instalación en un proyecto nuevo.

La ampliación **Gestión de Clientes y Envíos** añade las cinco pestañas de clientes, envíos, lotes e historial, además de **Ubicación y trazabilidad**, documentos privados y reportes Excel/PDF. Consulta [CLIENTES_ENVIOS.md](CLIENTES_ENVIOS.md) para revisar la versión local, aplicar las migraciones y entender el flujo de despacho/recepción. La versión oficial no cambia automáticamente.

```sh
npm ci
npm run build
npm test
npm run dev
```

Demostración: http://127.0.0.1:4173. Las cuentas reales se crean en Supabase y desde el panel de administradora; no hay credenciales de producción en el código.

Los datos del Excel, la importación SQL y las credenciales locales están excluidos de este repositorio público. El inventario completo se carga directamente en la base privada de Supabase, accesible solo con sesión y permisos. Las pruebas usan datos ficticios; la prueba de conciliación privada se omite en checkouts sin datos.

El sitio público actual no se modifica ni se sincroniza automáticamente: el sistema puede alojarse en un subdominio independiente como inventario.euroalpaca.com.

