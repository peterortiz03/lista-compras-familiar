import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { addProduct, changeCatalogProduct, createCatalogProduct, recordPurchase, revertPurchase } from '../src/lib/shopping.ts'

test('crear, renombrar y quitar productos conserva pendientes e historial y permite recuperarlos', () => {
  const initial = createInitialState()
  let state = createCatalogProduct(initial, 'Yerba', 'paquete', 'yerba')
  assert.equal(state.pending.length, initial.pending.length)
  assert.throws(() => createCatalogProduct(state, ' YERBA ', 'unidad', 'otro'))
  state = recordPurchase(state, 'leche', 1, 'compra', '2026-11-17T12:00:00Z')
  state = changeCatalogProduct(state, 'leche', { name: 'Leche descremada' })
  assert.equal(state.history[0].name, 'Leche')
  assert.throws(() => changeCatalogProduct(state, 'leche', { name: 'Yerba' }))
  state = changeCatalogProduct(state, 'leche', { active: false })
  assert.equal(state.pending.find(item => item.productId === 'leche')?.quantity, 1)
  assert.equal(state.catalog.find(item => item.id === 'leche')?.active, false)
  state = changeCatalogProduct(state, 'leche', { active: true })
  assert.equal(state.catalog.find(item => item.id === 'leche')?.active, true)
  assert.equal(initial.catalog.length + 1, state.catalog.length)
})

test('revertir una compra completa o parcial restituye exactamente y no duplica al repetir', () => {
  const initial = createInitialState()
  const bought = recordPurchase(initial, 'tomates', 0.125, 'compra', '2026-11-17T12:00:00Z')
  const reverted = revertPurchase(bought, 'compra', '2026-11-17T13:00:00Z')
  assert.equal(reverted.pending.find(item => item.productId === 'tomates')?.quantity, 1.5)
  assert.equal(reverted.history[0].revertedAt, '2026-11-17T13:00:00Z')
  assert.equal(revertPurchase(reverted, 'compra', '2026-11-17T14:00:00Z'), reverted)
  const complete = recordPurchase(initial, 'huevos', 12, 'completa', '2026-11-17T12:00:00Z')
  assert.equal(revertPurchase(complete, 'completa', '2026-11-17T13:00:00Z').pending.find(item => item.productId === 'huevos')?.quantity, 12)
  assert.equal(bought.history[0].revertedAt, undefined)
})

test('agregar un producto quitado recupera su sugerencia y revertir no supera los límites', () => {
  const initial = createInitialState()
  const archived = changeCatalogProduct(initial, 'leche', { active: false })
  const added = addProduct(archived, { name: 'Leche', unit: 'litro', quantity: 1 }, 'otro')
  assert.equal(added.state.catalog.find(item => item.id === 'leche')?.active, true)
  const bought = recordPurchase(initial, 'leche', 2, 'compra', '2026-11-17T12:00:00Z')
  const replenished = addProduct(bought, { name: 'Leche', unit: 'litro', quantity: 9999 }, 'otro').state
  assert.throws(() => revertPurchase(replenished, 'compra', '2026-11-17T13:00:00Z'))
  assert.equal(replenished.history[0].revertedAt, undefined)
})
