# Fotos de biblioteca y administración del historial

Las primeras nueve fotos generales están en `public/library` y se descargan al aparecer en pantalla. [Créditos y licencias](../public/library/CREDITOS.md).

El catálogo y pendientes usan la foto familiar cuando está disponible. En su ausencia, buscan una foto de biblioteca por identificador o por coincidencia exacta de nombre normalizado en productos anteriores. La familia puede agregar, reemplazar o quitar su foto desde **Catálogo → Editar**. Al quitarla reaparece la foto general, si existe, o el ícono. El botón sobre la miniatura abre la vista ampliada y se cierra con **Cerrar** o Escape.

En **Historial**, el responsable de la familia dispone de **Administrar compra**. Cada acción requiere confirmación.

| Acción | Historial y frecuencia | Pendientes |
| --- | --- | --- |
| Revertir compra | Queda como revertida y sale de la frecuencia | Devuelve la cantidad |
| Anular | Queda como anulada y sale de la frecuencia | Conserva las cantidades |
| Eliminar para siempre | Borra la fila de compra y la retira de las estadísticas | Conserva las cantidades |

El filtro **Mostrar compras corregidas** incluye anuladas y revertidas. La eliminación definitiva no tiene deshacer desde la app. Las copias de seguridad de Supabase se rigen por la retención del proyecto.

## Activación y prueba

La migración 0009 ya está aplicada y comprobada en el proyecto compartido. Los dos primeros pasos describen la instalación en otro proyecto.

1. Con autorización de producción, ejecutar [0009_purchase_administration.sql](../supabase/migrations/0009_purchase_administration.sql) una vez después de 0008. Aplicarla no elimina compras. Agrega el estado de anulación y las acciones autorizadas. La revisión de compras se invalida al borrar, igual que al comprar o revertir.
2. Publicar el frontend. Las opciones de administración aparecen para el responsable cuando el servidor informa que está aplicada 0009.
3. Con una compra de prueba, comprobar **Anular** y después **Mostrar compras corregidas**. Confirmar que la cantidad pendiente permanezca igual. Probar **Eliminar para siempre** con otra compra de prueba. Comprobar desde un segundo integrante que el historial se actualiza y que solo el responsable ve las acciones nuevas.
4. Desde el teléfono, ampliar una foto general y subir una foto familiar de prueba desde el catálogo. Volver a ampliar y verificar que se ve la familiar. Al quitarla debe reaparecer la general.

Se verificaron las reglas de autorización, historial, cantidades y estadísticas en PostgreSQL temporal. La carga y ampliación de las fotos generales se probaron en Chrome. La aceptación de las fotos privadas y las acciones de historial requiere una prueba con sesiones familiares reales.
