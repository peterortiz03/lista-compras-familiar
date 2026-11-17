import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialState } from '../src/data.ts'
import { suggestProducts } from '../src/lib/suggestions.ts'
import { listText } from '../src/lib/share-list.ts'
test('favoritos manuales, frecuencia y coincidencias se ordenan sin duplicados ni archivados', () => {
  const state=createInitialState()
  state.catalog[2]={...state.catalog[2],favorite:true}
  state.catalog[0]={...state.catalog[0],active:false}
  state.history=[{id:'a',productId:'huevos',name:'Huevos',unit:'unidad',quantity:1,purchasedAt:'2026-11-17T10:00:00Z'}]
  const suggestions=suggestProducts(state.catalog,state.history,'')
  assert.equal(suggestions[0].id,'tomates')
  assert.equal(suggestions[1].id,'huevos')
  assert.equal(new Set(suggestions.map(p=>p.id)).size,suggestions.length)
  assert.equal(suggestions.some(p=>p.id==='leche'),false)
  assert.equal(suggestProducts(state.catalog,state.history,'HUE')[0].id,'huevos')
  assert.ok(suggestions.length<=5)
})
test('compartir incluye categoría, nota, unidad y urgencia pero no identidad ni fechas', () => {
  const state=createInitialState()
  state.pending=[{productId:'leche',quantity:2,note:'Descremada',urgent:true,addedByName:'Nombre privado',addedAt:'2026-11-17T12:00:00Z'}]
  const text=listText(state)
  assert.match(text,/Otros/);assert.match(text,/URGENTE/);assert.match(text,/2 l/);assert.match(text,/Descremada/)
  assert.doesNotMatch(text,/Nombre privado|2026/)
})
