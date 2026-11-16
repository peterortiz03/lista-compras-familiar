import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { addProduct, quantityError, removePending, updateQuantity } from '../src/lib/shopping.ts'

test('agregar incorpora el producto al catálogo y a pendientes sin mutar el estado anterior', () => {
  const initial = createInitialState()
  const result = addProduct(initial, { name: '  Yerba   mate  ', quantity: 2, unit: 'paquete' }, 'yerba')
  assert.equal(result.kind, 'added')
  assert.equal(result.product.name, 'Yerba mate')
  assert.equal(result.state.catalog.length, initial.catalog.length + 1)
  assert.deepEqual(result.state.pending.at(-1), { productId: 'yerba', quantity: 2 })
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
