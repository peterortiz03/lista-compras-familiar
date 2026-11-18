# Lista de Compras Familiar

**Corrección de fotografías y catálogo:** exportación WebP con alternativa JPEG y acciones en segunda fila en celulares. El usuario aplicó 0007 y autorizó la publicación; se verificaron la reserva de formato y el bucket privado con WebP/JPEG y límite 256 KiB. No repitas las migraciones. La aceptación en un iPhone real sigue pendiente; ver [fotografias.md](docs/fotografias.md#corrección-de-compatibilidad-ios-0007).

**Fotografías del catálogo:** Storage privado y migración 0006 configurados. Función de limpieza desplegada con secreto exclusivo y Cron cada 15 minutos, verificado con respuesta HTTP 200. La función forma parte de esta versión; ver [uso y configuración](docs/fotografias.md). No repitas las migraciones.

**Actualización A–D:** categorías, notas, autoría, urgencia, favoritos, sugerencias, compartir, administración familiar, acceso persistente y PWA. El usuario confirmó la ejecución de 0004 y 0005 y autorizó la publicación. Ver [efectos y verificaciones](docs/etapas-bcd.md).

**En casa** organiza las compras del hogar con React, TypeScript, Vite, Tailwind CSS y Supabase. La aplicación incluye lista familiar compartida, catálogo administrable y compras completas o parciales con historial y reversión.

## Requisitos y ejecución en Windows

- Node.js 22.18 o superior compatible con Vite, preferentemente LTS vigente; npm y un navegador moderno.
- Para compartir con este código: un proyecto Supabase con 0001–0005 aplicadas y `.env.local` configurado. El usuario confirmó todas las migraciones en el proyecto actual; sin Supabase se puede usar la copia local.
- Para fotos familiares: 0006 y Storage privado con limpieza programada, según [fotografias.md](docs/fotografias.md). No hay variables nuevas de frontend ni fotos en modo local. Sin 0006 el catálogo anterior sigue operativo.

Desde PowerShell:

```powershell
cd "C:\Users\Pedro Peter\Repositorios GitHub\lista-compras-familiar"
npm.cmd ci
npm.cmd run dev
```

Abrí la dirección que indique Vite, normalmente `http://localhost:5173`; detenelo con `Ctrl+C`. `npm.cmd` evita el bloqueo de `npm.ps1` sin modificar la política de PowerShell. `npm ci` instala las versiones fijadas en `package-lock.json`.

El servidor local debe seguir abierto mientras probás en localhost. La versión publicada en Vercel puede usarse con la PC apagada. Los pushes a la rama de producción conectada disparan la actualización automática; esperá el estado Ready antes de probar. La lista compartida necesita conexión.

## Configuración y actualización

- Primera instalación: [cuentas y familias con Supabase](docs/configurar-supabase.md), incluida la migración 0001.
- Instalación nueva: continuá con [0002_shared_shopping.sql](supabase/migrations/0002_shared_shopping.sql) en SQL Editor. No repitas 0001 ni borres tablas. Después reiniciá Vite.
- Después aplicá [0003_catalog_and_purchase_reversal.sql](supabase/migrations/0003_catalog_and_purchase_reversal.sql) para catálogo e historial administrables. Ejecutá cada migración una sola vez.
- En una instalación nueva, completá con 0004 y 0005 en orden. En este proyecto ambas ya están aplicadas: no repitas las migraciones. Ver [los efectos de 0005](docs/etapas-bcd.md#migración-0005-efectos-y-aprobación).
- [Guía de sincronización y recorrido con dos cuentas](docs/sincronizacion.md).
- [Publicación paso a paso en Vercel, costos y actualizaciones](docs/publicar-vercel.md).

La aplicación usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env.example` contiene los nombres; copiá y completá `.env.local`, excluido de Git. Nunca uses `service_role`, claves secretas ni la contraseña de PostgreSQL en el navegador.

## Comportamiento actual

- Cada cuenta pertenece a una familia. El responsable puede generar una invitación de un uso y siete días de vigencia. Una nueva reemplaza la anterior.
- Al ingresar se muestra la lista de esa familia. Sin sesión o sin familia cargada se muestra la copia local, con una etiqueta diferente.
- Alta de productos, sugerencias, búsqueda, cantidades y unidades, prevención de duplicados, edición y eliminación de pendientes.
- Vistas Lista, Catálogo e Historial. Todos pueden crear productos sin agregarlos a pendientes, editar sus nombres, quitarlos de las sugerencias y recuperarlos. Se conserva su unidad original y no se lleva stock exacto.
- Compras parciales y completas con fecha, hora y autor. Cada integrante puede revertir sus compras y el responsable familiar puede revertir cualquiera. Revertir devuelve la cantidad a pendientes, oculta la compra del historial habitual y la conserva en la vista de revertidas. Eliminar un pendiente no registra una compra.
- Actualización automática aproximadamente cada tres segundos en pestañas visibles, al recuperar foco o conexión y después de guardar. Botón de actualización manual. No requiere Supabase Realtime.
- Si otra persona cambia un pendiente mientras lo editás o comprás, se rechaza el formulario anterior para que revises la cantidad actualizada.
- Las operaciones se confirman en el servidor y tienen identificadores para evitar repetir compras al reintentar. No hay escrituras sin conexión.
- Importación confirmada de catálogo y pendientes locales a una familia vacía, una vez y con un máximo de 500 productos. El historial antiguo no se importa; toda la copia local original se conserva.

La copia local pertenece al navegador, perfil y origen. `localhost:5173` y `127.0.0.1:5173` guardan copias distintas. Borrar los datos del sitio puede eliminarla. No se mezcla ni se sube automáticamente al ingresar. Usá una sola pestaña para editar en modo local; el modo familiar sí admite varias cuentas y pestañas.

## Prueba rápida de sincronización

1. Ingresá en dos perfiles de navegador con cuentas de la misma familia. Ambos deben mostrar **Lista compartida** y el mismo nombre familiar.
2. Agregá Huevos con 5 unidades desde A. En B deben aparecer en unos segundos sin recargar.
3. Intentá agregar `HUEVOS` desde B: debe ofrecer editar, sin duplicar ni sumar.
4. Comprá 3 desde A: B debe ver 2 pendientes y el registro con el autor.
5. Abrí una compra en A y cambiá el pendiente desde B. Confirmar la ventana anterior de A debe avisar del cambio; cerrala y abrila otra vez.
6. Recargá y comprobá persistencia. Cerrá sesión: debe reaparecer la copia local. Una cuenta de otra familia no debe ver las compras anteriores.

Si la red falla, la interfaz conserva los últimos datos confirmados y muestra un aviso; las operaciones quedan bloqueadas hasta recuperar la lectura. Revisá lista e historial antes de reintentar una operación cuya confirmación no llegó.

## Comprobaciones

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

Son 24 casos de lógica con el ejecutor de Node. También hay pruebas transaccionales de permisos y compras en `supabase/tests/`, para SQL Editor como administrador, con `ROLLBACK` final. No se agregó un framework de pruebas ni dependencias nuevas en esta entrega.

Se probaron las migraciones en PostgreSQL temporal y la interfaz con dos cuentas aisladas y un servidor local conectado a ese motor. La API real reconoce la función nueva y rechaza el acceso anónimo; el usuario confirmó la configuración de cuentas y la ejecución de 0002. Eso no equivale a haber accedido a sus sesiones ni probado compras reales en su proyecto.

Para abrir el build local: `npm.cmd run preview`, después de `build`. No publica la aplicación.

## Próximos pasos y alcance

La publicación queda preparada con `vercel.json` y su guía; requiere crear la cuenta Vercel, conectar GitHub y configurar las variables y URLs de Auth. No se publicó automáticamente. Después continuaremos probando con cuentas reales y ajustando lo necesario, incluida recuperación de contraseña y, en otra entrega, PWA. No se implementan precios, comercios, notificaciones, inventario exacto, códigos de barras ni tickets. El historial y el catálogo aún se recuperan completos; paginación y retención de solicitudes se revisarán si crece su volumen.

- [Decisiones](docs/decisiones.md)
- [Guía de aprendizaje](docs/guia-aprendizaje.md)
- [Sincronización: reglas, límites y verificación](docs/sincronizacion.md)

## Probar Catálogo y revertir compras

1. En **Catálogo**, creá un producto y verificá que aparezca como sugerencia en **Lista**, sin generar un pendiente por sí solo.
2. Editá el nombre. Quitalo: debe desaparecer de las sugerencias; sus pendientes e historial se conservan. Activá **Mostrar también productos quitados** y recuperalo.
3. Registrá una compra parcial y, en **Historial**, elegí **Revertir compra**. Confirmá que la cantidad vuelva a pendientes y desaparezca de la vista habitual.
4. Activá **Mostrar compras revertidas**: debe aparecer identificada como revertida, sin opción de revertir dos veces.
5. Con otro integrante, comprobá que solo pueda revertir sus propias compras. El responsable puede revertir las de todos en su familia. Los permisos se verifican también en PostgreSQL.

Se probaron las tres migraciones y sus suites SQL en PostgreSQL temporal, diecinueve pruebas Node y el recorrido de Catálogo/Historial en Chrome con dos cuentas y ese PostgreSQL. Crear, quitar, recuperar y renombrar sincronizó las sugerencias; revertir restableció cantidades y respetó permisos. Sin excepciones ni desbordes a 320, 390 y 1440 px. Las pruebas no modificaron compras reales.

## Funciones nuevas B–D

- Estrellas compartidas en Catálogo, sugerencias compactas con frecuencia/recencia y compartir lista sin datos de integrantes.
- Responsable: quitar integrantes y gestionar invitación activa. Integrantes: abandonar. Se conservan cuentas y compras históricas; no se permite salir al responsable.
- Recuperación de sesión antes de mostrar la lista, sin destello de la copia local.
- Manifiesto e íconos para instalación PWA desde un navegador compatible. Se necesita conexión; no hay service worker, cola offline ni caché de respuestas familiares.

Las pruebas actuales son 24 casos Node, suites SQL y comprobaciones de navegador descritas en [etapas-bcd.md](docs/etapas-bcd.md). El usuario confirmó 0005 y autorizó commit, push y publicación. No repitas las migraciones; después del despliegue verificá las funciones con las cuentas reales.
