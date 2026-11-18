import { createInitialState } from '../data.ts'
import { UNITS } from '../types.ts'
import type { ShoppingState, Unit } from '../types.ts'
import { cleanName, normalizeName, quantityError } from './shopping.ts'
import { isCategory } from './categories.ts'

export const STORAGE_KEY = 'en-casa:shopping:v1'
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>
type AccessStorage = () => StoragePort

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
function unit(value: unknown): value is Unit {
  return UNITS.some((entry) => entry.value === value)
}
function validQuantity(value: unknown, measure: Unit): boolean {
  return typeof value === 'number' && quantityError(value, measure) === null
}

// JSON recuperado del navegador es información externa: se valida antes de usarlo.
export function isShoppingState(value: unknown): value is ShoppingState {
  if (!object(value) || !Array.isArray(value.catalog) || !Array.isArray(value.pending) || !Array.isArray(value.history)) return false
  const products = new Map<string, Unit>()
  const names = new Set<string>()
  for (const product of value.catalog) {
    if (!object(product) || !text(product.id) || !text(product.name) || !unit(product.unit)) return false
    if (product.active !== undefined && typeof product.active !== 'boolean') return false
    if (product.favorite !== undefined && typeof product.favorite !== 'boolean') return false
    if (product.libraryId != null && (typeof product.libraryId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(product.libraryId))) return false
    if (product.photoPath != null && (typeof product.photoPath !== 'string' || product.photoPath.length > 180)) return false
    if (product.category !== undefined && !isCategory(product.category)) return false
    const name = cleanName(product.name)
    if (!name || name.length > 80 || products.has(product.id) || names.has(normalizeName(name))) return false
    products.set(product.id, product.unit)
    names.add(normalizeName(name))
  }
  const pendingIds = new Set<string>()
  for (const item of value.pending) {
    if (!validDetails(item)) return false
    if (!object(item) || !text(item.productId) || pendingIds.has(item.productId)) return false
    const measure = products.get(item.productId)
    if (!measure || !validQuantity(item.quantity, measure)) return false
    pendingIds.add(item.productId)
  }
  const purchaseIds = new Set<string>()
  for (const purchase of value.history) {
    if (!validDetails(purchase)) return false
    if (!object(purchase) || !text(purchase.id) || purchaseIds.has(purchase.id) || !text(purchase.productId) || !products.has(purchase.productId)) return false
    if (!text(purchase.name) || !cleanName(purchase.name) || purchase.name.length > 80 || !unit(purchase.unit) || !validQuantity(purchase.quantity, purchase.unit)) return false
    if (!text(purchase.purchasedAt) || !Number.isFinite(Date.parse(purchase.purchasedAt))) return false
    if (purchase.revertedAt != null && (!text(purchase.revertedAt) || !Number.isFinite(Date.parse(purchase.revertedAt)))) return false
    purchaseIds.add(purchase.id)
  }
  return true
}

function validDetails(value: unknown): boolean {
  if (!object(value)) return false
  return (value.note === undefined || (typeof value.note === 'string' && value.note.length <= 300))
    && (value.urgent === undefined || typeof value.urgent === 'boolean')
    && (value.addedByName === undefined || typeof value.addedByName === 'string')
    && (value.addedAt == null || (text(value.addedAt) && Number.isFinite(Date.parse(value.addedAt))))
}

export function loadState(access: AccessStorage): { state: ShoppingState; error: string; canSave: boolean } {
  try {
    const raw = access().getItem(STORAGE_KEY)
    if (raw === null) return { state: createInitialState(), error: '', canSave: true }
    const data: unknown = JSON.parse(raw)
    if (!object(data) || data.version !== 1 || !isShoppingState(data.state)) throw new Error('Datos inválidos')
    return { state: data.state, error: '', canSave: true }
  } catch {
    return { state: createInitialState(), canSave: false, error: 'No pudimos recuperar los datos locales. Podés usar los ejemplos temporalmente; no reemplazaremos lo que estaba guardado. Revisá el almacenamiento del navegador antes de recargar.' }
  }
}

export function saveState(access: AccessStorage, state: ShoppingState): string {
  try {
    access().setItem(STORAGE_KEY, JSON.stringify({ version: 1, state }))
    return ''
  } catch {
    return 'No se pudieron guardar los últimos cambios en este navegador. Conservá esta pestaña abierta para no perderlos y revisá el espacio disponible o los permisos de almacenamiento.'
  }
}
