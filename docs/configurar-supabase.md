# Conectar cuentas y familias con Supabase

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
