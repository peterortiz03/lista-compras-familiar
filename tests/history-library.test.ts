import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { test } from 'node:test'
import { purchaseDay, shiftDay } from '../src/lib/history.ts'
import { LIBRARY, libraryMatch } from '../src/lib/library.ts'
import { libraryPhoto } from '../src/lib/library-photos.ts'
import { credits } from '../src/lib/library-photo-credits.ts'
import { suggestProducts } from '../src/lib/suggestions.ts'

test('cada ficha tiene una foto local liviana y con crédito', () => {
  const assets = LIBRARY.map(entry => libraryPhoto({ name: entry.name, libraryId: entry.id }))
  assert.equal(new Set(assets).size, LIBRARY.length)
  for (const asset of assets) {
    assert.ok(asset)
    const path = new URL(`../public${asset}`, import.meta.url)
    const size = statSync(path).size
    assert.ok(size > 0 && size <= 80 * 1024, asset)
    assert.ok(credits[asset.slice('/library/'.length)]?.source.startsWith('https://'), asset)
  }
  assert.equal(libraryPhoto({ name: ' AZÚCAR ' }), '/library/azucar.jpg')
  assert.equal(libraryPhoto({ name: 'Azúcar impalpable' }), undefined)
})

test('días de Buenos Aires cortan a medianoche local, incluso al cambiar de año', () => {
  assert.equal(purchaseDay('2027-01-01T02:59:59.999Z'), '2026-12-31')
  assert.equal(purchaseDay('2027-01-01T03:00:00Z'), '2027-01-01')
  assert.equal(shiftDay('2027-01-01', -2), '2026-12-30')
})

test('60 fichas únicas, equivalencia por identidad o nombre exacto, no por alias', () => {
  assert.equal(LIBRARY.length, 60)
  assert.equal(new Set(LIBRARY.map(item => item.id)).size, 60)
  assert.equal(new Set(LIBRARY.map(item => item.key)).size, 60)
  const milk = LIBRARY.find(item => item.id === 'leche')!
  const catalog = [{ id: '1', name: 'Crema de leche', unit: 'unidad' as const }]
  assert.equal(libraryMatch(milk, catalog), undefined)
  const existing = { id: '2', name: ' LECHE ', unit: 'unidad' as const, active: false }
  assert.equal(libraryMatch(milk, [...catalog, existing]), existing)
  const renamed = { ...existing, name: 'Leche entera', libraryId: milk.id }
  assert.equal(libraryMatch(milk, [renamed]), renamed)
})

test('las búsquedas dejan ver más de cinco y las compras antiguas siguen contando', () => {
  const catalog = [{ id: 'a', name: 'Leche', unit: 'litro' as const },
    ...Array.from({ length: 8 }, (_, index) => ({ id: String(index), name: 'Leche ' + index, unit: 'litro' as const }))]
  const stats = [{ productId: '7', count: 10, lastPurchasedAt: '2020-01-01T03:00:00Z' }]
  assert.equal(suggestProducts(catalog, [], '', 5, [], stats)[0].id, '7')
  const matches = suggestProducts(catalog, [], 'leche', catalog.length, [], stats)
  assert.equal(matches.length, 9)
  assert.equal(matches[0].id, 'a')
})
