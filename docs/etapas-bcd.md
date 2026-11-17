# Actualización B–D

El usuario confirmó la ejecución de 0004 y 0005 en Supabase y autorizó commit, push y publicación. B, C y D están implementadas y probadas localmente. No se modificaron las migraciones anteriores ni se conectaron las pruebas a producción. No repitas las migraciones.

## B: favoritos, sugerencias y compartir

En Catálogo, la estrella marca un favorito manual compartido. Quitar el favorito no quita el producto. Las sugerencias muestran hasta cinco productos activos: coincidencia exacta y comienzo del nombre al buscar, favoritos manuales, frecuencia de compras no revertidas y recencia de compras/incorporaciones. Cada producto aparece una sola vez. Los favoritos se distinguen con estrella; la frecuencia no los marca automáticamente.

El formulario conserva el agregado consecutivo, limpia los detalles después de guardar y devuelve el foco al nombre. No se agregaron botones redundantes para altas múltiples.

Compartir lista está en una opción compacta: usa el menú nativo cuando existe, ofrece copiar y, si el portapapeles no está permitido, muestra el texto seleccionable. Incluye categorías, cantidades, unidades, notas y urgencia; no incorpora automáticamente autores, fechas ni identificadores. La aplicación no envía mensajes ni utiliza una API de WhatsApp.

## C: administración y sesión

El responsable ve los integrantes, puede quitar a otro con confirmación y consultar o revocar la invitación activa y su vencimiento. Generar otra reemplaza la anterior. Quitar un integrante invalida la invitación activa para evitar que reutilice un código conocido. Un integrante puede abandonar su familia, conservando su cuenta. No existe transferencia de responsabilidad: el responsable no puede quitarse ni abandonar.

PostgreSQL conserva una instantánea del nombre del comprador y sustituye la referencia obligatoria a la membresía actual por una referencia a su cuenta Auth. Así se puede quitar la membresía sin borrar compras ni perder autores, incluso si la persona crea otra familia. Las funciones comprueban nuevamente la membresía después de tomar el bloqueo familiar: una solicitud que esperaba antes de la revocación no conserva autorización para escribir.

La revocación evita nuevas lecturas y escrituras en el servidor. La aplicación vuelve a comprobar familia e integrantes cada cinco segundos en primer plano; las lecturas de compras se mantienen cada tres. Al detectar acceso denegado vacía la instantánea compartida y deshabilita operaciones. No es posible retirar información que alguien ya haya visto, copiado o capturado antes de la revocación.

Se usa la persistencia y renovación de sesión del SDK oficial. No se guardan contraseñas manualmente. Durante la recuperación inicial y la consulta familiar se muestra un estado de carga, sin abrir primero la lista local. La cuenta queda contraída al entrar a la familia y el cierre explícito permanece accesible. Borrar datos del navegador, una sesión revocada o expirada sin renovación o ciertos modos privados pueden requerir ingresar nuevamente.

## D: PWA instalable

`public/manifest.webmanifest` define nombre, íconos, colores, alcance y apertura en ventana independiente. Los PNG de 180, 192 y 512 píxeles se renderizaron a partir del ícono SVG existente. Hay metadatos para iOS y un botón Instalar cuando el navegador ofrece esa posibilidad.

**No se creó un service worker ni una caché de respuestas privadas.** No hay edición o sincronización offline. La aplicación compartida necesita conexión. Chrome moderno puede instalar una aplicación con este manifiesto sin añadir un servicio de caché; la disponibilidad de instalación depende del navegador.

Después de publicar, abrí la URL HTTPS estable en un navegador normal: en Android/Chrome usá Instalar o el menú del navegador; en iPhone/Safari, Compartir → Agregar a pantalla de inicio. La primera apertura instalada puede requerir ingresar porque algunos sistemas separan su almacenamiento del navegador. Después se aplica la persistencia normal de sesión. No se distribuye un APK ni se publica en tiendas.

## Migración 0005: efectos y aprobación

Archivo: [`0005_favorites_family_admin.sql`](../supabase/migrations/0005_favorites_family_admin.sql). Requiere 0001–0004 ya aplicadas y se ejecuta una sola vez.

Agrega favoritos con valor false y el nombre histórico del comprador; completa ese nombre desde membresías existentes. Cambia la referencia del historial para conservar la cuenta del autor sin exigir que siga perteneciendo a la familia. Añade funciones de administración y amplía las operaciones con comprobación de permisos después del bloqueo. **La migración no elimina integrantes, cuentas, productos ni compras por sí sola.** La eliminación de membresía solo ocurre al confirmar una acción posterior en la interfaz.

El sobre de respuesta mantiene `schemaVersion: 3` para el cliente publicado anterior y declara `featuresVersion: 5` para las funciones aditivas. El código nuevo exige esas capacidades. Así no se requiere reconstruir ni borrar datos y el cliente publicado anterior sigue leyendo la estructura que conoce; las funciones antiguas de escritura permanecen detrás de la API controlada.

**Estado actual: 0005 ejecutada y publicación autorizada por el usuario.** El siguiente procedimiento queda como referencia para una instalación nueva, con aprobación previa; no lo repitas en el proyecto actual:

1. Abrí una consulta nueva y pegá el archivo 0005 completo, incluidos `begin` y `commit`.
2. Ejecutalo una vez. No repitas 0001–0004 ni borres tablas. Ante error, no publiques y conservá el mensaje; usá `ROLLBACK;` si la sesión quedó en transacción fallida.
3. Confirmá éxito. Probá localmente con dos cuentas del proyecto, antes de autorizar commit/push; Vercel desplegará un push a main.

La suite `supabase/tests/favorites_family_admin.sql` usa usuarios ficticios y `ROLLBACK`; fue ejecutada en una base temporal. Puede revisarse para pruebas posteriores como administrador, pero no sustituye verificar cuentas reales.

## Verificaciones

- Compilación, lint y 24 pruebas Node.
- Migraciones 0001–0005 y suites de reglas ejecutadas en PostgreSQL temporal en su orden. Se verificó también una compra creada antes de 0005: conserva cantidad y recibe su autor histórico.
- Autorizaciones: integrante no administrador, responsable, salida, eliminación, cuenta preservada, acceso SQL revocado, historial visible solo en la familia original y rechazo de una familia obsoleta simulada antes del bloqueo. No es una prueba de carga con conexiones concurrentes.
- Chrome con dos identidades aisladas, servidor local y ese PostgreSQL: sesión recuperada sin destello local, favorito compartido, compartir sin autores, revocación de invitación y pérdida de acceso del integrante conservando el historial.
- Manifiesto válido; diagnóstico de instalabilidad de Chrome normal sin errores. Chrome privado informa que no permite instalación, como corresponde. No hay registros de service worker. Sin excepciones JavaScript ni desbordes a 320, 390 y 1440 px en las vistas comprobadas.

Después de publicar, quedan las pruebas reales de aceptación con las cuentas familiares. No se realizaron escrituras de prueba ni cambios administrativos en producción desde el agente durante esta implementación. Vercel despliega automáticamente los pushes a la rama de producción conectada; comprobá que el despliegue del nuevo commit termine en Ready.
