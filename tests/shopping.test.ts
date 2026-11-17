import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { addProduct, quantityError, recordPurchase, removePending, updateQuantity } from '../src/lib/shopping.ts'

test('agregar incorpora el producto al catálogo y a pendientes sin mutar el estado anterior', () => {
  const initial = createInitialState()
  const result = addProduct(initial, { name: '  Yerba   mate  ', quantity: 2, unit: 'paquete' }, 'yerba')
  assert.equal(result.kind, 'added')
  assert.equal(result.product.name, 'Yerba mate')
  assert.equal(result.state.catalog.length, initial.catalog.length + 1)
  assert.equal(result.state.pending.at(-1)?.productId, 'yerba')
  assert.equal(result.state.pending.at(-1)?.quantity, 2)
  assert.equal(initial.pending.length, 5)
})

test('duplicados ignoran mayúsculas, espacios y tildes; no suman ni reemplazan cantidades', () => {
  const added = addProduct(createInitialState(), { name: 'Café', quantity: 2, unit: 'paquete' }, 'otro-id')
  const result = addProduct(added.state, { name: '  CAFE  ', quantity: 7, unit: 'unidad' }, 'nuevo-id')
  assert.equal(result.kind, 'duplicate')
  assert.equal(result.product.id, 'cafe')
  assert.equal(result.state, added.state)
  assert.equal(result.state.pending.find((item) => item.productId === 'cafe')?.quantity, 2)
})

test('las cantidades tienen límites y las fracciones se reservan a kg y litros', () => {
  for (const quantity of [0, -1, NaN, Infinity, 10000, 0.0001]) {
    assert.notEqual(quantityError(quantity, 'kg'), null)
    assert.throws(() => addProduct(createInitialState(), { name: 'Queso', quantity, unit: 'kg' }, 'queso'))
  }
  assert.notEqual(quantityError(1.5, 'unidad'), null)
  assert.notEqual(quantityError(1.5, 'paquete'), null)
  assert.equal(quantityError(0.125, 'kg'), null)
  assert.equal(quantityError(1.5, 'litro'), null)
  assert.equal(quantityError(9999, 'unidad'), null)
})

test('editar modifica solo la cantidad del producto indicado y valida el valor', () => {
  const initial = createInitialState()
  const updated = updateQuantity(initial, 'leche', 3.5)
  assert.equal(updated.pending.find((item) => item.productId === 'leche')?.quantity, 3.5)
  assert.equal(initial.pending[0].quantity, 2)
  assert.equal(updated.catalog, initial.catalog)
  assert.deepEqual(updated.pending.slice(1), initial.pending.slice(1))
  assert.throws(() => updateQuantity(initial, 'huevos', 0))
  assert.throws(() => updateQuantity(initial, 'inexistente', 2))
})

test('comprar o eliminar conserva el catálogo y permite volver a agregar sin duplicarlo', () => {
  const initial = createInitialState()
  const removed = removePending(initial, 'leche')
  assert.equal(removed.pending.length, initial.pending.length - 1)
  assert.equal(removed.catalog, initial.catalog)
  const added = addProduct(removed, { name: 'LECHE', quantity: 1, unit: 'unidad' }, 'otro-id')
  assert.equal(added.kind, 'added')
  assert.equal(added.product.unit, 'litro')
  assert.equal(added.state.catalog.length, initial.catalog.length)
})

test('rechaza nombres vacíos o demasiado largos', () => {
  for (const name of ['   ', 'a'.repeat(81)]) {
    assert.throws(() => addProduct(createInitialState(), { name, quantity: 1, unit: 'unidad' }, 'nuevo'))
  }
})

test('compra parcial resta exactamente y agrega una instantánea al historial sin mutar el original', () => {
  const initial = updateQuantity(createInitialState(), 'leche', 0.3)
  const result = recordPurchase(initial, 'leche', 0.1, 'compra-1', '2026-11-16T20:00:00.000Z')
  assert.equal(result.pending.find((item) => item.productId === 'leche')?.quantity, 0.2)
  assert.deepEqual(result.history[0], { id: 'compra-1', productId: 'leche', name: 'Leche', unit: 'litro', quantity: 0.1, note: '', purchasedAt: '2026-11-16T20:00:00.000Z' })
  assert.equal(initial.history.length, 0)
  assert.equal(initial.pending[0].quantity, 0.3)
})

test('compra completa retira el pendiente y conserva historial al agregar, editar o eliminar otros', () => {
  const initial = createInitialState()
  const bought = recordPurchase(initial, 'huevos', 12, 'compra-1', '2026-11-16T20:00:00.000Z')
  assert.equal(bought.pending.some((item) => item.productId === 'huevos'), false)
  assert.equal(bought.catalog, initial.catalog)
  const added = addProduct(bought, { name: 'Yerba', quantity: 1, unit: 'paquete' }, 'yerba').state
  const edited = updateQuantity(added, 'yerba', 2)
  const removed = removePending(edited, 'yerba')
  assert.deepEqual(removed.history, bought.history)
  const next = recordPurchase(removed, 'leche', 1, 'compra-2', '2026-11-16T21:00:00.000Z')
  assert.deepEqual(next.history.map((purchase) => purchase.id), ['compra-2', 'compra-1'])
})

test('rechaza compras excesivas, inválidas o de productos que no están pendientes', () => {
  const initial = createInitialState()
  for (const amount of [0, -1, 13, 1.5, NaN]) {
    assert.throws(() => recordPurchase(initial, 'huevos', amount, 'compra', '2026-11-16T20:00:00.000Z'))
  }
  assert.throws(() => recordPurchase(initial, 'cafe', 1, 'compra', '2026-11-16T20:00:00.000Z'))
  assert.equal(initial.history.length, 0)
})
