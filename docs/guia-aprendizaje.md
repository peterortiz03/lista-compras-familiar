# Cómo funciona la aplicación — Entrega 1

## 1. Qué corre y dónde

Cuando ejecutás `npm.cmd run dev`, **Vite** inicia un servidor de desarrollo en tu computadora. El navegador le pide `index.html`, que contiene el contenedor `root` y carga `src/main.tsx`. Ese archivo inicia **React**, que muestra `App` dentro del contenedor.

La aplicación y sus datos viven en el navegador. El servidor de Vite sirve código y refleja cambios mientras programás; todavía no es un servidor de negocio ni una base de datos. Cerrar la terminal detiene Vite. Recargar la página vuelve a ejecutar el programa con los ejemplos iniciales.

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

Comprar y eliminar usan por ahora `removePending`: ambas acciones retiran el pendiente y muestran mensajes diferentes. No se crea historial. En la siguiente etapa la compra tendrá su propio registro.

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
| `src/index.css` | Tailwind, colores y estilos compartidos. |
| `tests/shopping.test.ts` | Casos importantes de lógica con Node. |
| `vite.config.ts` | Conecta los plugins de React y Tailwind con Vite. |
| `tsconfig*.json` | Configuran TypeScript para navegador y herramientas/pruebas. |
| `package.json` / `package-lock.json` | Comandos, dependencias y versiones reproducibles. |

`StrictMode` en `main.tsx` activa comprobaciones adicionales de React durante el desarrollo. Puede repetir ciertos cálculos y efectos para detectar problemas; no significa que haya dos listas ni debe producir altas duplicadas.

## 10. Cómo explorar sin perderse

Primero recorré la interfaz siguiendo el README. Después seguí una sola acción, desde el botón hasta `setState`, con el mapa anterior. Podés cambiar un producto de `data.ts` o un color de `index.css` y observar la actualización automática de Vite.

Ejecutá `npm.cmd test` y leé el caso de duplicados: crea un estado, realiza una operación y comprueba el resultado con `assert`, parecido a las aserciones de Python. Estas funciones no necesitan navegador ni React para probarse.

Al agregar compras parciales ampliaremos los datos y las funciones antes de conectar una base de datos. Esta guía se actualizará con los conceptos que realmente incorporemos en esa etapa.
