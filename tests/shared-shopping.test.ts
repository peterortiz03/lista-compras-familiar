import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { importProducts, parseMutationResult, parseSharedState } from '../src/lib/shared-shopping.ts'

test('la respuesta compartida requiere versiones e identifica al autor de compras', () => {
  const state = createInitialState()
  assert.throws(() => parseSharedState(state))
  const snapshot = { ...state, schemaVersion: 3, featuresVersion: 5, catalog: state.catalog.map(product => ({ ...product, active: true, revision: 'catalog-revision-1' })), pending: state.pending.map(item => ({ ...item, version: 'revision-1' })) }
  assert.equal(parseSharedState(snapshot), snapshot)
  assert.throws(() => parseSharedState({ ...snapshot, history: [{ id: 'p', productId: 'leche', name: 'Leche', quantity: 1, unit: 'litro', purchasedAt: '2026-11-17T12:00:00Z' }] }))
})

test('el resultado remoto de duplicado conserva el producto canónico y rechaza respuestas inválidas', () => {
  const product = createInitialState().catalog[0]
  assert.deepEqual(parseMutationResult({ kind: 'duplicate', product }), { kind: 'duplicate', product })
  assert.deepEqual(parseMutationResult({ kind: 'ok' }), { kind: 'ok' })
  for (const response of [null, {}, { kind: 'duplicate', product: { id: 'x' } }]) assert.throws(() => parseMutationResult(response))
})

test('importar prepara catálogo y pendientes sin borrar la copia ni atribuir historial antiguo', () => {
  const state = createInitialState()
  const original = structuredClone(state)
  const products = importProducts(state)
  assert.equal(products.length, state.catalog.length)
  assert.deepEqual(products[0], { name: 'Leche', unit: 'litro', quantity: 2, active: true })
  assert.equal(products.find(product => product.name === 'Café')?.quantity, null)
  assert.deepEqual(state, original)
  assert.equal('history' in products, false)
})
