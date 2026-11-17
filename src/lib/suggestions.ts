import type { PendingItem, Product, Purchase } from '../types.ts'
import { normalizeName } from './shopping.ts'

// Favoritos manuales primero; luego frecuencia y última compra, sin repetir productos.
export function suggestProducts(catalog: Product[], history: Purchase[], query: string, limit = 5, pending: PendingItem[] = []): Product[] {
  const search = normalizeName(query)
  const stats = new Map<string, { count: number; recent: number }>()
  for (const purchase of history) {
    if (purchase.revertedAt) continue
    const previous = stats.get(purchase.productId) ?? { count: 0, recent: 0 }
    stats.set(purchase.productId, { count: previous.count + 1, recent: Math.max(previous.recent, Date.parse(purchase.purchasedAt) || 0) })
  }
  for (const item of pending) {
    const previous = stats.get(item.productId) ?? { count: 0, recent: 0 }
    stats.set(item.productId, { ...previous, recent: Math.max(previous.recent, Date.parse(item.addedAt ?? '') || 0) })
  }
  return catalog.filter(product => product.active !== false && normalizeName(product.name).includes(search))
    .sort((a, b) => {
      const relevance = (p: Product) => normalizeName(p.name) === search ? 2 : normalizeName(p.name).startsWith(search) ? 1 : 0
      const x = stats.get(a.id), y = stats.get(b.id)
      return (search ? relevance(b) - relevance(a) : 0) || Number(!!b.favorite) - Number(!!a.favorite)
        || (y?.count ?? 0) - (x?.count ?? 0) || (y?.recent ?? 0) - (x?.recent ?? 0) || a.name.localeCompare(b.name, 'es')
    }).slice(0, limit)
}
