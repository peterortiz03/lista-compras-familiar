import type { Product } from '../types.ts'
import { normalizeName } from './shopping.ts'

const photos = [
  ['tomates', 'Tomates'],
  ['cafe', 'Café'],
  ['huevos', 'Huevos'],
  ['manzanas', 'Manzanas'],
  ['zapallo-cabutia', 'Zapallo cabutiá'],
  ['papas', 'Papas'],
  ['frutillas', 'Frutillas'],
  ['zanahorias', 'Zanahorias'],
  ['dulce-leche', 'Dulce de leche'],
] as const

const byName = new Map(photos.map(([id, name]) => [normalizeName(name), id]))
const ids = new Set<string>(photos.map(([id]) => id))

export function libraryPhoto(product: Pick<Product, 'libraryId' | 'name'>) {
  const id = product.libraryId ?? byName.get(normalizeName(product.name))
  return id && ids.has(id) ? `/library/${id}.jpg` : undefined
}
