# Cómo funciona la aplicación — Entrega 5

## 1. Qué corre y dónde

Cuando ejecutás `npm.cmd run dev`, **Vite** inicia un servidor de desarrollo en tu computadora. El navegador le pide `index.html`, que contiene el contenedor `root` y carga `src/main.tsx`. Ese archivo inicia **React**, que muestra `App` dentro del contenedor.

La aplicación y sus datos viven en el navegador. El servidor de Vite sirve código y refleja cambios mientras programás; todavía no es un servidor de negocio ni una base de datos. Cerrar la terminal detiene Vite. Recargar vuelve a ejecutar el programa; desde la tercera entrega recupera los datos locales antes de mostrar la interfaz.

**npm** administra dependencias y ejecuta los comandos de `package.json`. Vite transforma el código para el navegador. El comando `build` usa TypeScript para comprobar tipos y Vite para generar archivos distribuibles en `dist/`. Generarlos no equivale a publicarlos.

## 2. TypeScript: describir los datos

TypeScript agrega comprobaciones de tipos a JavaScript. Se parece a las anotaciones de Python, con una diferencia práctica: aquí ejecutamos el compilador para revisar su uso antes de construir la aplicación.

En `src/types.ts`, una `interface` describe la forma de un objeto:

```ts
interface PendingItem {
  productId: string
  quantity: number
}
```

Pensalo como un contrato para un registro, parecido al propósito de un `TypedDict` de Python. No es una clase: no crea instancias ni contiene métodos. Un objeto con esas propiedades y tipos cumple el contrato.

`Product[]` significa un arreglo de productos, comparable con `list[Product]`. El tipo `Unit` solo admite las cuatro unidades definidas. Lo derivamos de `UNITS`, un arreglo con `as const`: TypeScript conserva sus valores literales, en lugar de tratar cada unidad como cualquier texto posible. `Product | null` significa que un resultado puede ser un producto o no contener uno.

Los tipos se eliminan al generar JavaScript. **No validan por sí solos lo que escribe una persona.** Por eso `quantityError` también comprueba límites y decimales al ejecutar el programa. Con una base de datos habrá que validar nuevamente en el servidor.

## 3. Dos conjuntos de información

`ShoppingState` agrupa:

- `catalog`: productos conocidos, con identificador, nombre y unidad.
- `pending`: referencias a productos que faltan comprar, con su cantidad.
- `history`: eventos de compra, con cantidad, nombre, unidad y momento de la compra.

Por ejemplo, el catálogo contiene Leche y el pendiente guarda algo equivalente a `{ productId: 'leche', quantity: 2 }`. Se relacionan por el identificador. Esto se parece a una referencia entre objetos y prepara la idea de una clave foránea en una futura base relacional, sin implementar todavía esa base.

Eliminar Leche de pendientes no la borra del catálogo. Así puede volver a aparecer como sugerencia. El contador de pendientes cuenta **productos diferentes**, no suma litros, kilos y unidades.

## 4. React: componentes, propiedades y estado

Un **componente** es una función que devuelve una descripción de la interfaz. El código parecido a HTML dentro de un archivo `.tsx` se llama **JSX**. Permite combinar etiquetas con expresiones de JavaScript entre llaves: `{state.pending.length}` muestra el número de pendientes.

Usamos componentes funcionales en vez de clases. `App` organiza la pantalla; `ShoppingList` muestra los pendientes; `ProductForm` reúne el alta y la edición. Un componente recibe **props**, argumentos con datos y funciones enviados por su padre.

Las props viajan hacia abajo. Para comunicar una acción hacia arriba, el hijo llama a una función recibida: por ejemplo, `ShoppingList` llama a `onBuy(product)` al tocar el círculo de compra.

El **estado** guarda datos que pueden cambiar y afectan a la pantalla:

```ts
const [state, setState] = useState(createInitialState)
```

`useState` devuelve el valor actual y una función para actualizarlo. Pasamos la función `createInitialState` para que React obtenga el estado inicial al montar el componente. A diferencia de una variable común, actualizar estado hace que React vuelva a calcular la interfaz.

