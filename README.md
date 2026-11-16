# Lista de Compras Familiar

**En casa** es una aplicación para organizar las compras del hogar. Esta segunda entrega es una interfaz local con datos temporales, construida con React, TypeScript, Vite y Tailwind CSS.

## Requisitos

- Windows con PowerShell, Git y npm.
- Node.js **22.18 o superior**, compatible con Vite; preferentemente una versión LTS vigente. Verificado con Node 26.13.1 y npm 11.20.0.
- Un navegador moderno actualizado.

## Instalación y ejecución

Desde PowerShell, en la carpeta del repositorio:

```powershell
cd "C:\Users\Pedro Peter\Repositorios GitHub\lista-compras-familiar"
npm.cmd ci
npm.cmd run dev
```

Abrí la dirección que muestre Vite, normalmente `http://localhost:5173`. Para detenerlo, presioná `Ctrl+C` en esa terminal. `npm.cmd` evita el bloqueo de `npm.ps1` por la política de ejecución de PowerShell, sin modificarla.

`npm ci` instala las versiones fijadas en `package-lock.json`. Cuando agregues o cambies dependencias, usá `npm.cmd install` para actualizar ese archivo.

## Estado actual

- Productos de ejemplo y lista de pendientes con búsqueda.
- Alta de productos con cantidad y unidad.
- Sugerencias del catálogo, sin distinguir tildes, mayúsculas o espacios repetidos.
- Prevención de duplicados: ofrece editar el pendiente existente, sin sumar cantidades automáticamente.
- Edición de cantidades, eliminación y registro de compras completas o parciales.
- Catálogo que crece durante la sesión y conserva los productos retirados de pendientes.
- Diseño adaptable a celulares y computadoras, etiquetas accesibles y botones táctiles.

**Los datos están solo en memoria.** Recargar o cerrar la página restaura los ejemplos iniciales. Cada pestaña tiene su propia lista. Todavía no hay guardado, cuentas ni sincronización familiar.

## Comprobaciones

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

`build` comprueba TypeScript y genera la versión de producción en `dist/`; `lint` revisa problemas de código con Oxlint, incluido en la plantilla oficial de Vite; `test` ejecuta nueve casos de lógica con el ejecutor incorporado de Node. No se instaló un framework de pruebas.

Para abrir localmente la compilación:

```powershell
npm.cmd run preview
```

Este comando requiere haber ejecutado `build` y no publica la aplicación.

## Recorrido de prueba visual

1. Al abrir la página, comprobá los cinco pendientes y el aviso de datos temporales.
2. En **Agregar producto**, escribí `Manz`: elegí **Manzanas**, indicá `1,5` kg y agregalas. Buscalas en pendientes.
3. Intentá agregar ` LECHE `: debe avisar que ya está pendiente. Elegí **Editar cantidad existente**, cambiá a `3` y guardá. La lista debe conservar una sola Leche.
4. Tocá la cantidad de Huevos. Probá `0` o `1,5`: debe rechazarlos. Guardá `6` y comprobá la actualización.
5. Agregá un producto nuevo, como Yerba, en paquetes. Eliminá ese pendiente con la papelera y volvé a escribir su nombre: debe aparecer en sugerencias.
6. Tocá el círculo de Leche. Probá una cantidad superior a la pendiente: debe rechazarse. Confirmá una cantidad menor: debe reducir el pendiente y crear un registro en el historial. Luego comprá el resto: debe salir de pendientes y crear otro registro. Cancelar o presionar Escape no debe cambiar nada.
7. Buscá un texto inexistente y limpiá el filtro. Retirá todos los pendientes para ver la lista vacía.
8. En las herramientas del navegador (`F12`), probá una pantalla de 390 px de ancho y otra de escritorio. Recorré también los controles con `Tab` y activalos con el teclado.
9. Recargá: deben reaparecer los ejemplos, sin las modificaciones de esta sesión.

## Próximas entregas

Faltan persistencia, cuentas individuales, familias y sincronización con Supabase. PWA y publicación en Vercel quedan para después. No se incluyen precios, comercios, notificaciones, stock, códigos de barras ni tickets.

El próximo paso sugerido es guardar los datos localmente para que sobrevivan a una recarga; después podremos incorporar cuentas y acceso familiar con Supabase.

- [Decisiones funcionales y técnicas](docs/decisiones.md)
- [Guía de aprendizaje](docs/guia-aprendizaje.md)

## Uso local y publicación

Vite debe seguir abierto para acceder a la aplicación. Una página ya cargada puede seguir funcionando en memoria al detenerlo, pero no podrá cargarse de nuevo. `preview` también requiere un servidor abierto. Cuando se publique, el alojamiento servirá la aplicación sin depender de tu computadora. Esa etapa todavía no está implementada.
