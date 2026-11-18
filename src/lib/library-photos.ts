import type { Product } from '../types.ts'
import { LIBRARY } from './library.ts'
import { normalizeName } from './shopping.ts'

const byName = new Map(LIBRARY.map(product => [product.key, product.id]))
const ids = new Set(LIBRARY.map(product => product.id))

export function libraryPhoto(product: Pick<Product, 'libraryId' | 'name'>) {
  const id = product.libraryId ?? byName.get(normalizeName(product.name))
  if (!id || !ids.has(id)) return undefined
  const extension = id === 'aceite-girasol' ? 'png' : 'jpg'
  return `/library/${id}.${extension}`
}
