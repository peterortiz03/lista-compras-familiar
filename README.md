# Lista de Compras Familiar

**En casa** es una aplicación para organizar las compras del hogar. Esta cuarta entrega incorpora el código de cuentas y familias con Supabase y mantiene la lista con guardado local en el navegador, construida con React, TypeScript, Vite y Tailwind CSS.

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
- Catálogo que crece con el uso y conserva los productos retirados de pendientes.
- Diseño adaptable a celulares y computadoras, etiquetas accesibles y botones táctiles.

**La lista, el catálogo y el historial se guardan automáticamente en este navegador con localStorage.** Recargar o cerrar la página conserva los cambios si el navegador permite guardarlos. Los ejemplos aparecen solo cuando no hay datos previos. Las cuentas y familias requieren configurar Supabase; la lista todavía no se sincroniza ni se asocia a esas cuentas; usá una sola pestaña para evitar que una versión antigua reemplace cambios de otra.

## Comprobaciones

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

`build` comprueba TypeScript y genera la versión de producción en `dist/`; `lint` revisa problemas de código con Oxlint, incluido en la plantilla oficial de Vite; `test` ejecuta trece casos de lógica con el ejecutor incorporado de Node. No se instaló un framework de pruebas.

Para abrir localmente la compilación:

```powershell
npm.cmd run preview
```

Este comando requiere haber ejecutado `build` y no publica la aplicación.

## Recorrido de prueba visual

1. Al abrir la página, comprobá los cinco pendientes y el aviso de guardado local.
2. En **Agregar producto**, escribí `Manz`: elegí **Manzanas**, indicá `1,5` kg y agregalas. Buscalas en pendientes.
3. Intentá agregar ` LECHE `: debe avisar que ya está pendiente. Elegí **Editar cantidad existente**, cambiá a `3` y guardá. La lista debe conservar una sola Leche.
4. Tocá la cantidad de Huevos. Probá `0` o `1,5`: debe rechazarlos. Guardá `6` y comprobá la actualización.
5. Agregá un producto nuevo, como Yerba, en paquetes. Eliminá ese pendiente con la papelera y volvé a escribir su nombre: debe aparecer en sugerencias.
6. Tocá el círculo de Leche. Probá una cantidad superior a la pendiente: debe rechazarse. Confirmá una cantidad menor: debe reducir el pendiente y crear un registro en el historial. Luego comprá el resto: debe salir de pendientes y crear otro registro. Cancelar o presionar Escape no debe cambiar nada.
7. Buscá un texto inexistente y limpiá el filtro. Retirá todos los pendientes para ver la lista vacía.
8. En las herramientas del navegador (`F12`), probá una pantalla de 390 px de ancho y otra de escritorio. Recorré también los controles con `Tab` y activalos con el teclado.
9. Agregá un producto nuevo, registrá una compra parcial y recargá: deben conservarse el producto, la cantidad restante y el historial. Cerrá y volvé a abrir la página con la misma dirección y navegador.

## Próximas entregas

El código de cuentas individuales, familias e invitaciones está preparado. Falta crear el proyecto Supabase y verificar el flujo real de correo y acceso. Después faltan persistencia compartida y sincronización de las compras. PWA y publicación en Vercel quedan para después. No se incluyen precios, comercios, notificaciones, stock, códigos de barras ni tickets.

Primero completaremos la configuración y la verificación real de cuentas y familias. Después conectaremos las compras y la sincronización, y realizaremos una revisión integral del MVP.

- [Decisiones funcionales y técnicas](docs/decisiones.md)
- [Guía de aprendizaje](docs/guia-aprendizaje.md)

## Uso local y publicación

Vite debe seguir abierto para acceder a la aplicación. Una página ya cargada puede seguir funcionando en memoria al detenerlo, pero no podrá cargarse de nuevo. `preview` también requiere un servidor abierto. Cuando se publique, el alojamiento servirá la aplicación sin depender de tu computadora. Esa etapa todavía no está implementada.

## Límites del guardado local

Los datos pertenecen al navegador, perfil y origen (protocolo, dirección y puerto). `localhost:5173` y `127.0.0.1:5173` guardan listas distintas. Usá siempre la misma dirección. Otro dispositivo no verá esta lista. Limpiar los datos del sitio elimina la copia local; el modo privado puede descartarla al cerrar. Esto no es una copia de seguridad ni permite todavía cargar la aplicación sin el servidor.

Si aparece un aviso de guardado fallido, los cambios actuales siguen en memoria: evitá recargar hasta revisar permisos o espacio. Si los datos recuperados son inválidos, se muestran ejemplos temporales y no se sobrescribe la copia existente. No hay migraciones de formatos futuros todavía. Para empezar de cero deliberadamente, en las herramientas del navegador podés eliminar solo la clave `en-casa:shopping:v1` de Local Storage y recargar; esa acción borra la lista local y el historial.

## Etapas pendientes

Con el guardado local completo, proponemos tres etapas para cerrar el MVP: cuentas y familias con Supabase y sus permisos; sincronización compartida y manejo de errores; revisión integral de los flujos familiares. PWA y publicación quedan para después. Esta división puede ajustarse durante la integración.

## Cuentas y familias — cuarta entrega

Seguí [la guía para configurar Supabase](docs/configurar-supabase.md). Incluye crear el proyecto, ejecutar la migración y sus pruebas SQL, configurar el correo y copiar `.env.example` a `.env.local`. No es necesario configurar Supabase para seguir usando la lista local.

El código permite registrarse, ingresar y cerrar sesión; crear una familia; generar una invitación de un uso con vencimiento de 7 días; incorporarse con ella y consultar integrantes. Cada cuenta pertenece a una sola familia. El aislamiento se aplica en PostgreSQL mediante RLS y funciones autorizadas.

**La lista inferior sigue siendo local e independiente de la cuenta.** No se comparte, se importa ni cambia al ingresar o cerrar sesión. Sus datos pueden verlos quienes usen el mismo perfil de navegador. La integración de las compras con Supabase corresponde a la siguiente etapa.

El esquema y sus pruebas de permisos pasaron en un PostgreSQL temporal local con identidades simuladas. Todavía queda probar Auth, correo e invitaciones con cuentas reales en tu proyecto; no se creó ningún servicio ni se publicó la aplicación.
