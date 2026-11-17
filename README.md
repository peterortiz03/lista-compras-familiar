# Lista de Compras Familiar

**En casa** organiza las compras del hogar con React, TypeScript, Vite, Tailwind CSS y Supabase. La quinta entrega conecta la lista familiar: catálogo, pendientes, compras completas y parciales e historial con autor.

## Requisitos y ejecución en Windows

- Node.js 22.18 o superior compatible con Vite, preferentemente LTS vigente; npm y un navegador moderno.
- Para compartir: un proyecto Supabase con las dos migraciones aplicadas y `.env.local` configurado. Sin Supabase se puede usar la copia local.

Desde PowerShell:

```powershell
cd "C:\Users\Pedro Peter\Repositorios GitHub\lista-compras-familiar"
npm.cmd ci
npm.cmd run dev
```

Abrí la dirección que indique Vite, normalmente `http://localhost:5173`; detenelo con `Ctrl+C`. `npm.cmd` evita el bloqueo de `npm.ps1` sin modificar la política de PowerShell. `npm ci` instala las versiones fijadas en `package-lock.json`.

El servidor local debe seguir abierto para cargar la aplicación. Hasta publicar, guardar datos en Supabase no reemplaza el alojamiento de la página ni habilita edición offline.

## Configuración y actualización

- Primera instalación: [cuentas y familias con Supabase](docs/configurar-supabase.md), incluida la migración 0001.
- Si ya tenés cuentas: aplicá solo [0002_shared_shopping.sql](supabase/migrations/0002_shared_shopping.sql) en SQL Editor. No repitas 0001 ni borres tablas. Después reiniciá Vite.
- [Guía de sincronización y recorrido con dos cuentas](docs/sincronizacion.md).

La aplicación usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env.example` contiene los nombres; copiá y completá `.env.local`, excluido de Git. Nunca uses `service_role`, claves secretas ni la contraseña de PostgreSQL en el navegador.

## Comportamiento actual

- Cada cuenta pertenece a una familia. El responsable puede generar una invitación de un uso y siete días de vigencia. Una nueva reemplaza la anterior.
- Al ingresar se muestra la lista de esa familia. Sin sesión o sin familia cargada se muestra la copia local, con una etiqueta diferente.
- Alta de productos, sugerencias, búsqueda, cantidades y unidades, prevención de duplicados, edición y eliminación de pendientes.
- Compras parciales y completas con fecha, hora y autor en el historial. Eliminar no registra una compra.
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

Son dieciséis casos de lógica con el ejecutor de Node. También hay pruebas transaccionales de permisos y compras en `supabase/tests/`, para SQL Editor como administrador, con `ROLLBACK` final. No se agregó un framework de pruebas ni dependencias nuevas en esta entrega.

Se probaron las migraciones en PostgreSQL temporal y la interfaz con dos cuentas aisladas y un servidor local conectado a ese motor. La API real reconoce la función nueva y rechaza el acceso anónimo; el usuario confirmó la configuración de cuentas y la ejecución de 0002. Eso no equivale a haber accedido a sus sesiones ni probado compras reales en su proyecto.

Para abrir el build local: `npm.cmd run preview`, después de `build`. No publica la aplicación.

## Próximos pasos y alcance

Queda la revisión integral del MVP con cuentas reales y los ajustes que surjan, incluida recuperación de contraseña. Después, publicación y PWA. No se implementan precios, comercios, notificaciones, inventario exacto, códigos de barras ni tickets. El historial y el catálogo aún se recuperan completos; paginación y retención de solicitudes se revisarán si crece su volumen.

- [Decisiones](docs/decisiones.md)
- [Guía de aprendizaje](docs/guia-aprendizaje.md)
- [Sincronización: reglas, límites y verificación](docs/sincronizacion.md)
