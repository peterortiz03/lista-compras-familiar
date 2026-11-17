# Lista familiar compartida — quinta entrega

## Activación

Si ya configuraste cuentas y familias con la guía anterior:

1. Abrí SQL Editor del **mismo proyecto Supabase** y ejecutá completo [`0002_shared_shopping.sql`](../supabase/migrations/0002_shared_shopping.sql), una sola vez. No repitas 0001 ni borres tablas. La migración agrega funciones y versiones de pendientes; no importa datos ni cambia integrantes.
2. Opcionalmente ejecutá completo [`supabase/tests/shared_shopping.sql`](../supabase/tests/shared_shopping.sql) como administrador. Usa usuarios ficticios y termina con `ROLLBACK`; si da un error, ejecutá `ROLLBACK;` antes de investigar. No reemplaza las pruebas con cuentas reales.
3. Reiniciá Vite: `npm.cmd run dev`. Usá la URL que configuraste en Auth y las mismas variables de `.env.local`.
4. Ingresá con una cuenta que pertenezca a una familia. Debe aparecer **Lista compartida · nombre de tu familia**. Una familia nueva empieza vacía; los ejemplos anteriores pertenecen a la copia local.

Si falta aplicar la migración, aparecerá un aviso que la identifica y las operaciones familiares estarán deshabilitadas. No desactives RLS para solucionar errores.

## Qué se comparte

Catálogo, pendientes, cantidades e historial se guardan en PostgreSQL. Las compras incluyen la persona que las registró. El nombre de la familia determina la lista mostrada; los identificadores de usuario y familia se obtienen de la sesión en el servidor, no de los campos del formulario.

La aplicación consulta una instantánea completa aproximadamente cada **3 segundos mientras la pestaña está visible**, al recuperar foco o conexión y después de una operación. No usa Supabase Realtime ni requiere habilitar publicaciones. Puede haber demora adicional por la red o por restricciones del navegador; el botón **Actualizar lista** permite solicitar la actualización manualmente.

Sin sesión o sin familia cargada se muestra la copia local con una etiqueta explícita. No se mezcla con la familiar. Al cambiar de cuenta o familia se descartan formularios, datos y solicitudes pendientes de la pantalla anterior. Esto no cancela una transacción que el servidor ya haya recibido: si cerraste la página durante una operación, revisá el historial al volver.

## Importar lo anterior

Cuando el catálogo familiar está vacío aparece **Importar catálogo y pendientes locales**. La aplicación pide confirmación y copia esos datos, como máximo 500 productos. Solo puede hacerse una vez por familia y si todavía no hay catálogo ni compras compartidas. Un integrante que ya tenga la copia local deseada debe realizarla desde ese navegador y dirección.

El historial anterior **no se importa**, porque carece de un autor autenticado verificable. El catálogo, los pendientes y el historial locales originales se conservan íntegros. Cerrar sesión permite volver a esa copia; la importación no crea una sincronización entre las dos listas. Si no querés los ejemplos iniciales en tu lista familiar, agregá productos manualmente en vez de importarlos.

## Conflictos y errores de red

- Cada pendiente tiene una versión nueva después de cambiar su cantidad o comprar una parte. Editar, eliminar o comprar requiere la versión que se mostró al iniciar la acción. Si otro integrante cambió el pendiente, el servidor rechaza la acción. Cerrá el formulario o la compra, revisá la cantidad actualizada y abrilo de nuevo.
- Agregar un producto ya pendiente devuelve el producto existente y ofrece editarlo; no suma cantidades ni crea otra fila. La regla también se aplica si dos personas lo agregan a la vez.
- Comprar reduce o retira el pendiente y crea el historial en una transacción. Eliminar un pendiente no registra una compra.
- Cada operación remota lleva un identificador. Repetir exactamente esa solicitud devuelve su resultado anterior, sin ejecutar otra compra. Se conserva para reintentos de la misma acción durante esa pantalla.
- No se presenta una escritura como exitosa antes de la confirmación del servidor. Si falla la lectura, se conservan los últimos datos confirmados y se deshabilitan las operaciones hasta recuperar la conexión. No hay cola de escrituras sin conexión.
- Si falla la red después de que el servidor guardó una operación, podría no llegar su confirmación. Actualizá y revisá la lista/historial antes de realizar una acción distinta o recargar. Reintentar la misma solicitud es seguro; una acción nueva sobre una cantidad revisada representa otra compra.

## Recorrido con dos cuentas

1. Usá dos perfiles de navegador con cuentas de la misma familia. En ambos debe aparecer el mismo nombre de familia.
2. Agregá Huevos con 5 unidades desde A. En B deben aparecer en unos segundos sin recargar.
3. Desde B intentá agregar `HUEVOS`: debe avisar el duplicado sin sumar.
4. Comprá 3 desde A. En B deben quedar 2 pendientes y aparecer la compra con el nombre de A.
5. Abrí una compra en A. Desde B cambiá la cantidad pendiente y guardá. Confirmá la ventana antigua en A: debe avisar que el pendiente cambió, sin crear otra compra. Cerrá y volvé a abrirla.
6. Comprá el resto y comprobá el retiro del pendiente y el historial en ambas cuentas. Volvé a agregar el producto y luego eliminalo: el historial no debe crecer al eliminar.
7. Recargá ambas ventanas. Los datos familiares deben conservarse.
8. Cerrá sesión en una ventana: se verá su copia local. Ingresá con una cuenta de otra familia: no debe ver las compras anteriores.
9. Para simular una caída, desconectá temporalmente la red o usá el modo offline de las herramientas del navegador. Debe aparecer un aviso al actualizar. Recuperá la conexión y tocá **Actualizar lista**. Los cambios familiares confirmados deben seguir presentes.

## Verificación de esta entrega

Se ejecutaron compilación, lint y dieciséis pruebas de lógica. En PostgreSQL temporal se probaron las dos migraciones, las reglas de cuentas y las operaciones compartidas, incluyendo versiones antiguas, reintentos, cantidades decimales, autorización e importación. El bloqueo por familia utiliza los mecanismos de PostgreSQL; la prueba local no es una prueba de carga con múltiples conexiones.

En Chrome, dos cuentas aisladas usaron un servidor local conectado a ese PostgreSQL temporal: actualización automática, compras parciales con autor, conflicto, pérdida de respuesta después de guardar, recuperación de red, cambio de familia e importación. No hubo excepciones ni desbordes a 320, 390 y 1440 px.

El usuario confirmó la prueba real de cuentas de la etapa anterior y la aplicación de 0002. Desde este entorno se verificó que la API real reconoce la función nueva y rechaza consultas sin sesión. No hubo acceso a las sesiones reales del usuario ni se crearon cuentas o compras en su proyecto.

## Límites y siguiente paso

La pantalla recupera el catálogo y el historial completos: es suficiente para esta aplicación inicial; paginación y retención de solicitudes se revisarán si crece el volumen. Siguen pendientes la revisión integral del MVP con usuarios reales, recuperación de contraseña y ajustes que surjan de ese uso. Después: publicación y PWA. El servidor local continúa siendo necesario hasta publicar; el guardado compartido no instala la aplicación ni habilita edición offline.