`App` guarda el catálogo y los pendientes porque los necesitan ambos hijos. El formulario guarda localmente lo que estás escribiendo; la lista guarda su búsqueda. No hace falta un contenedor global de estado para esta escala.

## 5. Qué ocurre al agregar un producto

1. Escribís en el formulario. `onChange` actualiza su estado local y `value` refleja ese estado en el campo: es un **input controlado**.
2. El formulario busca coincidencias en el catálogo recibido por props. Son datos calculados a partir del nombre, no otro estado que mantener sincronizado.
3. Al enviar, `handleSubmit` usa `preventDefault()` para evitar la recarga que haría un formulario HTML tradicional. Convierte el texto de cantidad a número, admitiendo coma decimal, y valida.
4. El formulario llama a `onAdd`. En `App`, `handleAdd` delega en `addProduct` con el estado actual y un identificador nuevo.
5. La función normaliza el nombre. Si ya está pendiente, devuelve `kind: 'duplicate'` y el mismo estado. El formulario muestra el aviso y ofrece editar; no cambia la cantidad por su cuenta.
6. Si corresponde agregarlo, devuelve `kind: 'added'` y un nuevo estado. Un producto conocido reutiliza su identificador y unidad; uno nuevo también entra al catálogo.
7. `setState` entrega ese nuevo estado a React. React vuelve a calcular los componentes y actualiza lista, contadores y sugerencias.

`kind` permite distinguir dos resultados posibles; TypeScript reconoce cada alternativa al consultar esa propiedad.

## 6. Modificar sin mutar

En Python podrías modificar directamente un atributo o un elemento de una lista. Aquí conservamos los objetos de estado anteriores y construimos otros para representar el cambio:

```ts
pending: state.pending.map((item) =>
  item.productId === productId ? { ...item, quantity } : item
)
```

`map` produce un arreglo nuevo, parecido a una comprensión de listas. `...item` copia las propiedades y `quantity` reemplaza solo esa propiedad. Es una copia superficial: se reutilizan los elementos que no cambian. Esto facilita a React reconocer cambios y evita modificar datos compartidos accidentalmente.

`filter` crea un arreglo sin los elementos descartados. `setState((current) => ...)` calcula una actualización a partir del estado más reciente que React entrega; se usa al editar y retirar pendientes.

## 7. Edición, compras y búsqueda

Al tocar una cantidad, `App` guarda el identificador en edición. El formulario recibe el producto y su cantidad actual. `key={editingId ?? 'new'}` hace que React cree una instancia nueva del formulario al cambiar el producto editado, reiniciando sus campos. Guardar valida, reemplaza la cantidad y cierra la edición.

`useRef` permite apuntar al campo de cantidad para enfocarlo; `useEffect` realiza ese enfoque después de que React muestra el formulario de edición. Las reglas de negocio siguen en funciones normales. No hacen falta efectos para calcular sugerencias o filtrar la lista.

Eliminar usa `removePending` y no crea una compra. Comprar abre `PurchaseDialog`; al confirmar, `recordPurchase` reduce el pendiente y agrega un registro al historial en una sola actualización de estado.

La búsqueda de pendientes y las sugerencias usan la misma normalización: `Café`, `CAFE` y ` café ` coinciden. No hay búsqueda semántica ni detección de sinónimos. React usa `key={product.id}` en las filas para identificar cada producto aunque la lista cambie.

## 8. Estilos y accesibilidad

**CSS** define la presentación. Tailwind permite aplicar reglas mediante clases, por ejemplo `grid`, `gap-6` o `rounded-2xl`. En `src/index.css` definimos colores y estilos repetidos para botones y campos. El plugin de Tailwind genera el CSS usado durante el desarrollo y la compilación.

Clases como `lg:grid-cols-[minmax(0,1fr)_340px]` aplican dos columnas desde un ancho amplio; por debajo, la pantalla tiene una sola. En celulares la lista aparece primero, y el botón de agregar lleva al formulario. Los campos usan texto de 16 px y los controles tienen altura suficiente para tocarse.

