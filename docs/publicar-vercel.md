# Publicar En casa en Vercel

El proyecto está preparado para desplegarse desde GitHub. Esta guía no significa que ya esté publicado: necesitás crear tu cuenta de Vercel y conectar el repositorio. No hace falta instalar la CLI ni contratar un dominio.

## 1. Costos: con qué empezar

- **Vercel Hobby** es gratuito para proyectos personales no comerciales y tiene límites de uso. Esta aplicación familiar encaja en ese propósito. No elijas Pro ni una prueba de pago si querés mantenerte en el plan gratuito. [Plan Hobby](https://vercel.com/docs/plans/hobby).
- **Supabase Free** ofrece la base de datos y Auth con límites. Puede pausar proyectos con poca actividad durante una semana; los datos no se vuelven públicos por la pausa. Revisá el panel de uso y tu plan. [Precios](https://supabase.com/pricing), [pausas](https://supabase.com/docs/guides/platform/free-project-pausing).
- Usá la dirección `vercel.app` asignada al proyecto: no necesitás comprar un dominio. Un dominio propio y servicios adicionales pueden tener costo.
- El correo de registro merece una comprobación aparte: el SMTP de pruebas de Supabase limita destinatarios y envíos y no es un servicio de correo de producción. Para altas y confirmaciones de nuevos familiares puede hacer falta configurar SMTP externo; sus condiciones, dominio remitente y costos dependen del proveedor. Las cuentas ya confirmadas pueden seguir ingresando con contraseña. No desactives la seguridad de las tablas para resolver un problema de correo. [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp).

Se puede empezar sin pagar por el alojamiento y la base de datos dentro de esos planes; no es una garantía de capacidad ilimitada ni de gratuidad para cualquier volumen o servicio añadido. Esta entrega no contrata ni cambia planes.

## 2. Preparar Supabase

Ya deberías tener 0001 y 0002 aplicadas. Ejecutá también, una sola vez, [`0003_catalog_and_purchase_reversal.sql`](../supabase/migrations/0003_catalog_and_purchase_reversal.sql) en SQL Editor. No repitas las anteriores ni borres tablas. Conserva los datos y agrega catálogo activo, revisiones y reversión de compras.

Probá localmente las vistas **Lista**, **Catálogo** e **Historial**. El responsable puede revertir cualquier compra de su familia; los integrantes solo las propias. Si una compra estaba mal, revertirla devuelve su cantidad a pendientes y la oculta del historial habitual, manteniéndola en la vista de revertidas.

## 3. Crear Vercel y conectar GitHub

1. Abrí [Vercel](https://vercel.com/signup), creá tu cuenta usando GitHub y elegí el uso personal **Hobby**.
2. En el panel elegí **Add New → Project** o la opción equivalente para importar un repositorio.
3. Conectá tu GitHub si se solicita. Podés dar acceso únicamente a `peterortiz03/lista-compras-familiar`.
4. Importá ese repositorio y usá `main` como rama de producción.
5. Revisá los valores de construcción:

| Opción | Valor |
| --- | --- |
| Framework | Vite |
| Root Directory | Raíz del repositorio (`./`) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | Valor automático de npm, o `npm ci` |
| Node.js | Automática; actualmente 26.x en Vercel, compatible con el proyecto y la versión usada localmente |

`vercel.json` fija el framework, el build y la carpeta de salida. Los botones de navegación son vistas dentro de la misma página; no hace falta configurar rutas de servidor adicionales. Referencias: [Vite en Vercel](https://vercel.com/docs/frameworks/frontend/vite), [versiones de Node](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

El rango `engines.node` del proyecto admite 22.18 o superior. Vercel puede seleccionar la mayor versión compatible aunque se elija otra en el panel; comprobá la versión efectiva en los logs si necesitás fijarla más adelante.

## 4. Variables de entorno: antes de Deploy

Agregá en Vercel estos dos nombres y los mismos valores públicos que ya usás en `.env.local`:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU-CLAVE-PUBLICA
```

Habilitalos para **Production**. Si después vas a probar despliegues Preview, configurá ese entorno expresamente; para la primera publicación alcanza Production.

No subas `.env.local` ni ingreses contraseñas de PostgreSQL, secret keys, `service_role` o tokens administrativos. Las variables `VITE_` se incluyen en los archivos que recibe el navegador. Son públicas y los datos familiares se protegen con Auth y RLS. [Variables de Vercel](https://vercel.com/docs/environment-variables).

Presioná **Deploy**. Esperá el resultado y abrí la dirección estable de producción que muestra el proyecto, por ejemplo `https://tu-proyecto.vercel.app`. El ejemplo no es una dirección ya creada. Si agregaste o cambiaste variables después de publicar, ejecutá **Redeploy**: se leen al construir la aplicación.

## 5. Ajustar las direcciones en Supabase Auth

En tu proyecto Supabase, abrí **Authentication → URL Configuration**:

1. Cambiá **Site URL** por tu URL HTTPS de producción.
2. En **Redirect URLs**, agregá exactamente esa dirección, por ejemplo `https://tu-proyecto.vercel.app`.
3. Conservá `http://localhost:5173` como redirección permitida para seguir desarrollando. Si usás otro puerto o dirección local, agregalo expresamente.
4. Guardá. Usá siempre la misma dirección pública estable con tu familia; no una URL temporal de un despliegue individual.

No hacen falta comodines amplios para esta primera publicación. Probá de nuevo cualquier confirmación de correo que utilices. [Redirecciones de Supabase](https://supabase.com/docs/guides/auth/redirect-urls).

## 6. Comprobar la publicación

1. Abrí la dirección de producción desde el celular usando datos móviles. No necesitás mantener tu PC encendida.
2. Ingresá con una cuenta confirmada. Debe aparecer **Lista compartida** y el nombre de la familia. Si solo ves modo local o cuentas sin configurar, revisá las dos variables y volvé a desplegar.
3. Desde otro navegador ingresá con otro integrante y probá alta, cambio de cantidad, compra parcial y actualización en unos segundos.
4. En Catálogo creá un producto, quitalo y recuperalo. Comprobá que cambien sus sugerencias en la otra cuenta.
5. En Historial revertí una compra propia y verificá que vuelva su cantidad a pendientes. La compra debe aparecer solo al marcar **Mostrar compras revertidas**. Confirmá que otro integrante no pueda revertirla.
6. Probá cerrar sesión e ingresar de nuevo. Una cuenta de otra familia no debe ver esos datos. La página pública puede abrirla cualquiera; cada lista familiar requiere su sesión autorizada.

Los datos de Supabase son los mismos al usar localhost o la URL publicada. La **copia local** del navegador, en cambio, pertenece a cada origen: la de localhost no aparece automáticamente en `vercel.app`. Si necesitás importarla, hacelo desde localhost con la cuenta familiar y una familia vacía, según [sincronizacion.md](sincronizacion.md). No importes ejemplos por accidente.

Esta publicación es una aplicación web. No implementa todavía una PWA con edición offline, ni la publicación por sí sola la agrega a una tienda de aplicaciones.

## 7. Seguir cambiando después de publicar

Sí: el repositorio sigue siendo el lugar donde desarrollamos. Probamos localmente, guardamos los cambios en commits y hacemos push. Con GitHub conectado, los pushes a la rama de producción generan nuevos despliegues y la dirección principal muestra la nueva versión. [Integración con GitHub](https://vercel.com/docs/git/vercel-for-github).

Actualizar la interfaz no borra la base de datos. Si un cambio requiere una migración, hay que aplicarla deliberadamente en Supabase; Vercel no ejecuta nuestros archivos SQL automáticamente. Conviene que los cambios de esquema sean compatibles con la versión publicada y confirmar las copias de seguridad disponibles antes de una operación que borre datos.

Para cambios grandes podremos usar otra rama y un despliegue Preview. Una vista previa con las mismas variables usa la misma base de datos: no la trates como un entorno aislado. Más adelante podremos separar proyectos de desarrollo y producción si hace falta.

Si una publicación falla, revisá sus logs de construcción. Si un push no despliega por permisos o autoría, revisá la conexión GitHub y que el autor del commit esté asociado a la cuenta propietaria de Hobby. No necesitás crear cuentas de Vercel para los integrantes de tu familia: ellos usan sus cuentas de la aplicación.
