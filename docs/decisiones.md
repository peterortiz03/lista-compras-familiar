# Decisiones del proyecto

## Entrega 6: catálogo, corrección de compras y preparación de publicación

- Las vistas Lista, Catálogo e Historial separan las tareas sin router ni dependencias nuevas. Catálogo significa productos conocidos; no representa stock disponible.
- Todos los integrantes pueden crear, renombrar, quitar y recuperar productos. Crear no agrega un pendiente. Se conserva la unidad elegida originalmente para evitar conversiones ambiguas en referencias existentes.
- Quitar es un archivado reversible (`active = false`). Retira el producto de las sugerencias, conservando pendientes e historial. Un nombre archivado sigue reservado: se puede recuperar, no duplicar. Volver a agregar explícitamente un faltante con ese nombre también lo reactiva.
- Los cambios de catálogo usan una revisión UUID para rechazar ediciones obsoletas. La importación conserva el estado activo/inactivo de los productos locales.
- Revertir una compra devuelve su cantidad al pendiente actual, o lo recrea si no existe. No supera 9999 ni convierte unidades. Se marca fecha y autor de reversión, y se oculta del historial habitual; el registro queda consultable. Repetir la reversión no vuelve a sumar.
- Cada integrante puede revertir sus compras; la persona responsable puede revertir cualquiera de su familia. Se controla tanto en interfaz como en PostgreSQL. No hay borrado irreversible ni edición arbitraria del historial.
- La migración 0003 conserva las operaciones anteriores como función privada sin permiso de ejecución para usuarios, y añade un punto de entrada público controlado que mantiene bloqueos, validación e idempotencia. La lectura declara versión 3 para detectar una base aún sin actualizar.
- Los archivos locales previos siguen siendo compatibles: `active` ausente significa activo y `revertedAt` ausente significa compra vigente. La lectura remota exige el esquema nuevo.
- Se verificaron diecinueve pruebas Node, las tres migraciones y tres suites SQL, más el recorrido en Chrome con dos identidades simuladas y PostgreSQL temporal. Se revisaron autor, responsable, integrante no autorizado, otra familia, reversión completa/parcial, repetición y límites.
- Se prepara Vercel mediante `vercel.json` y una guía con variables públicas, redirecciones Auth, pruebas y próximos despliegues. Como todavía no hay cuenta Vercel, no se crea ni se publica un proyecto. No se cambia ningún plan ni se contratan servicios. Los costos y límites se verificaron en documentación oficial al preparar la guía.



## Entrega 5: compras familiares compartidas

- Se conserva la copia local y se agrega una lista remota por familia; nunca se mezclan automáticamente. La sesión y la familia seleccionan un componente nuevo con clave de usuario y familia para descartar datos y formularios del contexto anterior.
- `useShoppingData` reúne carga, confirmación de cambios y guardado local. `ShoppingWorkspace` coordina la interfaz. Las funciones locales de compras siguen siendo puras y se usan sin conexión a Supabase en modo local.
- Sincronización mediante consultas periódicas cada tres segundos en pestañas visibles, además de foco, reconexión y confirmación de escrituras. No se introduce Realtime: para este volumen evita suscripciones y configuración adicional. No se promete actualización instantánea ni edición offline.
- `get_family_shopping` devuelve una instantánea consistente en una consulta SQL, con RLS. `mutate_shopping` deriva usuario y familia de la sesión y ejecuta las escrituras controladas. No se concedieron permisos de escritura directa al cliente.
- Las operaciones se serializan con un bloqueo de la fila familiar. Los pendientes tienen una versión UUID; editar, quitar o comprar requiere la versión observada. El formulario conserva la versión de apertura, aunque la pantalla reciba actualizaciones. Ante conflicto debe cerrarse y revisarse.
- Cada solicitud tiene un UUID y un resultado privado persistido por familia. Repetir la misma solicitud del mismo usuario devuelve el resultado anterior. No se cambian datos optimistamente ni se reintentan automáticamente acciones nuevas a ciegas.
- La compra reduce o retira el pendiente y registra autor, fecha y cantidad en la misma transacción. PostgreSQL usa decimal exacto; se rechazan más de tres decimales antes de almacenar y fracciones de unidades/paquetes.
- La importación copia solo catálogo y pendientes a una familia vacía, una vez, hasta 500 productos y con confirmación. No importa el historial sin autor verificable ni modifica la copia local. El servidor valida nuevamente todos los datos.
- Las respuestas de lecturas viejas se descartan; se cancelan al cambiar de contexto o iniciar una escritura. Si falla la sincronización se conserva la última instantánea confirmada y se deshabilita la edición hasta recuperar la conexión.
- Verificación: dieciséis pruebas Node, dos migraciones y ambas suites SQL en PostgreSQL temporal. En Chrome con identidades simuladas y ese PostgreSQL se probaron dos cuentas, actualización, duplicados, conflictos, pérdida de confirmación, recuperación e importación, sin desbordes a 320, 390 y 1440 px.
- El usuario confirmó las pruebas reales de cuentas y la instalación de 0002. Se verificó en la API real que la nueva función existe y rechaza solicitudes sin sesión. No se accedió a sus sesiones ni se escribieron compras de prueba en su proyecto.
- La revisión integral con usuarios reales queda como próximo paso. PWA y publicación siguen fuera de esta entrega.



