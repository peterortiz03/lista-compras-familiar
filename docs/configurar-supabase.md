# Conectar cuentas y familias con Supabase

Para habilitar la guía, el aviso compartido y las notificaciones de supermercado en una instalación existente, seguí [la sección 7](#7-activar-los-avisos-de-supermercado).

La migración de historial y biblioteca (0008) ya se verificó en el proyecto compartido. En un proyecto nuevo, aplicala después de 0007 y antes de publicar el cliente. [Orden y comprobaciones](actualizacion-historial-biblioteca.md).

Actualización: el usuario confirmó 0004 y 0005 (favoritos y administración) y autorizó la publicación; revisá [etapas-bcd.md](etapas-bcd.md). No repitas las migraciones en el proyecto actual.

Para una instalación actual, esta guía prepara 0001; continuá luego con 0002 según [sincronizacion.md](sincronizacion.md) y 0003 para Catálogo e Historial. Ejecutá cada migración una vez y en orden. La [guía de Vercel](publicar-vercel.md) explica la publicación posterior.

Esta guía corresponde a la configuración inicial de la cuarta entrega. Para el comportamiento actual, completá después [la guía de sincronización](sincronizacion.md) con la migración 0002. Las descripciones de lista local de esta guía reflejan esa cuarta entrega. El código está preparado; todavía necesitás crear tu proyecto y comprobar el acceso real. Las cuentas y familias usarán Supabase, pero **la lista, el catálogo y el historial de compras siguen guardados localmente**, sin importación ni sincronización. Ingresar o cerrar sesión no borra ni cambia esa lista local; tampoco la protege de otras personas que usen el mismo perfil del navegador.

## 1. Crear tu proyecto

1. Abrí [Supabase](https://supabase.com/dashboard) y creá tu cuenta o ingresá.
2. Elegí **New project** en tu organización. Usá un proyecto nuevo para esta aplicación; la migración crea sus propias tablas.
3. Asignale un nombre, como `lista-compras-familiar`, elegí una región apropiada y guardá la contraseña de la base de datos en tu gestor de contraseñas. **No la pegues en el chat, en el código ni en Git.** Revisá las condiciones del plan antes de confirmar; no hace falta contratar servicios adicionales para configurar el código.
4. Esperá a que termine de prepararse el proyecto.

Los nombres de las secciones del panel pueden cambiar. La [guía oficial de React y Auth](https://supabase.com/docs/guides/auth/quickstarts/react) muestra la configuración vigente.

## 2. Crear las tablas y reglas

1. En el proyecto abrí **SQL Editor** y una consulta nueva.
2. Copiá el contenido completo de [`supabase/migrations/0001_accounts_and_families.sql`](../supabase/migrations/0001_accounts_and_families.sql) y ejecutalo **una sola vez**.
3. El script crea familias, integrantes, invitaciones y las tablas preparadas para las compras. También habilita RLS y las funciones permitidas. Si falla, su transacción no debería dejar una instalación parcial: revisá el error antes de reintentar.
4. En otra consulta ejecutá [`supabase/tests/accounts_and_families.sql`](../supabase/tests/accounts_and_families.sql). Contiene verificaciones de aislamiento y autorización, usuarios ficticios y un `ROLLBACK` final. Ejecutalo completo, no por fragmentos. Si falla, ejecutá `ROLLBACK;` antes de investigar. No crea cuentas con las que puedas iniciar sesión.

Las pruebas SQL se ejecutan como administrador e internamente cambian de rol para verificar permisos. Consultar las tablas directamente como administrador no comprueba RLS: el administrador puede omitir esas restricciones.

## 3. Configurar correo y acceso

En **Authentication**, revisá la configuración de inicio de sesión con correo y contraseña:

- Habilitá el proveedor de correo y el registro de nuevas cuentas.
- Mantené la confirmación de correo activada. Configurá un mínimo de 8 caracteres para la contraseña, coherente con el formulario.
- En la configuración de URLs, usá `http://localhost:5173` como **Site URL** durante el desarrollo y permití esa dirección como URL de redirección. Si usás otra dirección o puerto, agregá exactamente ese origen y usalo siempre.
- Los correos del servicio de desarrollo pueden tener restricciones de destinatarios y frecuencia. Si un correo no llega, revisá los registros de Auth y las indicaciones del panel. No desactives RLS para resolver un problema de correo. La configuración de correo para uso familiar estable se revisará antes de publicar.

## 4. Conectar el repositorio

Desde **Connect** del proyecto copiá su URL y su **publishable key** (`sb_publishable_...`). La clave pública está diseñada para el navegador y depende de los permisos RLS. No uses una **secret key**, `service_role`, la contraseña de PostgreSQL ni una cadena de conexión. Referencia: [claves de API de Supabase](https://supabase.com/docs/guides/api/api-keys).

En PowerShell, desde el repositorio:

```powershell
Copy-Item .env.example .env.local
code .env.local
```

Completá los dos valores:

```dotenv
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU-CLAVE-PUBLICA
```

Guardá y reiniciá Vite con `npm.cmd run dev`. Vite lee estas variables al arrancar y las incluye en la aplicación del navegador. `.env.local` está excluido de Git; `.env.example` contiene solo nombres vacíos. No pegues claves secretas aunque el nombre del archivo empiece con `.env`.

Si no completás la configuración, la lista local sigue funcionando. Si la URL tiene un formato incorrecto, la aplicación también mantiene el modo local. Una URL válida pero de un proyecto incorrecto producirá errores de conexión o acceso: verificá ambos valores.

## 5. Probar con cuentas reales

1. Creá tu cuenta desde **Tu cuenta familiar → Crear cuenta**. Confirmá el correo si se solicita y después ingresá.
2. Indicá tu nombre y creá una familia. Debés aparecer como responsable.
3. Generá una invitación y copiá el código. No lo publiques: permite incorporar un integrante. Dura 7 días, se consume una vez y generar otro reemplaza el anterior.
4. Abrí otro perfil de navegador o una ventana privada. Registrá y confirmá una segunda cuenta, ingresá y elegí **Unirme con invitación**.
5. Volvé a la primera cuenta y tocá **Actualizar familia**: deben aparecer ambos integrantes. Todavía no hay actualización automática.
6. Confirmá que la segunda cuenta no puede generar invitaciones y que un tercer usuario no puede reutilizar el código.
7. Creá otra familia con una tercera cuenta y comprobá que cada cuenta vea solo su propia familia e integrantes.
8. Cerrá sesión, recargá e ingresá de nuevo. Confirmá que la sesión se recupera cuando corresponde y que el cierre impide seguir viendo el panel familiar. La lista local inferior permanece independiente de la cuenta.

Esta etapa admite **una familia por cuenta**. No incluye salir de una familia, expulsar integrantes, transferir la responsabilidad, recuperar contraseñas ni editar el perfil. No borres usuarios propietarios desde el panel como prueba: primero necesitaríamos definir qué hacer con su familia.

## 6. Estado de las verificaciones

El esquema y sus pruebas se verificaron en un PostgreSQL temporal local con una implementación mínima de `auth.uid()` para simular identidades. Eso permite comprobar RLS y funciones sin conectar servicios, pero **no sustituye la prueba de Supabase Auth y del correo en tu proyecto real**.

También se comprobó la interfaz en Chrome contra un servidor HTTP local de respuestas simuladas: registro, acceso fallido y exitoso, recuperación de sesión, creación de familia, invitación, incorporación y cierre de sesión. No hubo desbordes a 320, 390 y 1440 px. Esa comprobación valida la interfaz, no el servicio real.

La quinta entrega ya conecta productos, pendientes y compras mediante operaciones transaccionales. Después de esta guía aplicá únicamente la migración 0002 y seguí [sincronizacion.md](sincronizacion.md). No se habilitan escrituras directas a las tablas desde el navegador.

## 7. Activar los avisos de supermercado

La guía interactiva y el asistente de catálogo usan el cliente y las operaciones de catálogo existentes. El aviso dentro de la lista requiere `0010`. El envío push se habilita con `0011`, la Edge Function y la clave pública VAPID en Vercel.

### Orden de activación

1. Con autorización para producción, verificá que la base tenga las migraciones hasta `0009`. Aplicá una vez [0010_shopping_sessions.sql](../supabase/migrations/0010_shopping_sessions.sql) y luego [0011_shopping_web_push.sql](../supabase/migrations/0011_shopping_web_push.sql). El cliente anterior puede seguir consultando el mismo RPC durante el cambio.
2. Generá un par VAPID para este entorno con `npx web-push@3.6.7 generate-vapid-keys --json`. Guardá el par en el gestor de secretos. Generá también un secreto aleatorio de al menos 32 caracteres para autenticar el trabajo programado.
3. En **Edge Functions → Secrets**, configurá `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` con un contacto válido como `mailto:correo@dominio` y `SHOPPING_PUSH_CRON_SECRET`. Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` a la función. [Variables de Edge Functions](https://supabase.com/docs/guides/functions/secrets).
4. Desplegá `send-shopping-push` desde el repositorio con `supabase functions deploy send-shopping-push --project-ref TU_PROYECTO`. `supabase/config.toml` declara que usa el secreto exclusivo de Cron para autenticar la llamada.
5. Habilitá `pg_cron` y `pg_net`. En **Vault**, guardá `shopping_push_project_url` con `https://TU_PROYECTO.supabase.co` y `shopping_push_cron_secret` con el mismo valor de `SHOPPING_PUSH_CRON_SECRET`. Ejecutá [schedule_shopping_push.sql](../supabase/setup/schedule_shopping_push.sql). El trabajo revisa la cola una vez por minuto. [Cron y Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions).
6. En Vercel definí `VITE_WEB_PUSH_PUBLIC_KEY` con la misma clave pública y publicá el commit autorizado. Para un cliente local, usá esa variable en `.env.local` y reiniciá Vite. Vercel y Vite solo reciben la clave pública VAPID. [Variables de Vercel](https://vercel.com/docs/environment-variables).

Con el cliente publicado y `0010` aplicada, el aviso dentro de la lista está disponible aunque falte configurar push. Las entregas en cola vencen como máximo cinco minutos después del inicio. Cada dispositivo tiene un intento por sesión. El envío depende de la conectividad y del proveedor push.

### Probar con dos cuentas

1. En un entorno de prueba, creá una familia con la cuenta A y sumá la cuenta B con una invitación. Usá perfiles o dispositivos separados. Completá u omití la guía y el asistente. En ambas cuentas verificá el mismo catálogo y la misma lista.
2. En B entrá a **Cuenta y familia**, tocá **Activar avisos** y aceptá el permiso. Verificá **Activadas en este dispositivo** y cerrá la pestaña o la app instalada, manteniendo la cuenta iniciada.
3. En A tocá **Avisar que estoy comprando** y confirmá. En B verificá una sola notificación. Tocala y comprobá que abra la lista, muestre el aviso y permita sumar un pendiente. Si A también tiene los avisos activos, comprobá que no se notifique a sí misma.
4. Finalizá desde la cuenta que lo inició o desde la cuenta responsable. Verificá que el aviso desaparezca y que el pendiente siga en ambas listas. Si la notificación se toca después de finalizar, aparece la lista habitual con un mensaje de aviso no disponible. Sin finalización manual, verificá su desaparición después de 90 minutos.
5. Desactivá los avisos en B y repetí. B debe seguir viendo la compra dentro de En casa. Repetí con el permiso bloqueado y con una cuenta de otra familia para comprobar el comportamiento de cada caso.

En **iPhone o iPad con iOS/iPadOS 16.4 o posterior**, abrí el sitio en Safari, elegí **Compartir → Agregar a pantalla de inicio** y abrí En casa desde el ícono. Activá los avisos en **Cuenta y familia**. En **Android**, abrí el sitio HTTPS en un navegador compatible como Chrome y activá los avisos desde la misma opción. Los permisos bloqueados se gestionan desde los ajustes de notificaciones del sitio o del dispositivo. [Web Push en iOS y iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Las comprobaciones de PostgreSQL están en [shopping_sessions.sql](../supabase/tests/shopping_sessions.sql) y [shopping_push.sql](../supabase/tests/shopping_push.sql). Usá un entorno de pruebas. Para comprobar el cifrado y la respuesta 410 con un proveedor simulado, ejecutá `deno test --allow-env supabase/functions/send-shopping-push/delivery_test.ts`. La recepción en segundo plano en iPhone y Android requiere dispositivos reales.
