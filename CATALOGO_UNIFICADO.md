# Catálogo textil unificado — 23/10/2026

Las correcciones de Yadira definen seis familias de material y siete referencias comerciales:

| Proveedor | Nombre comercial | Material | Composición |
| --- | --- | --- | --- |
| INCA TOPS | MUHU | Baby alpaca | 100% Baby alpaca |
| INCA TOPS | KORI | Royal Alpaca | 100% Royal alpaca |
| INCA TOPS | Majestic | Majestic / Imperial Alpaca | 100% Imperial alpaca |
| ITESSA | CANCAS | Baby alpaca + algodón | 15% baby alpaca + 85% algodón Tangüis |
| ITESSA | BABY ALPACA | Baby alpaca | 100% Baby alpaca |
| ITESSA | BABY MICROFIBRA | Baby alpaca + microfibra | 30% baby alpaca + 70% microfibra |
| ITESSA | Eco baby PET | Baby alpaca + PET | 30% baby alpaca + 70% PET |

**KORI pertenece a INCA TOPS**, conforme a la última corrección. Eco baby PET conserva su composición y queda como sexta familia de material. Baby alpaca incluye dos referencias comerciales, MUHU e ITESSA.

Panel textil, Carta de colores, Hilos y almacén e inventario usan una clasificación común. Panel y bibliotecas se agrupan por proveedor. El Panel reúne los siete hilos; cada ficha reúne sus colores y sus títulos técnicos. Los títulos distintos se conservan, por ejemplo 18/2 y 2/28, sin equiparar sus características.

Las variantes repetidas de un color se agrupan por referencia comercial, proveedor, título y código normalizado; se reconocen prefijos originales de ITESSA. Editar una ficha de color actualiza sus alias. Cambiar la referencia del hilo aplica el proveedor y composición correctos y lo reagrupa en las secciones relacionadas. El formulario de hilo utiliza las siete referencias comerciales del catálogo.

Los registros originales permanecen vinculados a fotografías, conteos, requerimientos e historial. Los conteos de kg no se suman automáticamente cuando hay varios conteos para una referencia repetida; quedan pendientes de confirmación para evitar duplicaciones. La unificación no altera cantidades de prendas ni kg de almacén.

La normalización persistente guarda un respaldo privado en `textile_sync_runs` antes de actualizar proveedores, hilos o metadatos fotográficos. Conserva todos los ID y comprueba las huellas de inventario y stock antes y después. Si cambia el proveedor de un hilo, su disponibilidad comercial vuelve a pendiente. Las fotografías de una fuente oficial que no coincida con el proveedor corregido quedan para revisión, conservando su archivo y procedencia.

La ejecución de normalización es idempotente, utiliza la conexión de servidor existente y se identifica como **Catálogo textil unificado v1.1 — 2026-10-23**. No incorpora credenciales al cliente ni al repositorio.

Validación: pruebas de catálogo, KORI/INCA TOPS, PET separado de microfibra, conservación de títulos e ID, agrupación de códigos, respaldo e idempotencia; además, recorridos aislados en Chrome de edición de colores, proveedor/referencia, fotos, almacén, inventario y vista móvil.
