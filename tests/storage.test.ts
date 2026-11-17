import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { recordPurchase } from '../src/lib/shopping.ts'
import { isShoppingState, loadState, saveState, STORAGE_KEY } from '../src/lib/storage.ts'

test('primer uso carga ejemplos y guarda y recupera lista, catálogo e historial', () => {
  const entries = new Map<string, string>()
  const storage = { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value) } }
  const initial = loadState(() => storage)
  assert.equal(initial.canSave, true)
  assert.equal(initial.state.pending.length, 5)
  const bought = recordPurchase(initial.state, 'huevos', 3, 'purchase', '2026-11-17T12:00:00Z')
  assert.equal(saveState(() => storage, bought), '')
  assert.deepEqual(loadState(() => storage).state, bought)
  assert.equal(JSON.parse(entries.get(STORAGE_KEY)!).version, 1)
  const empty = { catalog: [], pending: [], history: [] }
  saveState(() => storage, empty)
  assert.deepEqual(loadState(() => storage).state, empty)
})

test('datos dañados o de otra versión no se cargan ni se habilita sobrescribirlos', () => {
  for (const raw of ['{', 'null', '{}', JSON.stringify({ version: 2, state: createInitialState() })]) {
    const result = loadState(() => ({ getItem: () => raw, setItem: () => { throw new Error('No escribir') } }))
    assert.equal(result.canSave, false)
    assert.notEqual(result.error, '')
    assert.deepEqual(result.state, createInitialState())
  }
})

test('la validación rechaza referencias, cantidades, duplicados y fechas inválidas', () => {
  const initial = createInitialState()
  assert.equal(isShoppingState(initial), true)
  for (const invalid of [
    { ...initial, pending: [{ productId: 'ausente', quantity: 1 }] },
    { ...initial, pending: [{ productId: 'huevos', quantity: 1.5 }] },
    { ...initial, pending: [initial.pending[0], initial.pending[0]] },
    { ...initial, catalog: [...initial.catalog, initial.catalog[0]] },
    { ...initial, history: [{ id: 'a', productId: 'leche', name: 'Leche', unit: 'litro', quantity: 1, purchasedAt: 'ayer' }] },
  ]) assert.equal(isShoppingState(invalid), false)
})

test('almacenamiento bloqueado o sin espacio muestra error sin lanzar excepciones', () => {
  const blocked = () => { throw new Error('Acceso bloqueado') }
  assert.equal(loadState(blocked).canSave, false)
  assert.notEqual(saveState(blocked, createInitialState()), '')
  assert.notEqual(saveState(() => ({ getItem: () => null, setItem: () => { throw new Error('Cuota agotada') } }), createInitialState()), '')
})
