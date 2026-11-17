import assert from 'node:assert/strict'
import { test } from 'node:test'
import { belongsToFamily, photoDimensions, validatePhoto } from '../src/lib/photo-rules.ts'
import { isShoppingState } from '../src/lib/storage.ts'
import { createInitialState } from '../src/data.ts'
import { importProducts } from '../src/lib/shared-shopping.ts'

test('admite imágenes acotadas, limita dimensiones sin distorsionar y rechaza SVG/HEIC/archivos vacíos', () => {
  for (const type of ['image/jpeg','image/png','image/webp']) assert.doesNotThrow(() => validatePhoto({ type, size: 1024 }))
  for (const type of ['image/svg+xml','image/heic','text/plain']) assert.throws(() => validatePhoto({ type, size: 10 }))
  for (const size of [0,13*1024*1024]) assert.throws(() => validatePhoto({ type: 'image/jpeg', size }))
  assert.deepEqual(photoDimensions(4000,3000),{ width:512,height:384 })
  assert.deepEqual(photoDimensions(3000,4000),{ width:384,height:512 })
  assert.deepEqual(photoDimensions(120,80),{ width:120,height:80 })
  for (const [w,h] of [[0,1],[NaN,10],[9000,9000]]) assert.throws(() => photoDimensions(w,h))
})
test('solo acepta rutas de la familia exacta y no importa fotos locales a otra familia', () => {
  const family='11111111-1111-4111-8111-111111111111'
  const path=`${family}/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.webp`
  assert.equal(belongsToFamily(path,family),true)
  assert.equal(belongsToFamily(path,'22222222-2222-4222-8222-222222222222'),false)
  assert.equal(belongsToFamily(`${family}/../secret.webp`,family),false)
  const state=createInitialState()
  assert.equal(isShoppingState(state),true)
  state.catalog[0].photoPath=path
  assert.equal(isShoppingState(state),true)
  assert.equal('photoPath' in importProducts(state)[0],false)
})
