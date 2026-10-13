# EUROALPACA · Gestión de inventario

Aplicación web para gestionar modelos, variantes, fichas técnicas, existencias, movimientos y permisos. Diseño alineado con el catálogo de euroalpaca.com. Backend Supabase Auth/PostgreSQL/Realtime y despliegue Vercel. HTML/CSS/JavaScript modular, sin dependencias de runtime.

Consulta [LEEME.md](LEEME.md) para configurar Supabase y Vercel.

```sh
npm ci
npm run build
npm test
npm run dev
```

Demostración: http://127.0.0.1:4173. Las cuentas reales se crean en Supabase y desde el panel de administradora; no hay credenciales de producción en el código.

Los datos del Excel, la importación SQL y las credenciales locales están excluidos de este repositorio público. El inventario completo se carga directamente en la base privada de Supabase, accesible solo con sesión y permisos. Las pruebas usan datos ficticios; la prueba de conciliación privada se omite en checkouts sin datos.

El sitio público actual no se modifica ni se sincroniza automáticamente: el sistema puede alojarse en un subdominio independiente como inventario.euroalpaca.com.
