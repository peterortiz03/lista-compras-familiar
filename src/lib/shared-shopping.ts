import type { Product, ProductDraft, ShoppingState, Unit } from '../types.ts'
import { isShoppingState } from './storage.ts'

export type ShoppingCommand =
  | ({ type: 'add' } & ProductDraft)
  | { type: 'update' | 'buy'; productId: string; quantity: number; version?: string }
  | { type: 'remove'; productId: string; version?: string }
  | { type: 'import'; products: { name: string; unit: Unit; quantity: number | null }[] }

export type MutationResult = { kind: 'ok' } | { kind: 'added' | 'duplicate'; product: Product }

export function parseSharedState(value: unknown): ShoppingState {
  if (!isShoppingState(value) || value.pending.some(item => typeof item.version !== 'string' || !item.version)
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
  if (code === '40001') return 'Otra persona cambió este pendiente. Cerrá la edición o compra, revisá la lista actualizada y volvé a abrirla.'
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303') return 'No se pudo autorizar el acceso a esta familia. Revisá tu sesión e ingresá nuevamente.'
  if (code === '22023' || code === '23505') return 'Revisá los datos y cantidades. La importación solo admite una familia vacía y nombres sin duplicados.'
  return 'No pudimos confirmar la operación. Revisá la conexión y actualizá antes de reintentar.'
}

export function importProducts(state: ShoppingState) {
  return state.catalog.map(product => ({ name: product.name, unit: product.unit,
    quantity: state.pending.find(item => item.productId === product.id)?.quantity ?? null }))
}