## Entrega 4: cuentas y familias (integración preparada)

- Se usa el cliente oficial `@supabase/supabase-js`. Sin URL y clave pública válidas se mantiene el modo local. `.env.example` declara los valores; los archivos privados de entorno siguen excluidos de Git.
- Autenticación por correo y contraseña, recuperación de sesión y cierre de sesión en este navegador. Supabase gestiona las contraseñas y los tokens; nuestra aplicación no crea una tabla de contraseñas.
- Una familia por usuario. Quien la crea queda como responsable; cada integrante define su nombre visible. No se incluyen expulsiones, transferencias, salida de familia ni recuperación de contraseñas todavía.
- Las invitaciones son UUID aleatorios de un solo uso y vencen en siete días. Solo la persona responsable puede generarlas; una nueva reemplaza la anterior. La base bloquea la invitación durante su consumo y serializa altas por usuario para evitar membresías duplicadas.
- Familias e integrantes se consultan con RLS. Una función privada obtiene la familia de la sesión evitando políticas recursivas. Las escrituras de membresías solo se permiten mediante RPC con identidad verificada y `search_path` vacío.
- Las tablas de productos, pendientes e historial se preparan con claves foráneas por familia y restricciones de cantidades. Su lectura está protegida por RLS; la escritura desde el cliente permanece cerrada hasta implementar operaciones de compras transaccionales en la siguiente etapa.
- La unidad del pendiente participa en una clave foránea con el producto para validar enteros en unidades/paquetes sin consultar otra tabla desde un CHECK. El historial conserva nombre y unidad del momento de compra y agrega el autor.
- El panel de cuentas se mantiene independiente de la lista local. No se importa nada automáticamente ni se presenta el guardado local como información protegida por la cuenta. Cambiar de usuario desmonta el panel familiar para descartar datos de la sesión anterior.
- Verificado: compilación, lint, trece pruebas existentes y pruebas SQL en PostgreSQL temporal con `auth.uid()` simulado. La configuración real de Supabase, los correos y la prueba integral con sus usuarios quedan pendientes de crear el proyecto. La guía de configuración incluye esos pasos.
- El recorrido de cuentas se verificó en Chrome con respuestas HTTP simuladas, incluida recuperación de sesión, cierre, creación e incorporación familiar y anchos de 320, 390 y 1440 px. El motor PostgreSQL y el servidor de prueba fueron temporales y no se agregaron al proyecto ni a sus dependencias.



## Entrega 3: guardado local

- Se conserva el estado completo en `localStorage`, sin dependencias nuevas. React mantiene el estado activo; al cambiarlo, un efecto guarda una copia JSON. Solo se persisten los datos de negocio, no los filtros, mensajes ni formularios abiertos.
- La clave `en-casa:shopping:v1` contiene `{ version: 1, state }`. Se valida la estructura, las unidades, cantidades, identificadores, referencias y fechas al recuperarla. Una lista vacía guardada es válida y no se reemplaza con ejemplos.
- Si falla la lectura o el formato es desconocido, mostramos ejemplos en memoria y un aviso; no sobrescribimos el contenido existente. Si falla la escritura, avisamos que los últimos cambios no están guardados. No hay migraciones automáticas ni borrado silencioso.
- El alcance es un navegador y origen, con una sola pestaña de edición. No implementamos sincronización entre pestañas ni dispositivos. Borrar datos del sitio o cerrar un perfil privado puede eliminar esta copia; no es un respaldo.
- Se agregaron cuatro pruebas de persistencia y validación; ahora hay trece pruebas. Se mantiene la separación entre lógica de compras y acceso al navegador en `src/lib/storage.ts`.
- Verificado en Chrome con un perfil aislado: alta y compra parcial conservadas al recargar y volver a abrir; datos dañados sin sobrescritura; aviso visible al simular escritura bloqueada. Compilación, lint y trece pruebas correctos.
- Estas decisiones reemplazan las limitaciones de memoria temporal descritas para las entregas anteriores. El próximo paso es cuentas y familias con Supabase; después sincronización y revisión integral del MVP.


## Entrega 2: compras parciales e historial

- La compra ahora se confirma en una ventana nativa, indicando una cantidad positiva hasta el total pendiente. Se puede cancelar con el botón o Escape.
- `recordPurchase` reduce el pendiente y crea el registro en una única actualización. Las compras completas también generan historial; eliminar un pendiente no lo hace.
- Restamos en milésimas enteras para evitar residuos de coma flotante.
- El historial conserva nombre, unidad, cantidad, identificador y fecha ISO; se muestra con fecha y hora local, de más reciente a más antiguo.
- Todo sigue en memoria y se pierde al recargar. Sin dependencias nuevas, cuentas, servicios ni despliegue.
- Se agregaron tres pruebas de lógica: compra parcial decimal, compra completa y conservación del historial, y rechazo de compras inválidas. Ahora hay nueve pruebas.
- Próximo paso sugerido: persistencia local, seguida de cuentas y acceso familiar con Supabase.

