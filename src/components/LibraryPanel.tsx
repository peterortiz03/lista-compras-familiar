import { useState } from 'react'
import type { Product } from '../types.ts'
import { UNITS } from '../types.ts'
import { CATEGORIES } from '../lib/categories.ts'
import { LIBRARY, libraryMatch } from '../lib/library.ts'
import { normalizeName } from '../lib/shopping.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { ProductThumbnail } from './ProductThumbnail.tsx'

export function LibraryPanel({ catalog, onAction, onClose }: {
  catalog: Product[]
  onAction: (command: ShoppingCommand) => Promise<MutationResult>
  onClose: (notice?: string) => void
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState(new Map<string, string | null>())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const search = normalizeName(query)
  const rows = LIBRARY.map(entry => ({ entry, match: libraryMatch(entry, catalog) }))
  const visible = rows.filter(({ entry }) => (!category || entry.category === category)
    && (entry.key.includes(search) || entry.aliases.some(alias => normalizeName(alias).includes(search))))
  const selectable = rows.filter(({ entry, match }) => entry.category === category && !match)

  async function addSelection() {
    setBusy(true)
    setError('')
    try {
      const products = LIBRARY.flatMap(entry => {
        if (!selected.has(entry.id)) return []
        const target = selected.get(entry.id)
        const product = target ? catalog.find(item => item.id === target) : null
        return [{
          id: entry.id, name: entry.name, unit: entry.unit, category: entry.category,
          ...(target ? { restoreId: target, revision: product?.revision } : {}),
        }]
      })
      const result = await onAction({ type: 'catalog_library', products })
      if (result.kind !== 'library') throw new Error('No pudimos confirmar la incorporación.')
      onClose(`Agregados ${result.added} · Omitidos ${result.skipped} · Recuperados ${result.restored}`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo agregar la selección.')
    } finally { setBusy(false) }
  }

  return <section className="surface p-5 sm:p-6" aria-labelledby="library-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="library-title" className="text-xl font-bold">Biblioteca argentina</h2>
      <button type="button" className="button-secondary" onClick={() => onClose()} disabled={busy}>Volver al catálogo</button>
    </div>
    <fieldset disabled={busy} className="mt-4 min-w-0">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="field-label" htmlFor="library-search">Buscar productos</label>
          <input id="library-search" type="search" className="field" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div><label className="field-label" htmlFor="library-category">Categoría</label>
          <select id="library-category" className="field" value={category} onChange={event => setCategory(event.target.value)}>
            <option value="">Todas</option>
            {CATEGORIES.filter(item => LIBRARY.some(entry => entry.category === item)).map(item => <option key={item}>{item}</option>)}
          </select></div>
      </div>
      {category && selectable.length > 0 && <button type="button" className="button-secondary mt-3" onClick={() => {
        setSelected(previous => {
          const next = new Map(previous)
          for (const { entry } of selectable) next.set(entry.id, null)
          return next
        })
      }}>Seleccionar categoría</button>}
      <div className="sticky top-0 z-10 mt-3 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white py-2">
        <span className="text-sm text-muted" role="status">{selected.size} seleccionados</span>
        <button type="button" className="button-primary" disabled={!selected.size} onClick={() => void addSelection()}>
          {busy ? 'Agregando…' : `Agregar ${selected.size} al catálogo`}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
      {visible.length === 0 && <p className="py-4 text-sm text-muted">No hay coincidencias en la biblioteca.</p>}
      <ul className="divide-y divide-line" aria-label="Productos de biblioteca">
        {visible.map(({ entry, match }) => <li key={entry.id} className="flex items-center gap-3 py-2">
          <ProductThumbnail product={{ id: entry.id, libraryId: entry.id, name: entry.name, category: entry.category, unit: entry.unit }} />
          <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{entry.name}</span>
              <span className="block text-xs text-muted">{UNITS.find(unit => unit.value === entry.unit)?.label} · {entry.category}</span>
              {match && <span className="block text-xs text-forest">{match.active === false ? 'Producto quitado · Seleccioná para recuperar' : 'Ya en tu catálogo'}</span>}
            </span>
            <input type="checkbox" className="size-5 shrink-0" disabled={!!match && match.active !== false}
              checked={selected.has(entry.id) || (!!match && match.active !== false)}
              onChange={event => {
                const checked = event.currentTarget.checked
                setSelected(previous => {
                  const next = new Map(previous)
                  if (checked) next.set(entry.id, match?.id ?? null)
                  else next.delete(entry.id)
                  return next
                })
              }} />
          </label>
        </li>)}
      </ul>
    </fieldset>
  </section>
}
