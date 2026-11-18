import { lazy, Suspense, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type { FormEvent } from 'react'
import { UNITS } from '../types.ts'
import type { Product, Unit } from '../types.ts'
import { cleanName, normalizeName } from '../lib/shopping.ts'
import { CATEGORIES, suggestCategory } from '../lib/categories.ts'
import type { Category } from '../lib/categories.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { CatalogPhotoField } from './CatalogPhotoField.tsx'
import { ProductThumbnail } from './ProductThumbnail.tsx'
import { cleanupPhotos, reservePhoto, uploadPhoto } from '../lib/product-photos.ts'
import { supabase } from '../lib/supabase.ts'

const LibraryPanel = lazy(() => import('./LibraryPanel.tsx').then(module => ({ default: module.LibraryPanel })))

export function CatalogPanel({ products, photosEnabled, onAction }: { products: Product[]; photosEnabled: boolean; onAction: (command: ShoppingCommand) => Promise<MutationResult> }) {
  const [query, setQuery] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const nameInput = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('unidad')
  const [category, setCategory] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [draftId, setDraftId] = useState(() => crypto.randomUUID())
  const uploaded = useRef<{ blob: Blob; path: string } | null>(null)
  function closeForm() {
    setFormOpen(false)
    const target = previousFocus.current
    requestAnimationFrame(() => target?.focus())
  }
  function reset() {
    setEditing(null); setName(''); setUnit('unidad'); setCategory(null)
    setPhoto(null); setRemovePhoto(false); uploaded.current = null; setDraftId(crypto.randomUUID())
  }

  function openForm(trigger: HTMLElement, product: Product | null) {
    previousFocus.current = trigger
    flushSync(() => {
      reset()
      setFormOpen(true)
      setEditing(product)
      setCategory(product?.category ?? null)
      setName(product?.name ?? '')
      setUnit(product?.unit ?? 'unidad')
      setError('')
    })
    nameInput.current?.focus()
  }
  const visible = products.filter(product => (showRemoved || product.active !== false) && normalizeName(product.name).includes(normalizeName(query)))

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!cleanName(name)) { setError('Ingresá un nombre de producto.'); return }
    if (busy || processing) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (photosEnabled && supabase && (photo || removePhoto)) {
        const productId = editing?.id ?? draftId
        let path: string | null = null
        if (photo) {
          if (uploaded.current?.blob === photo) path = uploaded.current.path
          else {
            path = await reservePhoto(supabase, productId, editing?.revision, !editing, photo.type)
            setNotice('Subiendo fotografía…')
            await uploadPhoto(supabase, path, photo)
            uploaded.current = { blob: photo, path }
          }
        }
        await onAction({ type: 'catalog_save_photo', productId, isNew: !editing, name, unit, category: category ?? suggestCategory(name), revision: editing?.revision, photoPath: path, removePhoto })
        void cleanupPhotos(supabase).catch(() => {})
      } else await onAction(editing ? { type: 'catalog_update', productId: editing.id, name, category: category ?? suggestCategory(name), revision: editing.revision } : { type: 'catalog_add', name, unit, category: category ?? suggestCategory(name) })
      reset(); closeForm(); setNotice('Producto guardado en el catálogo.')
    } catch (failure) { setNotice(''); setError(failure instanceof Error ? failure.message : 'No se pudo guardar el producto.') }
    finally { setBusy(false) }
  }

  async function toggle(product: Product) {
    if (product.active !== false && !window.confirm(`¿Quitar ${product.name} de las sugerencias? Sus pendientes y compras se conservan. Podrás recuperarlo desde este catálogo.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await onAction({ type: product.active === false ? 'catalog_restore' : 'catalog_archive', productId: product.id, revision: product.revision })
      if (editing?.id === product.id) { reset(); closeForm() }
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
    <fieldset disabled={busy || processing} className="mt-5 min-w-0 space-y-5">
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1 basis-44"><label className="field-label" htmlFor="catalog-search">Buscar en el catálogo</label><input className="field" id="catalog-search" type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <button type="button" className="button-primary self-end" onClick={event => openForm(event.currentTarget, null)}>Crear producto</button>
        <button id="explore-library" type="button" className="button-secondary self-end" onClick={() => {
          reset(); setFormOpen(false); setLibraryOpen(true); setNotice('')
        }}>Explorar biblioteca</button>
      </div>
      {formOpen && <form onSubmit={save} noValidate className="rounded-xl border border-line bg-sage p-4">
        <h3 className="mb-4 font-semibold">{editing ? 'Editar producto' : 'Crear un producto'}</h3>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="catalog-name">Nombre</label><input className="field" id="catalog-name" ref={nameInput} value={name} maxLength={80} onChange={event => { setName(event.target.value); setError('') }} /></div><div><label className="field-label" htmlFor="catalog-unit">Unidad</label><select className="field" id="catalog-unit" value={unit} disabled={!!editing} onChange={event => setUnit(event.target.value as Unit)}>{UNITS.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div></div>
        <div className="mt-4"><label className="field-label" htmlFor="catalog-category">Categoría</label><select id="catalog-category" className="field" value={category ?? suggestCategory(name)} onChange={event => setCategory(event.target.value as Category)}>{CATEGORIES.map(entry => <option key={entry}>{entry}</option>)}</select></div>
        {photosEnabled && <CatalogPhotoField key={editing?.id ?? draftId} product={editing} blob={photo} removed={removePhoto} onChange={(blob, removed) => { setPhoto(blob); setRemovePhoto(removed); uploaded.current = null }} onProcessing={setProcessing} />}
        <p className="mt-3 text-xs text-muted">Crear aquí no agrega un pendiente. La unidad se define al crear y se conserva para evitar conversiones de compras anteriores.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="button-primary">{busy ? 'Guardando…' : editing ? 'Guardar producto' : 'Crear producto'}</button>
          <button className="button-secondary" type="button" onClick={() => { reset(); closeForm(); setError('') }}>Cancelar</button>
        </div>
      </form>}
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
