export const UNITS = [
  { value: 'unidad', label: 'Unidades', short: 'un.' },
  { value: 'kg', label: 'Kilogramos', short: 'kg' },
  { value: 'litro', label: 'Litros', short: 'l' },
  { value: 'paquete', label: 'Paquetes', short: 'paq.' },
] as const

export type Unit = (typeof UNITS)[number]['value']

export interface Product {
  id: string
  name: string
  unit: Unit
}

export interface PendingItem {
  version?: string
  productId: string
  quantity: number
}

export interface ShoppingState {
  history: Purchase[]
  catalog: Product[]
  pending: PendingItem[]
}

export interface Purchase {
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
  userId: string
  id: string
  name: string
}

export interface ProductDraft {
  name: string
  unit: Unit
  quantity: number
}