Las decisiones de la primera entrega que siguen documentan la base inicial; la segunda entrega reemplaza el comportamiento de compra y agrega el historial.

## Entrega 1: lista local en memoria

- **Alcance:** agregar, buscar, editar cantidades, eliminar pendientes y marcar compras completas. Sin compras parciales, historial, autenticación, persistencia, sincronización ni despliegue.
- **La lista es permanente como concepto del producto.** Esta implementación es temporal: al recargar se reinicia. Un aviso visible explica esta limitación.
- **Catálogo y pendientes son datos distintos.** El catálogo guarda nombre y unidad; un pendiente referencia al producto por identificador y agrega la cantidad. Comprar o eliminar retira el pendiente, conservando el producto para futuras sugerencias. No modelamos stock.
- **Productos equivalentes:** se comparan los nombres quitando tildes, normalizando mayúsculas y espacios. Conservamos el nombre legible. No se detectan sinónimos: `Papa` y `Papas` son productos diferentes.
- **Duplicados:** un producto solo puede estar pendiente una vez, aunque se escriba de otra manera. Se avisa y se ofrece editar la cantidad existente. No se suman cantidades automáticamente.
- **Cantidades:** mayores que cero y hasta 9999; enteras para unidades y paquetes, hasta tres decimales para kilos y litros. Es un límite práctico de esta entrega, ajustable si aparece una necesidad real. Se admite coma o punto decimal y se muestra formato argentino.
- **Unidad por producto:** un producto del catálogo conserva su unidad al volver a agregarlo. No hay conversiones ni edición de nombres o unidades en esta entrega. Para corregir cantidades se usa el mismo formulario en modo edición.
- **Compra completa:** quita el pendiente y muestra una confirmación. No guarda un registro de compra todavía. Eliminar quita el pendiente sin considerarlo comprado. La futura etapa de historial distinguirá ambos eventos también en los datos.

## Herramientas y estructura

- Se utilizó la plantilla oficial **React + TypeScript de Vite**, con versiones estables al inicializar la entrega. `package-lock.json` fija las versiones instaladas para reproducir el entorno.
- TypeScript se configura en modo estricto. Los tipos ayudan durante el desarrollo; la validación de formularios y funciones controla los valores reales.
- **Tailwind CSS 4** usa el plugin oficial `@tailwindcss/vite` y `@import "tailwindcss"`. Los colores y estilos comunes viven en `src/index.css`. No hace falta una configuración de Tailwind 3 ni PostCSS adicional. Referencia: [instalación oficial con Vite](https://tailwindcss.com/docs/installation/using-vite).
- Se mantuvo **Oxlint**, la comprobación básica de código de la plantilla utilizada. No se añadió otra herramienta de lint.
- No se incorporó shadcn/ui: los controles HTML nativos cubren esta entrega sin sumar dependencias. Tampoco hacen falta router, estado global externo ni bibliotecas de íconos.
- `App` posee el estado. La interfaz se divide en lista, formulario e íconos. Las operaciones de datos son funciones puras en `src/lib/shopping.ts`, sin conocer React ni el navegador.
- Cada producto nuevo recibe un identificador con `crypto.randomUUID()`, disponible en navegadores modernos en `localhost` y contextos seguros. No se utiliza el nombre como identificador.
- Los ejemplos se crean mediante una función para empezar con un estado nuevo. No hay `localStorage`, cookies de sesión ni llamadas a servicios de negocio.
- Los íconos SVG y las fuentes del sistema evitan recursos externos. El diseño usa fondo cálido, verde como acción principal, controles de al menos 44 px y una columna en celulares.
- Se requieren **Node 22.18 o superior** para ejecutar directamente las pruebas TypeScript con Node, además de satisfacer los [requisitos de Vite](https://vite.dev/guide/). No se necesita instalar TypeScript globalmente.

## Verificación

- Compilación con TypeScript y Vite, más lint.
- Seis pruebas de lógica con `node:test`: alta, duplicados, cantidades inválidas, edición, conservación del catálogo y nombres inválidos. Sin framework adicional.
- Se comprobó el recorrido de operaciones en Chrome: sugerencias, coma decimal, duplicados y edición desde el aviso, cantidades inválidas, eliminación, compra, búsqueda, estado vacío y reinicio al recargar, sin excepciones de JavaScript. Se inspeccionaron capturas de escritorio y celular, y no hubo desbordes a 320, 390 y 768 px.
- El README incluye un recorrido visual para comprobar las acciones y estados vacíos. La guía de aprendizaje explica el flujo de datos y los archivos principales.

## Siguiente etapa sugerida

Modelar una compra como evento: producto, cantidad comprada y momento. Una compra parcial reduciría el pendiente y produciría un registro; una completa lo retiraría y también produciría un registro. Primero en memoria, para entender y validar las reglas antes de conectar PostgreSQL, Auth y sincronización familiar. La persistencia y la autorización por familia deberán diseñarse antes de compartir datos reales.
