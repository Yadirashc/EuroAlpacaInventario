# Carga manual de fotografías — 23/10/2026

Se retiraron de la carga manual la casilla de autorización de uso y el campo de referencia de autorización/autoría. La administradora puede subir fotografías directamente, incluyendo JXL. Al asociar una imagen a un color se mantiene la comprobación de que corresponde al proveedor, hilo y color seleccionado.

La API admite cargas manuales sin esos campos. Registra una nota que identifica la carga manual y expresa que no se solicitó una declaración de autorización. Los campos heredados necesarios para las políticas de visibilidad de la base se completan por compatibilidad; no se solicita una nueva afirmación de derechos a la usuaria. Al editar una fotografía se conserva la referencia anterior si existe. No hay migración ni cambios de inventario.

Validación: 57 pruebas automatizadas, compilación y prueba en Chrome headless de la carga desde una ficha de color hasta ver la fotografía, sin casilla ni campo de autorización. Las descargas automáticas desde proveedores conservan su configuración independiente.
