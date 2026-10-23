# Ajustes de Hilos y almacén — 23/10/2026

En **Hilos y almacén → Colores y ajustes**, la ficha reúne:

- Datos del hilo: proveedor asignado, nombre, material, composición, título, referencia, colección y características técnicas.
- Agregar colores con el hilo seleccionado previamente y opción **Guardar y subir foto**.
- Tabla por color con fotografía ampliable, código, familia, stock y disponibilidad del proveedor.
- Accesos para editar cada color, subir su fotografía, consultar su ficha y ajustar los kilos en almacén.
- Edición del proveedor y creación de proveedores desde Hilos y almacén.

Las fotografías reutilizan la carga privada existente, incluidos JXL y el límite de 3 MB, sin formulario de autorización de uso. Las fotografías verificadas se pueden ampliar. Los cambios de identidad técnica pueden hacer que una fotografía anterior necesite revisión.

La asignación de proveedor del hilo ya es editable. El nombre, web, catálogo y notas de un proveedor se editan sobre su registro compartido. Los códigos internos de proveedores existentes permanecen estables. Las referencias duplicadas se rechazan al crear y editar.

Sin migraciones ni cambios de prendas. La escritura utiliza las tablas y políticas de administración existentes; los controles de edición se muestran solo a la administradora.

Validación: 57 pruebas automatizadas, compilación y recorrido de Chrome headless (`node tests/yarn-management-browser.mjs`): crear color con foto, editar color y stock, editar/cambiar proveedor, material y composición, crear proveedor e hilo, ficha vacía y vista móvil. Las pruebas de navegador trabajan sobre datos aislados y comprueban que el archivo de inventario permanece intacto.