Los `label` identifican campos; `aria-label` explica los botones que solo muestran un ícono; `role="status"` anuncia confirmaciones y `role="alert"` anuncia errores. También hay foco visible y un enlace para saltar al contenido usando teclado.

## 9. Mapa de archivos

| Archivo | Responsabilidad |
| --- | --- |
| `index.html` | Documento inicial, idioma y contenedor de React. |
| `src/main.tsx` | Monta React y carga los estilos. |
| `src/App.tsx` | Estado compartido, acciones y organización de la pantalla. |
| `src/components/ShoppingList.tsx` | Pendientes, filtro y botones para operar sobre cada producto. |
| `src/components/ProductForm.tsx` | Alta, sugerencias, validación visible y edición de cantidades. |
| `src/components/Icon.tsx` | Pequeños íconos SVG reutilizados. |
| `src/types.ts` | Contratos de datos y unidades disponibles. |
| `src/data.ts` | Crea los ejemplos de cada nueva sesión. |
| `src/lib/shopping.ts` | Comparación de nombres, validación y operaciones de datos. |
| `src/lib/storage.ts` | Validación, lectura y escritura de la copia local versionada. |
| `tests/storage.test.ts` | Recuperación, formatos inválidos y errores del almacenamiento. |
| `src/index.css` | Tailwind, colores y estilos compartidos. |
| `tests/shopping.test.ts` | Casos importantes de lógica con Node. |
| `vite.config.ts` | Conecta los plugins de React y Tailwind con Vite. |
| `tsconfig*.json` | Configuran TypeScript para navegador y herramientas/pruebas. |
| `package.json` / `package-lock.json` | Comandos, dependencias y versiones reproducibles. |

`StrictMode` en `main.tsx` activa comprobaciones adicionales de React durante el desarrollo. Puede repetir ciertos cálculos y efectos para detectar problemas; no significa que haya dos listas ni debe producir altas duplicadas.

## 10. Cómo explorar sin perderse

Primero recorré la interfaz siguiendo el README. Después seguí una sola acción, desde el botón hasta `setState`, con el mapa anterior. Podés cambiar un producto de `data.ts` o un color de `index.css` y observar la actualización automática de Vite.

Ejecutá `npm.cmd test` y leé el caso de duplicados: crea un estado, realiza una operación y comprueba el resultado con `assert`, parecido a las aserciones de Python. Estas funciones no necesitan navegador ni React para probarse.

Las compras parciales ya están implementadas. El siguiente aprendizaje será guardar y recuperar los datos, conservando las validaciones.

## 11. Compras parciales e historial (segunda entrega)

`recordPurchase` recibe el estado, el producto, la cantidad comprada, un identificador y una fecha. Recibir esos valores mantiene la función independiente del reloj y del navegador y facilita probarla. `App` genera la fecha con `new Date().toISOString()`, en UTC; `PurchaseHistory` la muestra en el horario local del navegador con `Intl.DateTimeFormat`.

La operación valida que la compra sea positiva, respete la unidad y no supere el pendiente. Si hay cinco huevos y comprás tres, conserva dos y registra tres comprados. Al comprar los dos restantes retira el pendiente y agrega otro evento. Ambos cambios ocurren en un mismo objeto nuevo, sin estados intermedios inconsistentes.

JavaScript usa coma flotante: `0.3 - 0.1` puede producir una aproximación. Como admitimos hasta tres decimales, restamos en milésimas enteras y dividimos por mil al final. Así quedan exactamente `0.2` litros pendientes.

El nuevo tipo `Purchase` conserva nombre, unidad, cantidad, fecha e identificador. Guardar el nombre y la unidad es una instantánea del momento de la compra; permitirá preservar los registros si más adelante se edita el catálogo. `ShoppingState.history` contiene estos eventos, del más reciente al más antiguo.

`PurchaseDialog.tsx` usa el elemento HTML nativo `dialog`. `showModal()` lo abre y mantiene el teclado dentro de la ventana. Un efecto lo cierra al desmontar el componente. Cancelar o presionar Escape solo cierra el formulario; confirmar valida antes de modificar datos. `PurchaseHistory.tsx` muestra los eventos usando sus identificadores como claves.

