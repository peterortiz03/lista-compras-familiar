import { lazy, Suspense, useRef, useState } from 'react'
import { UNITS } from '../types.ts'
import type { Product } from '../types.ts'
import { normalizeName } from '../lib/shopping.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { ProductThumbnail } from './ProductThumbnail.tsx'
import { CatalogProductForm } from './CatalogProductForm.tsx'

const LibraryPanel = lazy(() => import('./LibraryPanel.tsx').then(module => ({ default: module.LibraryPanel })))

export function CatalogPanel({ products, photosEnabled, onAction, onSetup }: {
  products: Product[]; photosEnabled: boolean; onAction: (command: ShoppingCommand) => Promise<MutationResult>; onSetup?: () => void
}) {
  const [query, setQuery] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)
  const [form, setForm] = useState<{ product: Product | null; revision: number } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [formWorking, setFormWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function closeForm() {
    setForm(null)
    const target = previousFocus.current
    requestAnimationFrame(() => target?.focus())
  }

  function openForm(trigger: HTMLElement, product: Product | null) {
    previousFocus.current = trigger
    setNotice('')
    setError('')
    setForm(current => ({ product, revision: (current?.revision ?? 0) + 1 }))
  }
  const visible = products.filter(product => (showRemoved || product.active !== false) && normalizeName(product.name).includes(normalizeName(query)))

  async function toggle(product: Product) {
    if (product.active !== false && !window.confirm(`¿Quitar ${product.name} de las sugerencias? Sus pendientes y compras se conservan. Podrás recuperarlo desde este catálogo.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await onAction({ type: product.active === false ? 'catalog_restore' : 'catalog_archive', productId: product.id, revision: product.revision })
      if (form?.product?.id === product.id) closeForm()
      setNotice(product.active === false ? 'Producto recuperado en las sugerencias.' : 'Producto quitado de las sugerencias.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo modificar el producto.') }
    finally { setBusy(false) }
  }

  async function favorite(product: Product) {
    setBusy(true); setError('')
    try { await onAction({ type: 'catalog_favorite', productId: product.id, revision: product.revision, favorite: !product.favorite }) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo cambiar el favorito.') }
    finally { setBusy(false) }
  }
  if (libraryOpen) return <Suspense fallback={<p role="status">Cargando biblioteca…</p>}>
    <LibraryPanel catalog={products} onAction={onAction} onClose={message => {
      setLibraryOpen(false)
      if (message) setNotice(message)
      requestAnimationFrame(() => document.getElementById('explore-library')?.focus())
    }} />
  </Suspense>

  return <section className="surface p-5 sm:p-6" aria-labelledby="catalog-title">
    <h2 id="catalog-title" className="text-xl font-bold">Catálogo de productos</h2>
    <p className="mt-2 text-sm text-muted">Todos los productos conocidos, sin controlar stock. Los activos aparecen como sugerencias al agregar un faltante.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <p role="status" className={notice ? 'mt-4 text-sm text-forest' : 'sr-only'}>{notice}</p>
    <fieldset disabled={busy || formWorking} className="mt-5 min-w-0 space-y-5">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1 basis-44"><label className="field-label" htmlFor="catalog-search">Buscar en el catálogo</label><input className="field" id="catalog-search" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <button type="button" className="button-primary self-end" onClick={event => openForm(event.currentTarget, null)}>Crear producto</button>
        <button id="explore-library" type="button" className="button-secondary self-end" onClick={() => {
          setForm(null); setLibraryOpen(true); setNotice('')
        }}>Explorar biblioteca</button>
        {onSetup && <button type="button" className="button-secondary self-end" onClick={onSetup}>Preparar catálogo</button>}
      </div>
      {form && <CatalogProductForm key={form.revision} product={form.product} photosEnabled={photosEnabled}
        onAction={onAction} onCancel={closeForm} onWorkingChange={setFormWorking}
        onSave={() => { closeForm(); setNotice('Producto guardado en el catálogo.') }} />}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input className="size-5" type="checkbox" checked={showRemoved} onChange={event => setShowRemoved(event.target.checked)} />Mostrar también productos quitados</label>
      <ul className="divide-y divide-line" aria-label="Productos del catálogo">{visible.map(product => <li key={product.id} className="catalog-product grid items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 items-center gap-3"><ProductThumbnail key={product.photoPath} product={product} />
        <div className="min-w-0 flex-1"><h3 className="[overflow-wrap:anywhere] font-semibold">{product.name}</h3><p className="text-xs text-muted">{UNITS.find(entry => entry.value === product.unit)?.label} · {product.category ?? 'Otros'}{product.active === false ? ' · Quitado de sugerencias' : ''}</p></div></div>
        <div className="col-span-1 flex flex-wrap justify-end gap-2 sm:col-span-1"><button className="icon-button text-forest" type="button" aria-pressed={!!product.favorite} aria-label={`Favorito: ${product.name}`} onClick={() => void favorite(product)}>{product.favorite ? '★' : '☆'}</button><button className="button-secondary" type="button" aria-label={`Editar ${product.name} en catálogo`} onClick={event => openForm(event.currentTarget, product)}>Editar</button><button className="button-secondary" type="button" aria-label={`${product.active === false ? 'Recuperar' : 'Quitar'} ${product.name} del catálogo`} onClick={() => void toggle(product)}>{product.active === false ? 'Recuperar' : 'Quitar'}</button></div>
      </li>)}</ul>
      {visible.length === 0 && <p className="text-sm text-muted">No hay productos que coincidan con esta vista.</p>}
    </fieldset>
  </section>
}
