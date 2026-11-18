# Historial por períodos y biblioteca argentina

La actualización compacta la lista, abre la cuenta con un toque, muestra búsqueda y productos primero en el catálogo y mejora las sugerencias y miniaturas. También agrega historial por días y selección de 60 fichas de biblioteca. En el proyecto compartido ya se comprobó que la migración 0008 está aplicada. Para probar la actualización, seguí la sección de prueba con una familia.

## Activación en otro proyecto

1. En el proyecto Supabase que ya tiene 0007, abrir SQL Editor y ejecutar una vez el archivo completo [0008_history_and_library.sql](../supabase/migrations/0008_history_and_library.sql). En una instalación nueva, ejecutar las migraciones en orden. Ante un error, guardar el mensaje y revisar antes de publicar.
2. Comprobar que existan las funciones `get_family_list(uuid)` y `get_family_purchase_period(date,date,timestamptz,uuid)` y la columna `products.library_id`. La migración conserva los datos y el endpoint anterior. Agrega un índice de compras por familia/fecha/ID, una revisión de compras y una operación de biblioteca. Las fotos, las políticas familiares y el trabajo de limpieza siguen disponibles.
3. Publicar el frontend después de verificar la migración. Vercel recibe la versión al subir a `main`. Verificar el despliegue antes de probar.

## Prueba con una familia de prueba

- Abrí **Historial**. Debe mostrar solo los últimos tres días de Buenos Aires. Usá **Cargar períodos anteriores** para consultar compras viejas, incluso cuando falten semanas enteras. Activá el filtro de revertidas y probá revertir una compra parcial. La cantidad vuelve al pendiente y el evento sigue disponible con el filtro.
- Abrí **Catálogo → Explorar biblioteca**. Seleccioná fichas en distintos filtros, buscá **kabutia** y verificá que la selección se mantenga. Agregá varias y revisá el resumen. Confirmá que el total de pendientes quede igual.
- Repetí desde otra cuenta familiar. Una ficha que ya existe queda identificada y conserva unidad, foto y categoría. Una ficha quitada se recupera al seleccionarla explícitamente. Las 60 fichas usan íconos, sin fotografías predeterminadas en esta entrega.
- En celular, probá el foco y teclado virtual al agregar, crear y editar. Probá desconexión, reconexión y dos integrantes actualizando la misma familia. Verificá que la foto conserve el ícono hasta cargar y que los controles sigan siendo legibles.

## Verificaciones locales

- Compilación, lint y 30 pruebas Node.
- Migraciones 0001–0008 y suites SQL en PostgreSQL temporal con Storage simulado. Incluye medianoche, cursor con 102 compras de fecha idéntica, frecuencia histórica, reversión, importación repetida por dos integrantes, recuperación explícita, datos existentes y aislamiento. El bloqueo de familia y los índices únicos protegen la concurrencia. Las pruebas ejecutaron las dos cuentas en secuencia.
- Chrome a 320, 375, 430 y 1440 px con datos locales ficticios. Incluye foco, cuenta, nueve coincidencias y Escape, 60 fichas, selección entre búsquedas, importación sin pendientes e historial con filtro de revertidas. Quedan cámara, teclado virtual y pruebas de aceptación en teléfonos físicos y dos sesiones reales.