Todavía no hay persistencia: pendientes e historial se reinician al recargar. Registrar una compra no calcula stock disponible en casa.

## 12. Conservar los datos (tercera entrega)

En las etapas anteriores recargar reiniciaba todo. Ahora `src/lib/storage.ts` lee una copia de los datos desde `localStorage`, un almacén de texto del navegador. `JSON.stringify` convierte el estado a texto y `JSON.parse` lo recupera, de manera parecida a `json.dumps` y `json.loads` de Python.

Al iniciar, `App` llama a `loadState` mediante el inicializador de `useState`. Si no existe una copia, usa los ejemplos; si existe y es válida, la usa incluso si la lista está vacía. Un segundo estado conserva esos datos activos. Cada acción actualiza React como antes; un `useEffect` detecta el nuevo estado y llama a `saveState`. Este efecto sincroniza React con un sistema externo: el almacenamiento del navegador. No se guardan los campos a medio escribir ni los mensajes.

La copia tiene una versión para poder distinguir cambios de formato futuros. Al leer JSON no alcanza con escribir `as ShoppingState`: eso solo convencería al compilador. `isShoppingState` comprueba los valores realmente recibidos. Su retorno `value is ShoppingState` es un predicado de tipos: si la validación tiene éxito, TypeScript permite tratar ese valor como nuestro estado.

`try/catch` permite controlar errores, como en Python. Un navegador puede bloquear el almacenamiento o agotar el espacio. Si falla el guardado, la aplicación sigue en memoria y avisa. Si no puede leer o validar una copia, evita sobrescribirla con los ejemplos. Las pruebas usan un objeto pequeño con `getItem` y `setItem`, de modo que podemos simular lectura, escritura y errores sin navegador.

Esto no es todavía una base de datos compartida: cada origen y perfil del navegador tiene su almacenamiento. Usá una sola pestaña para editar; dos pestañas pueden guardar estados distintos y la última escritura reemplaza la anterior. El README explica las limitaciones y cómo probar la recarga. Los textos sobre memoria de las secciones anteriores describen las primeras etapas; esta sección documenta el comportamiento actual.

## 13. Cuentas, familias y permisos (cuarta entrega)

Hasta ahora, navegador y almacenamiento local resolvían toda la aplicación. Ahora incorporamos un servicio que se ejecuta fuera de tu computadora: Supabase ofrece PostgreSQL y Auth. Esta entrega conecta las cuentas y familias; la lista de compras todavía usa el almacenamiento anterior. La separación es temporal y está indicada en pantalla.

**Autenticación** responde quién sos: correo y contraseña se envían por el cliente oficial a Supabase Auth. No guardamos contraseñas en tablas propias. Al ingresar, Auth devuelve una sesión con tokens que el cliente administra y adjunta a las consultas. `onAuthStateChange` avisa cambios; el efecto devuelve una función que cancela la suscripción al desmontar el componente. Las consultas asíncronas descartan respuestas si el componente ya se desmontó.

**Autorización** responde qué podés hacer: estar autenticado no permite ver cualquier familia. RLS (seguridad por fila) filtra los registros desde PostgreSQL según `auth.uid()`, el identificador que obtiene de la sesión verificada. No alcanza con ocultar botones en React: alguien puede enviar consultas fuera de la interfaz.

`families` guarda la familia y su responsable; `family_members` relaciona usuarios con familias. Una clave primaria por usuario impide pertenecer a dos familias en este MVP. Las claves foráneas cumplen un papel parecido a las referencias entre objetos, con validación adicional en la base. Las referencias de compras incluyen la familia para impedir relaciones cruzadas entre dos hogares.

Para crear una familia hay que insertar la familia y su primer integrante. Una función PostgreSQL hace ambas cosas como una operación transaccional: si algo falla, no queda una familia a medias. El cliente la llama con `rpc`, una llamada a una función remota. Las funciones `create_family`, `create_family_invite` y `join_family` derivan el usuario de la sesión: no confían en un identificador de usuario enviado por el formulario.

