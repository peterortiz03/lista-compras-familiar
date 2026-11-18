# Fotografías del catálogo

## Corrección de compatibilidad iOS (0007)

Estado: el usuario confirmó 0007 y autorizó la publicación. Se verificaron en producción la reserva con formato, la columna de MIME esperado y el bucket privado con WebP/JPEG y 256 KiB. Falta validar con un iPhone físico. Las instrucciones de aplicación siguientes quedan para instalaciones nuevas: no repitas migraciones en el proyecto actual.

La versión anterior exigía que `canvas.toBlob` generara WebP. Un navegador puede leer ese formato sin poder exportarlo y devolver PNG al solicitar un tipo no compatible. No es evidencia de que esté desactualizado. Ver [comportamiento de toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

Ahora se decodifica con la imagen nativa (orientación incluida), se intenta WebP y, si falla, devuelve null o un tipo diferente, se intenta JPEG. Se prueban tres calidades y reducciones adicionales hasta un lado máximo de 256 px si hace falta; inicialmente se conservan los 512 px. Se mantiene el límite de 256 KiB, sin estirar. JPEG recibe fondo blanco para transparencias. Si nada funciona, el error conserva la foto guardada.

Entrada: JPG, PNG, WebP y HEIC/HEIF únicamente si el navegador logra decodificarlos; en caso contrario se solicita exportar JPEG. No hay conversor HEIC adicional. Salida: WebP `.webp` o JPEG `.jpg`, con MIME coherente en reserva y subida. La confirmación SQL compara el MIME de metadata de Storage y la extensión con el formato autorizado por la reserva; no lee los bytes binarios desde PostgreSQL.

### Orden de activación y prueba

1. Con aprobación explícita, abrir SQL Editor y ejecutar completo [`0007_photo_format_compatibility.sql`](../supabase/migrations/0007_photo_format_compatibility.sql) **una sola vez después de 0006**. No repetir 0001–0006. Si hay error, no publicar y conservar el mensaje.
2. La migración añade el MIME esperado a las reservas (WebP para las anteriores), habilita JPEG en el bucket privado y reemplaza las funciones de reserva/confirmación. Conserva la firma antigua para clientes WebP. No borra objetos ni productos, no cambia políticas ni límite, y no necesita redeplegar la limpieza: ya funciona por ruta sin filtrar extensiones.
3. Verificar en Storage que `product-photos` siga privado, con 262144 bytes y MIME `image/webp` e `image/jpeg`. Después autorizar la publicación del frontend. No hacen falta variables ni secretos nuevos.
4. Desde iPhone/Safari, elegir JPG y PNG; revisar vista previa, guardar y agregar a pendientes. En otra cuenta/dispositivo de la familia debe aparecer la misma foto tras actualizar. Repetir con cámara, Chrome en iOS y HEIC real; un HEIC no decodificable debe pedir JPEG.
5. Reemplazar una foto existente, cancelar otra edición y quitarla. La foto anterior debe conservarse ante procesamiento/subida fallidos y los descartes seguir limpiándose. Una respuesta final perdida exige actualizar antes de reintentar.

El catálogo ahora usa un grupo foto/texto y otro de acciones: en celulares van uno debajo del otro y en escritorio comparten fila. El nombre usa el ancho restante y solo rompe una palabra si no cabe completa. No se modificaron pendientes, historial ni sugerencias.

Verificado: build, lint, 27 pruebas Node; SQL en PostgreSQL temporal (0001–0007, permisos y pruebas previas, JPEG, rechazo de MIME/extensión incoherentes y limpieza). Chrome con WebP nativo y falta de codificador simulada mediante PNG, null y excepción; JPEG correcto en los tres casos, reducción extra y error específico para HEIC inválido. Catálogo real revisado a 320/375/430/1440 px, con fotos, íconos, favoritos y nombres largos, sin desbordes. No equivale a una prueba en Safari/iPhone real ni a una carga en Storage de producción.

La configuración de producción está completa, con autorización del usuario tras iniciar sesión en Supabase CLI. Se comprobó que 0006 ya estaba aplicada y no se repitió. Se desplegó `cleanup-product-photos` con Verify JWT desactivado y validación propia de secreto, se configuraron Vault, pg_cron y pg_net y se programó la limpieza cada 15 minutos. La llamada sin secreto devolvió 401; con secreto, 200. La llamada desde PostgreSQL usando Vault también devolvió 200 sin fallos. No se crearon productos o cuentas de prueba en producción. Los pasos siguientes quedan como referencia para instalaciones nuevas: no hay que repetirlos en el proyecto actual.

## Qué cambia

Cada producto familiar puede tener una fotografía opcional. Desde Catálogo → Crear/Editar se puede elegir archivo, abrir la cámara cuando el dispositivo lo admita, revisar la vista previa y guardar, reemplazar o quitar. Quitar foto no quita el producto. Archivar un producto conserva su foto porque también conserva pendientes e historial.

Se admiten JPG, PNG y WebP de hasta 12 MiB; se rechazan SVG, GIF y HEIC con un mensaje. En iPhone, si la cámara entrega HEIC, elegí/exportá una versión JPG. No se incorpora un conversor pesado. El navegador aplica orientación EXIF, reduce el lado mayor a 512 px sin ampliar ni deformar, y exporta WebP de hasta 256 KiB. La miniatura cuadrada usa recorte proporcional; el archivo conserva su proporción.

Las fotos se muestran en pendientes y catálogo; las sugerencias siguen siendo compactas y el historial no incorpora fotos. Si no hay imagen o falla su descarga, aparece un ícono vectorial de categoría. El modo local mantiene su presentación anterior y no permite fotografías ni consulta Storage.

## Activar en Supabase: orden exacto

Estos pasos modifican producción y deben realizarse **solo después de revisar y aprobar esta configuración**. No repitas 0001–0005. Conviene probar primero en un proyecto de desarrollo con las migraciones previas.

### 1. Migración 0006

En el mismo proyecto Supabase, SQL Editor → New query. Pegá completo [`0006_product_photos.sql`](../supabase/migrations/0006_product_photos.sql), desde `begin` hasta `commit`, y ejecutá una vez.

La migración:

- Crea el bucket **privado** `product-photos`, con límite 256 KiB y MIME `image/webp`. No lo crees manualmente ni lo hagas público. Si ya existe un bucket con ese nombre, detenete y revisá el conflicto; la migración falla sin sobrescribirlo.
- Agrega `products.photo_path`, inicialmente NULL. No borra ni reclasifica productos, pendientes o compras.
- Crea un registro privado de cargas, referencias y limpieza; solo guarda rutas/estado, nunca los bytes de las imágenes.
- Agrega permisos familiares de lectura, carga y limpieza; bloquea sobrescrituras y accesos anónimos incluso frente a políticas permisivas genéricas. No cambia las políticas de otros buckets.
- Amplía la API de forma aditiva (`schemaVersion: 3`, `featuresVersion: 6`). Los clientes anteriores siguen funcionando. Antes de 0006, el código nuevo también funciona, pero no ofrece carga de fotos.

Si aparece un error, no publiques ni repitas migraciones anteriores. Guardá el mensaje y ejecutá `ROLLBACK;` si la consulta quedó en una transacción fallida.

Comprobación en SQL Editor:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'product-photos';
select count(*) as productos_con_foto from public.products where photo_path is not null;
```

Debe mostrar `public = false`, `262144`, `{image/webp}` y cero fotos inicialmente. Los productos anteriores deben seguir apareciendo.

### 2. Desplegar la función de limpieza

En **Edge Functions → Deploy a new function → Via Editor** (los nombres pueden variar), creá `cleanup-product-photos`. Reemplazá el código de `index.ts` por [`supabase/functions/cleanup-product-photos/index.ts`](../supabase/functions/cleanup-product-photos/index.ts). Desactivá **Verify JWT / Enforce JWT verification** para esta función: la propia función exige un secreto exclusivo y rechaza solicitudes sin él. El archivo `supabase/config.toml` deja la misma configuración para futuros despliegues por CLI.

En **Edge Functions → Secrets**, agregá `PHOTO_CLEANUP_SECRET`: generá un valor aleatorio fuerte en PowerShell y guardalo solo en tu gestor de contraseñas, el panel y Vault:

```powershell
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

No lo envíes al chat, no lo subas a Git ni lo pongas en Vercel o variables `VITE_`. La función usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, disponibles en el entorno de Edge Functions; la clave privilegiada permanece en el servidor. No se configura una clave de servicio en el frontend.

Guardá/desplegá la función. No cambies ajustes de otras funciones. Alternativa si ya usás Supabase CLI autenticada: `supabase functions deploy cleanup-product-photos --remote=TU_REFERENCIA --no-verify-jwt --use-api`; el secreto se configura igualmente desde el panel.

### 3. Programar limpieza cada 15 minutos

En Supabase habilitá **Cron (pg_cron)** y **pg_net** desde Integrations/Database → Extensions si todavía no están habilitados. No agregamos esas extensiones automáticamente en 0006.

En Vault (o en SQL Editor) creá estos dos secretos una sola vez. Reemplazá los ejemplos; el segundo debe ser exactamente el mismo valor de `PHOTO_CLEANUP_SECRET`:

```sql
select vault.create_secret('https://TU-PROYECTO.supabase.co', 'photo_project_url');
select vault.create_secret('PEGAR_EL_SECRETO_ALEATORIO', 'photo_cleanup_secret');
```

Luego ejecutá [`supabase/setup/schedule_photo_cleanup.sql`](../supabase/setup/schedule_photo_cleanup.sql) completo. Este archivo programa la función; **no es una migración histórica ni contiene secretos**. En Cron debe aparecer `cleanup-product-photos`, activo, con `*/15 * * * *`. Las solicitudes usan un encabezado secreto; no aceptan la clave pública como autorización del trabajador.

Usá la opción Test de la función con método POST y el encabezado `x-photo-cleanup-secret` con tu valor. Debe devolver 200 y `{"cleaned":0,"failed":0}` si no hay pendientes. Sin el encabezado debe devolver 401. Después de un ciclo, revisá Cron/Edge Function Logs y `net._http_response` para comprobar la respuesta. No publiques imágenes privadas ni secretos en capturas de logs.

Si falla, los trabajos permanecen registrados para reintento. No borres filas de `storage.objects` por SQL: eso no elimina el archivo físico. Todas las eliminaciones reales se hacen mediante la API de Storage. Consultá [borrado de objetos](https://supabase.com/docs/guides/storage/management/delete-objects) y [programación de funciones](https://supabase.com/docs/guides/functions/schedule-functions).

### 4. Probar y publicar la web

Con las tres configuraciones anteriores listas, ejecutá `npm.cmd run dev` en la rama de fotos, usando tu `.env.local` habitual. No hace falta agregar variables de frontend. **Las pruebas locales contra ese proyecto también escriben en los datos familiares reales**: elegí un producto de prueba sin alterar compras existentes.

La integración en main y publicación fueron autorizadas al delegar los pasos restantes. Para futuras instalaciones, verificá los pasos siguientes antes de publicar. El push a main activará Vercel normalmente; no hace falta crear otro proyecto ni volver a configurar Auth. La regla de Vercel deshabilita únicamente `feat/fotos-catalogo`, según [su configuración de despliegues por rama](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled).

## Pruebas desde PC y teléfono

1. En Catálogo, creá un producto de prueba sin foto. Debe funcionar igual. Editalo, elegí una foto y comprobá la vista previa antes de guardar.
2. Agregá ese producto a pendientes desde el formulario principal. La miniatura debe aparecer allí; ese formulario no debe ofrecer cargas.
3. Entrá desde otra cuenta de la misma familia: debe ver la foto. Una cuenta de otra familia no debe verla ni poder firmar su ruta.
4. Reemplazá la imagen, guardá y verificá la nueva en ambos dispositivos. Probá quitarla: vuelven los íconos, sin eliminar el producto ni su pendiente.
5. Probá un SVG, un archivo de más de 12 MiB y una conexión interrumpida. Deben aparecer mensajes; un fallo anterior a confirmar la referencia no cambia el producto ni su foto anterior. Si se pierde la respuesta final, actualizá antes de repetir: el servidor pudo haber confirmado.
6. En Chrome/Android y Safari/iPhone reales probá **Elegir foto** y **Tomar foto**. La captura depende del navegador; siempre queda la selección de archivos. No se pide acceso permanente a la cámara.
7. En otra sesión sin cuenta, comprobá que el modo local siga sin controles de fotos. No se importan referencias de imágenes al importar una lista local.
8. Después de reemplazar/quitar, revisá Storage y los logs: el archivo descartado debe desaparecer. Las cargas abandonadas vencen en una hora; se recogen en el siguiente ciclo de limpieza. El navegador también reintenta limpieza al recuperar datos, como máximo una vez por minuto en primer plano.

## Cómo se mantiene la consistencia

Cada carga recibe una ruta aleatoria `familia/producto/carga.webp`, emitida por SQL y reservada por una hora. No se sobrescribe la imagen anterior. Solo después de subir se confirma en **una transacción** el nombre/categoría y la referencia, verificando familia, autor de la carga, versión del producto y existencia/tamaño del objeto. La creación de un producto con foto también es atómica. La operación conserva idempotencia y los bloqueos familiares existentes.

La foto anterior pasa a limpieza únicamente cuando la nueva referencia está confirmada. Una carrera con otra edición rechaza la versión antigua, sin borrar la foto vigente. Las cargas abandonadas y los archivos retirados quedan registrados; el trabajador usa la API para borrarlos y luego confirma la limpieza. Los registros limpiados se conservan como tombstones para impedir reutilizar rutas y detectar un objeto que aparezca tarde. No existe una transacción distribuida entre PostgreSQL y Storage: por eso la limpieza es eventual y reintentable, no una promesa de borrado instantáneo.

Las URLs firmadas duran **60 segundos**; se reutilizan en memoria hasta 40 segundos y se renuevan cada 45 segundos en miniaturas visibles. Se solicitan cuando la fila entra en pantalla y no se guardan en localStorage. Al salir de la familia se desmonta el espacio de trabajo. Un enlace firmado ya emitido puede seguir abriendo la imagen hasta vencer, y no es posible retirar una copia que alguien ya descargó. No compartas esos enlaces. Más información: [buckets privados y URLs firmadas](https://supabase.com/docs/guides/storage/serving/downloads#private-buckets).

## Verificaciones realizadas y límites

- Build, lint y 26 pruebas Node; no se agregaron dependencias al proyecto.
- Migraciones 0001–0006 y suites SQL ejecutadas en PostgreSQL temporal, con esquema Storage simulado. Se probaron aislamiento, revocación, una política permisiva adicional, revisiones, reemplazo fallido, idempotencia, vencimiento y limpieza tardía.
- Chrome local con API de Storage simulada y PostgreSQL temporal: crear/reemplazar/quitar, miniatura en pendientes, EXIF, compresión, modo local y anchos 320/390/1440 sin desbordes ni excepciones JS.
- Función comprobada con Deno y API simulada: rechaza llamadas sin secreto y procesa cola, API de borrado y confirmación con credencial solo de servidor.
- La función y su llamada desde PostgreSQL se verificaron en producción. Quedan las pruebas con cámara física de iPhone/Android y carga de fotos con cuentas reales; no se alteraron productos familiares para simularlas. Storage, egress y funciones consumen las cuotas de tu plan; no se contrataron servicios ni planes nuevos.
