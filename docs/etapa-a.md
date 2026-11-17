> Actualización: el usuario confirmó haber aplicado 0004. La continuación B–D ya está preparada localmente; ver [etapas-bcd.md](etapas-bcd.md). Las referencias a aprobaciones pendientes en este documento describen el cierre histórico de A. No repitas esta migración.

# Actualización funcional: etapa A preparada

Estado: código y migración verificados localmente. **Sin aplicación en producción, sin commits y sin pushes.** Las etapas B, C y D siguen pendientes.

## Cambios

- Catorce categorías, almacenadas en el producto del catálogo. Una sugerencia local basada en palabras conocidas ayuda con nuevos productos; la selección manual se respeta. No hay llamadas a IA. Los antiguos quedan en Otros y se corrigen desde Catálogo.
- Notas opcionales de hasta 300 caracteres y urgencia normal/urgente en el pendiente. El mismo formulario edita cantidad, nota y prioridad. Un duplicado no reemplaza los detalles; ofrece editar lo existente.
- La lista muestra solo grupos con coincidencias pendientes, con urgentes primero dentro de cada categoría.
- Autor y fecha de incorporación en cada pendiente compartido: PostgreSQL toma la identidad de la sesión y guarda el nombre visible como instantánea. Los antiguos muestran Integrante anterior y fecha desconocida. No se almacenan correos ni contraseñas para esto.
- Una compra parcial conserva nota, prioridad y autor del restante. La compra registra su propia copia de la nota en el historial. Revertir recrea la nota si debe reconstruir un pendiente; si ya hay uno, conserva sus detalles actuales.
- Se conserva la compatibilidad con copias locales anteriores: categoría ausente equivale a Otros; nota ausente a vacía; urgencia ausente a normal.

## Migración pendiente de aprobación

Archivo: [`0004_categories_pending_details.sql`](../supabase/migrations/0004_categories_pending_details.sql). Ejecutar después de 0003 y una sola vez.

Sus efectos son añadir columnas y restricciones para categorías, notas, urgencia y autoría; agregar disparadores para registrar autor y nota; y ampliar las funciones de escritura y lectura. Conserva filas, cantidades, productos archivados, cuentas, familias e historial. No reinicia tablas ni asigna autores históricos falsos. Mantiene RLS, serialización por familia, control de versiones e idempotencia.

Los clientes publicados anteriores pueden seguir usando las operaciones previas: actualizar solo una cantidad no borra notas ni prioridad. La nueva versión exige el esquema 4, para impedir una operación que aparentase guardar detalles en una base todavía sin actualizar.

**No ejecutar en producción hasta que apruebes esta migración.** Una vez aprobada:

1. Verificá que elegís el proyecto correcto y revisá las opciones de copia/exportación disponibles en tu plan, dado que contiene datos reales.
2. Abrí SQL Editor y una consulta nueva. Copiá el archivo 0004 completo, incluidos `begin` y `commit`. No repitas 0001–0003.
3. Ejecutalo. Ante un error no publiques la versión; conservá el mensaje y ejecutá `ROLLBACK;` si la sesión quedó dentro de una transacción fallida.
4. Confirmá que la consulta terminó sin errores. Después se puede probar la versión nueva localmente contra ese proyecto. No se publica hasta autorizar un commit/push; Vercel despliega los pushes a main.
5. Revisá un pendiente antiguo: misma cantidad, categoría Otros, nota vacía, normal y autor neutral. Creá Bifes, elegí kg y categoría Carnes y pescados, nota “De lomo, finitos” y urgencia. Registrá una compra parcial y comprobá nota restante e historial en ambas cuentas.

No borres columnas ni funciones para intentar revertir la migración. Si aparece un problema, se evalúa una corrección incremental. No hay un rollback destructivo automático.

## Verificaciones realizadas

Compilación, lint y 22 pruebas Node. Las tres suites SQL anteriores pasaron en el esquema previo; luego se aplicó 0004 sobre datos ya existentes y se comprobó conservación y la nueva suite de notas, categoría, autor no falsificable, idempotencia y parcial. Todo en PostgreSQL temporal, sin conectarse a producción.

En Chrome, con perfil temporal y modo local, se comprobó categoría sugerida, agrupación, nota, urgencia, compra parcial y nota en historial. No hubo desbordes en los anchos comprobados. La sincronización real con dos cuentas después de migrar queda pendiente de aprobación y aplicación.

## Continuación

B: favoritos y sugerencias de frecuentes/recientes, más compartir. C: administración y revocación de membresías, historial con referencias seguras y recuperación de sesión sin destello local. D: manifiesto, íconos e instalación PWA sin cola offline ni caché de datos privados. Se realizarán migraciones separadas cuando corresponda y se presentarán antes de producción.
