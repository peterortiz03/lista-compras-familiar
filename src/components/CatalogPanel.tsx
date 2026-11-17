import { useState } from 'react'
import type { FormEvent } from 'react'
import { UNITS } from '../types.ts'
import type { Product, Unit } from '../types.ts'
import { cleanName, normalizeName } from '../lib/shopping.ts'
import type { ShoppingCommand } from '../lib/shared-shopping.ts'

export function CatalogPanel({ products, onAction }: { products: Product[]; onAction: (command: ShoppingCommand) => Promise<void> }) {
  const [query, setQuery] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('unidad')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const visible = products.filter(product => (showRemoved || product.active !== false) && normalizeName(product.name).includes(normalizeName(query)))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!cleanName(name)) { setError('Ingresá un nombre de producto.'); return }
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await onAction(editing ? { type: 'catalog_update', productId: editing.id, name, revision: editing.revision } : { type: 'catalog_add', name, unit })
      setEditing(null); setName(''); setUnit('unidad'); setNotice('Producto guardado en el catálogo.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar el producto.') }
    finally { setBusy(false) }
  }

  async function toggle(product: Product) {
    if (product.active !== false && !window.confirm(`¿Quitar ${product.name} de las sugerencias? Sus pendientes y compras se conservan. Podrás recuperarlo desde este catálogo.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await onAction({ type: product.active === false ? 'catalog_restore' : 'catalog_archive', productId: product.id, revision: product.revision })
      if (editing?.id === product.id) { setEditing(null); setName('') }
      setNotice(product.active === false ? 'Producto recuperado en las sugerencias.' : 'Producto quitado de las sugerencias.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo modificar el producto.') }
    finally { setBusy(false) }
  }

  return <section className="surface p-5 sm:p-6" aria-labelledby="catalog-title">
    <h2 id="catalog-title" className="text-xl font-bold">Catálogo de productos</h2>
    <p className="mt-2 text-sm text-muted">Todos los productos conocidos, sin controlar stock. Los activos aparecen como sugerencias al agregar un faltante.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <p role="status" className={notice ? 'mt-4 text-sm text-forest' : 'sr-only'}>{notice}</p>
    <fieldset disabled={busy} className="mt-5 min-w-0 space-y-5">
      <form onSubmit={save} noValidate className="rounded-xl border border-line bg-sage p-4">
        <h3 className="mb-4 font-semibold">{editing ? 'Editar nombre' : 'Crear un producto'}</h3>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="catalog-name">Nombre</label><input className="field" id="catalog-name" value={name} maxLength={80} onChange={event => { setName(event.target.value); setError('') }} /></div><div><label className="field-label" htmlFor="catalog-unit">Unidad</label><select className="field" id="catalog-unit" value={unit} disabled={!!editing} onChange={event => setUnit(event.target.value as Unit)}>{UNITS.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div></div>
        <p className="mt-3 text-xs text-muted">Crear aquí no agrega un pendiente. La unidad se define al crear y se conserva para evitar conversiones de compras anteriores.</p>
        <div className="mt-4 flex flex-wrap gap-3"><button className="button-primary">{editing ? 'Guardar nombre' : 'Crear producto'}</button>{editing && <button className="button-secondary" type="button" onClick={() => { setEditing(null); setName(''); setUnit('unidad'); setError('') }}>Cancelar edición</button>}</div>
      </form>
      <div><label className="field-label" htmlFor="catalog-search">Buscar en el catálogo</label><input className="field" id="catalog-search" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input className="size-5" type="checkbox" checked={showRemoved} onChange={event => setShowRemoved(event.target.checked)} />Mostrar también productos quitados</label>
      <ul className="divide-y divide-line" aria-label="Productos del catálogo">{visible.map(product => <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{product.name}</h3><p className="text-xs text-muted">{UNITS.find(entry => entry.value === product.unit)?.label}{product.active === false ? ' · Quitado de sugerencias' : ''}</p></div>
        <div className="flex flex-wrap gap-2"><button className="button-secondary" type="button" aria-label={`Editar ${product.name} en catálogo`} onClick={() => { setEditing(product); setName(product.name); setUnit(product.unit); setError(''); document.getElementById('catalog-name')?.focus() }}>Editar</button><button className="button-secondary" type="button" aria-label={`${product.active === false ? 'Recuperar' : 'Quitar'} ${product.name} del catálogo`} onClick={() => void toggle(product)}>{product.active === false ? 'Recuperar' : 'Quitar'}</button></div>
      </li>)}</ul>
      {visible.length === 0 && <p className="text-sm text-muted">No hay productos que coincidan con esta vista.</p>}
    </fieldset>
  </section>
}
