import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { addProduct, recordPurchase, updateQuantity } from '../src/lib/shopping.ts'
import { groupPending, suggestCategory } from '../src/lib/categories.ts'
import { isShoppingState } from '../src/lib/storage.ts'

test('categorías conservadoras y agrupación de antiguos en Otros, urgentes primero', () => {
  assert.equal(suggestCategory('Bifes'), 'Carnes y pescados')
  assert.equal(suggestCategory('Producto desconocido'), 'Otros')
  const old = createInitialState()
  assert.equal(isShoppingState(old), true)
  assert.deepEqual(groupPending(old).map(group => group.category), ['Otros'])
  const state = addProduct(old, { name: 'Bifes', unit: 'kg', quantity: 1, category: 'Carnes y pescados', urgent: true }, 'bifes').state
  state.pending[0] = { ...state.pending[0], urgent: true }
  assert.equal(groupPending(state).find(group => group.category === 'Otros')?.items[0].product.id, 'leche')
  assert.equal(groupPending(state, 'bifes').length, 1)
})
test('nota, urgencia y autor sobreviven a edición, parcial y duplicado sin sobrescribir', () => {
  const state = addProduct(createInitialState(), { name: 'Bifes', unit: 'kg', quantity: 1, note: 'De lomo, finitos', urgent: true }, 'bifes').state
  const edited = updateQuantity(state, 'bifes', 2)
  const bought = recordPurchase(edited, 'bifes', 0.5, 'p', '2026-11-17T12:00:00Z')
  const item = bought.pending.find(item => item.productId === 'bifes')!
  assert.equal(item.quantity, 1.5)
  assert.equal(item.note, 'De lomo, finitos')
  assert.equal(item.urgent, true)
  assert.equal(item.addedAt, state.pending.at(-1)?.addedAt)
  assert.equal(bought.history[0].note, item.note)
  const duplicate = addProduct(bought, { name: 'BIFES', unit: 'kg', quantity: 1, note: 'Otra nota' }, 'otro')
  assert.equal(duplicate.kind, 'duplicate')
  assert.equal(duplicate.state, bought)
  assert.equal(updateQuantity(bought, 'bifes', 1, { note: '', urgent: false }).pending.at(-1)?.note, '')
})
test('rechaza notas excesivas sin modificar el original y admite copias locales anteriores', () => {
  const old = createInitialState()
  assert.throws(() => addProduct(old, { name: 'Bifes', unit: 'kg', quantity: 1, note: 'a'.repeat(301) }, 'b'))
  assert.equal(isShoppingState(old), true)
  assert.equal(isShoppingState({ ...old, pending: [{ ...old.pending[0], note: 5 }] }), false)
})
