import type { Product, ProductDraft, ShoppingState, Unit } from '../types.ts'
import { isShoppingState } from './storage.ts'

export type ShoppingCommand =
  | ({ type: 'add' } & ProductDraft)
  | { type: 'update' | 'buy'; productId: string; quantity: number; version?: string }
  | { type: 'remove'; productId: string; version?: string }
  | { type: 'import'; products: { name: string; unit: Unit; quantity: number | null; active?: boolean }[] }
  | { type: 'catalog_add'; name: string; unit: Unit }
  | { type: 'catalog_update'; productId: string; name: string; revision?: string }
  | { type: 'catalog_archive' | 'catalog_restore'; productId: string; revision?: string }
  | { type: 'revert_purchase'; purchaseId: string }

export type MutationResult = { kind: 'ok' } | { kind: 'added' | 'duplicate'; product: Product }

export function parseSharedState(value: unknown): ShoppingState {
  if (typeof value !== 'object' || value === null || !('schemaVersion' in value) || value.schemaVersion !== 3) {
    throw new Error('Falta aplicar la migración 0003 de catálogo e historial en Supabase.')
  }
  if (!isShoppingState(value) || value.catalog.some(product => typeof product.active !== 'boolean' || typeof product.revision !== 'string' || !product.revision)
    || value.pending.some(item => typeof item.version !== 'string' || !item.version)
    || value.history.some(item => typeof item.author !== 'string' || typeof item.purchasedBy !== 'string')) {
    throw new Error('La respuesta de la lista familiar es inválida. Revisá la actualización de la base de datos.')
  }
  return value
}

export function parseMutationResult(value: unknown): MutationResult {
  if (typeof value === 'object' && value !== null && 'kind' in value) {
    if (value.kind === 'ok') return { kind: 'ok' }
    if ((value.kind === 'added' || value.kind === 'duplicate') && 'product' in value
      && isShoppingState({ catalog: [value.product], pending: [], history: [] })) {
      return { kind: value.kind, product: value.product as Product }
    }
  }
  throw new Error('No pudimos confirmar el resultado. Actualizá la lista antes de reintentar.')
}

export function sharedError(code?: string): string {
  if (code === 'PGRST202' || code === '42883') return 'Falta aplicar la migración 0002 de sincronización en Supabase.'
  if (code === '40001') return 'Otra persona cambió estos datos. Cerrá la edición o compra, revisá la lista actualizada y volvé a abrirla.'
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') return 'No se pudo autorizar el acceso a esta familia. Revisá tu sesión e ingresá nuevamente.'
  if (code === '23505') return 'Ya existe un producto con ese nombre. Revisá también los productos quitados del catálogo.'
  if (code === '22023') return 'Revisá nombres, unidades y cantidades (hasta 9999). La importación requiere una familia vacía.'
  return 'No pudimos confirmar la operación. Revisá la conexión y actualizá antes de reintentar.'
}

export function importProducts(state: ShoppingState) {
  return state.catalog.map(product => ({ name: product.name, unit: product.unit,
    quantity: state.pending.find(item => item.productId === product.id)?.quantity ?? null, active: product.active !== false }))
}