Estas funciones usan `security definer`: ejecutan con los permisos de quien las creó, por lo que pueden realizar las escrituras controladas que el navegador no puede hacer directamente. Por eso verifican la identidad y sus reglas, tienen un `search_path` fijo y solo se concede ejecución al rol autenticado. La función privada de lectura de membresía evita que una política de integrantes se consulte recursivamente a sí misma.

Una invitación permite una incorporación. Al usarla, PostgreSQL bloquea su fila hasta terminar la transacción; así dos solicitudes no pueden consumirla a la vez. Un bloqueo por usuario también evita dos altas simultáneas en familias distintas. No copiamos datos locales al entrar: esa decisión se implementará explícitamente con la sincronización.

Archivos nuevos: `src/lib/supabase.ts` crea el cliente si hay configuración; `src/components/AccountPanel.tsx` contiene acceso y gestión familiar; `supabase/migrations/0001_accounts_and_families.sql` define tablas, permisos y funciones; `supabase/tests/accounts_and_families.sql` comprueba esas reglas y termina con `ROLLBACK` para descartar datos ficticios. La guía `docs/configurar-supabase.md` conecta estas piezas con tu proyecto real.

Las variables de Vite que empiezan por `VITE_` llegan al navegador. Por eso solo usamos una URL y una clave pública, nunca contraseñas de PostgreSQL ni claves secretas. La clave pública identifica al proyecto; los permisos reales dependen de la sesión y de RLS. Referencias: [Auth con React](https://supabase.com/docs/guides/auth/quickstarts/react), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [funciones PostgreSQL](https://supabase.com/docs/guides/database/functions).

## 14. Compartir datos sin perder consistencia (quinta entrega)

Ahora la cuenta determina la familia y su lista. `App` recibe esa familia desde el panel de cuentas y monta `ShoppingWorkspace` con una clave que combina usuario y familia. Cambiarla desmonta el contexto anterior, cerrando formularios y descartando sus solicitudes. Sin familia se mantiene un espacio local separado.

Un **hook propio** es una función que compone hooks de React para una necesidad de la aplicación. `useShoppingData` devuelve estado, carga, errores y operaciones. En modo local usa las funciones anteriores y localStorage; en modo familiar llama a Supabase. No es otro servidor ni una biblioteca de estado global.

Las llamadas remotas devuelven **promesas**. `async/await` permite esperar la confirmación antes de mostrar éxito, de forma parecida al código asíncrono de Python. Por eso los formularios ahora esperan `onAdd` y `onSave`, muestran errores y deshabilitan sus controles mientras guardan. La información ingresada permanece si la operación falla.

Un efecto consulta la lista al entrar y prepara un temporizador de tres segundos. También escucha foco y reconexión. Su limpieza elimina temporizadores y eventos y cancela lecturas al desmontar. `useRef` guarda controles que no necesitan dibujarse: la solicitud actual, su identificador y una secuencia de lecturas. `useCallback` mantiene estable la función de actualización entre renders mientras no cambie la familia; así el efecto no se reinicia por cualquier cambio de la pantalla.

No aplicamos respuestas antiguas: cada lectura tiene un número de secuencia. Si llega después de otra lectura o de iniciar una escritura, se descarta. Esto evita que una respuesta lenta reemplace información más reciente. `AbortController` permite cancelar la petición y fijar un límite de espera; no garantiza cancelar una transacción que el servidor ya recibió.

En PostgreSQL, `get_family_shopping` construye la instantánea de catálogo, pendientes e historial con una sola consulta y las políticas RLS existentes. La función de escritura recibe un tipo de acción y sus datos. Sus tipos en TypeScript forman una **unión discriminada**: `type: 'buy'` exige producto y cantidad; `type: 'add'` exige nombre y unidad. El servidor no confía en esos tipos y valida de nuevo.

Para comprar se necesita una **transacción**: bajar la cantidad y crear el historial deben ocurrir juntos. `mutate_shopping` bloquea la fila de la familia para ordenar sus escrituras. Como todas pasan por esta función y el cliente no puede escribir tablas directamente, dos altas simultáneas no duplican un producto.

El bloqueo no alcanza para saber si una persona estaba mirando una cantidad vieja. Cada pendiente tiene una versión UUID que cambia al editar o comprar. El formulario guarda la versión que mostró al abrirse. Si otra persona actuó después, PostgreSQL detecta la diferencia y rechaza la operación. Se conoce como control de concurrencia optimista: no bloqueamos la pantalla de otro integrante mientras alguien piensa qué comprar.

También hay un identificador por solicitud. Si el servidor guardó una compra pero se perdió la respuesta, repetir la misma solicitud recupera su resultado sin ejecutar otra compra. Esta propiedad se llama **idempotencia**. Es distinta del control de versiones: la versión protege frente a decisiones simultáneas; el identificador protege frente a reintentar la misma decisión.

`private.shopping_operations` conserva esos resultados fuera de las tablas accesibles al navegador. La función verifica que usuario, acción y datos coincidan antes de reutilizarlos. Las compras toman autor y fecha del servidor. El historial local anterior se conserva, pero no se atribuye artificialmente a quien haga la importación.

Los archivos principales nuevos son `src/hooks/useShoppingData.ts`, `src/components/ShoppingWorkspace.tsx`, `src/lib/shared-shopping.ts`, la migración `0002_shared_shopping.sql` y sus pruebas SQL. `shared-shopping.ts` valida respuestas y prepara los datos de importación. Los tipos ayudan al compilar; los validadores protegen al recibir información real.

El [recorrido de sincronización](sincronizacion.md) explica cómo probarlo con dos cuentas y qué hacer ante conflictos. Las secciones anteriores describen las etapas históricas: desde esta entrega, la lista familiar sí se guarda en Supabase y la copia local queda independiente. Referencia para las llamadas: [funciones RPC de Supabase](https://supabase.com/docs/reference/javascript/rpc).

## 15. Catálogo y reversión (sexta entrega)

Ahora una navegación con botones muestra Lista, Catálogo o Historial mediante un estado `view`. No son tres aplicaciones ni tres rutas de servidor: React muestra el componente correspondiente dentro de `ShoppingWorkspace`. `CatalogPanel` conserva sus campos de edición y filtro; la lógica de escritura sigue pasando por `useShoppingData`.

Quitar un producto no lo elimina físicamente: cambia `active` a falso. Esto se llama archivado o borrado lógico. Las referencias del historial siguen apuntando a un producto existente y podemos recuperarlo. Las sugerencias filtran solo los activos, mientras los pendientes muestran también los productos archivados que todavía hacen falta comprar.

Al renombrar un producto, las filas pendientes muestran el nombre nuevo; las compras conservan el nombre original porque guardaban una instantánea. La unidad queda fija. Cada cambio de catálogo reemplaza una revisión UUID; si otro integrante modificó el mismo producto, una edición vieja se rechaza como ocurría con las cantidades.

Revertir representa una corrección de negocio, no borrar una fila. En una transacción, el servidor valida el permiso, devuelve la cantidad a pendientes y marca la compra con `reverted_at` y `reverted_by`. Si ya estaba revertida, no suma nada otra vez. El historial habitual filtra las revertidas, pero una casilla permite inspeccionarlas.

El permiso compara la identidad de la sesión con el autor de la compra o el responsable familiar. La interfaz oculta el botón cuando no corresponde y la función SQL vuelve a verificarlo: esconder un botón por sí solo no protege datos.

`src/lib/shopping.ts` incorpora las mismas reglas para el modo local. Las propiedades nuevas son opcionales en los tipos locales para leer copias anteriores sin borrarlas; al recibir una instantánea de Supabase exigimos su versión de esquema nueva. La migración 0003 añade columnas y adapta la API sin destruir los datos existentes.

`vercel.json` describe cómo construir la aplicación y dónde encontrar sus archivos. Vercel alojará esos archivos; Supabase seguirá guardando usuarios y datos. Por eso publicar una versión nueva de React no equivale a reiniciar la base de datos. Los cambios SQL requieren una migración aparte. La guía [publicar-vercel.md](publicar-vercel.md) explica el primer despliegue y las actualizaciones posteriores desde GitHub.
