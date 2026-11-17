import type { ShoppingState } from '../types.ts'

export const CATEGORIES = ['Lácteos y huevos', 'Carnes y pescados', 'Frutas y verduras', 'Panadería', 'Almacén', 'Bebidas', 'Congelados', 'Snacks y golosinas', 'Limpieza', 'Higiene personal', 'Hogar y descartables', 'Mascotas', 'Farmacia y cuidado', 'Otros'] as const
export type Category = typeof CATEGORIES[number]
export function isCategory(value: unknown): value is Category { return CATEGORIES.some(category => category === value) }
export function suggestCategory(name: string): Category {
  const text = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const rules: [RegExp, Category][] = [
    [/\b(leche|queso|yogur|manteca|huevos?)\b/, 'Lácteos y huevos'],
    [/\b(bifes?|carne|pollo|pescado|merluza|cerdo)\b/, 'Carnes y pescados'],
    [/\b(manzanas?|tomates?|papas?|cebollas?|bananas?|zanahorias?|lechuga)\b/, 'Frutas y verduras'],
    [/\b(pan|facturas|medialunas)\b/, 'Panadería'],
    [/\b(arroz|fideos|harina|aceite|lentejas|yerba|cafe|azucar|sal)\b/, 'Almacén'],
    [/\b(agua|gaseosa|jugo|cerveza)\b/, 'Bebidas'],
    [/\b(lavandina|detergente|desengrasante)\b/, 'Limpieza'],
    [/\b(shampoo|champu|dentifrico|desodorante)\b/, 'Higiene personal'],
  ]
  return rules.find(([pattern]) => pattern.test(text))?.[1] ?? 'Otros'
}
export function groupPending(state: ShoppingState, query = '') {
  const search = query.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
  const rows = state.pending.flatMap(item => {
    const product = state.catalog.find(entry => entry.id === item.productId)
    return product && product.name.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().includes(search) ? [{ ...item, product }] : []
  })
  return CATEGORIES.map(category => ({ category, items: rows.filter(row => (row.product.category ?? 'Otros') === category)
    .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent) || a.product.name.localeCompare(b.product.name, 'es')) })).filter(group => group.items.length)
}
