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
  productId: string
  quantity: number
}

export interface ShoppingState {
  history: Purchase[]
  catalog: Product[]
  pending: PendingItem[]
}

export interface Purchase {
  id: string
  productId: string
  name: string
  unit: Unit
  quantity: number
  purchasedAt: string
}

export interface ProductDraft {
  name: string
  unit: Unit
  quantity: number
}
