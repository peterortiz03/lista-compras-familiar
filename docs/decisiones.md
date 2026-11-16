# Decisiones del proyecto

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
