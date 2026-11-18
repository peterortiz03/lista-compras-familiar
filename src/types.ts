import type { Category } from './lib/categories.ts'
export const UNITS = [
  { value: 'unidad', label: 'Unidades', short: 'un.' },
  { value: 'kg', label: 'Kilogramos', short: 'kg' },
  { value: 'litro', label: 'Litros', short: 'l' },
  { value: 'paquete', label: 'Paquetes', short: 'paq.' },
] as const

export type Unit = (typeof UNITS)[number]['value']

export interface Product {
  libraryId?: string | null
  photoPath?: string | null
  favorite?: boolean
  category?: Category
  active?: boolean
  revision?: string
  id: string
  name: string
  unit: Unit
}

export interface PendingItem {
  note?: string
  urgent?: boolean
  addedBy?: string | null
  addedByName?: string
  addedAt?: string | null
  version?: string
  productId: string
  quantity: number
}

export interface ShoppingState {
  purchaseRevision?: string
  purchaseStats?: PurchaseStat[]
  photoStorage?: boolean
  history: Purchase[]
  catalog: Product[]
  pending: PendingItem[]
}

export interface PurchaseStat {
  productId: string
  count: number
  lastPurchasedAt: string
}

export interface Purchase {
  note?: string
  revertedAt?: string | null
  revertedBy?: string | null
  purchasedBy?: string
  author?: string
  id: string
  productId: string
  name: string
  unit: Unit
  quantity: number
  purchasedAt: string
}

export interface FamilyContext {
  ownerId?: string
  userId: string
  id: string
  name: string
}

export interface ProductDraft {
  category?: Category
  note?: string
  urgent?: boolean
  name: string
  unit: Unit
  quantity: number
}
