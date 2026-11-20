import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { UNITS } from '../types.ts'
import type { Product, Unit } from '../types.ts'
import { cleanName } from '../lib/shopping.ts'
import { CATEGORIES, suggestCategory } from '../lib/categories.ts'
import type { Category } from '../lib/categories.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { CatalogPhotoField } from './CatalogPhotoField.tsx'
import { cleanupPhotos, reservePhoto, uploadPhoto } from '../lib/product-photos.ts'
import { supabase } from '../lib/supabase.ts'

export function CatalogProductForm({ product, photosEnabled, onAction, onSave, onCancel, onWorkingChange }: {
  product: Product | null
  photosEnabled: boolean
  onAction: (command: ShoppingCommand) => Promise<MutationResult>
  onSave: () => void
  onCancel: () => void
  onWorkingChange?: (working: boolean) => void
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [unit, setUnit] = useState<Unit>(product?.unit ?? 'unidad')
  const [category, setCategory] = useState<Category | null>(product?.category ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [draftId] = useState(() => crypto.randomUUID())
  const uploaded = useRef<{ blob: Blob; path: string } | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!cleanName(name)) { setError('Ingresá un nombre de producto.'); return }
    if (busy || processing) return
    setBusy(true); onWorkingChange?.(true); setError(''); setNotice('')
    const productCategory = category ?? suggestCategory(name)
    try {
      if (photosEnabled && supabase && (photo || removePhoto)) {
        const productId = product?.id ?? draftId
        let path: string | null = null
        if (photo) {
          if (uploaded.current?.blob === photo) path = uploaded.current.path
          else {
            path = await reservePhoto(supabase, productId, product?.revision, !product, photo.type)
            setNotice('Subiendo fotografía…')
            await uploadPhoto(supabase, path, photo)
            uploaded.current = { blob: photo, path }
          }
        }
        await onAction({ type: 'catalog_save_photo', productId, isNew: !product, name, unit, category: productCategory, revision: product?.revision, photoPath: path, removePhoto })
        void cleanupPhotos(supabase).catch(() => {})
      } else await onAction(product ? { type: 'catalog_update', productId: product.id, name, category: productCategory, revision: product.revision } : { type: 'catalog_add', name, unit, category: productCategory })
      onSave()
    } catch (failure) { setNotice(''); setError(failure instanceof Error ? failure.message : 'No se pudo guardar el producto.') }
    finally { setBusy(false); onWorkingChange?.(false) }
  }

  return <form onSubmit={save} noValidate className="rounded-xl border border-line bg-sage p-4">
    <h3 className="mb-4 font-semibold">{product ? 'Editar producto' : 'Crear un producto'}</h3>
    <p role="status" className={notice ? 'mb-3 text-sm text-forest' : 'sr-only'}>{notice}</p>
    {error && <p role="alert" className="mb-3 text-sm text-red-800">{error}</p>}
    <fieldset disabled={busy || processing} className="min-w-0">
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="catalog-name">Nombre</label><input className="field" id="catalog-name" autoFocus value={name} maxLength={80} onChange={event => { setName(event.target.value); setError('') }} /></div><div><label className="field-label" htmlFor="catalog-unit">Unidad</label><select className="field" id="catalog-unit" value={unit} disabled={!!product} onChange={event => setUnit(event.target.value as Unit)}>{UNITS.map(entry => <option key={entry.value} value={entry.value}>{entry.label}</option>)}</select></div></div>
      <div className="mt-4"><label className="field-label" htmlFor="catalog-category">Categoría</label><select id="catalog-category" className="field" value={category ?? suggestCategory(name)} onChange={event => setCategory(event.target.value as Category)}>{CATEGORIES.map(entry => <option key={entry}>{entry}</option>)}</select></div>
      {photosEnabled && <CatalogPhotoField product={product} blob={photo} removed={removePhoto} onChange={(blob, removed) => { setPhoto(blob); setRemovePhoto(removed); uploaded.current = null }} onProcessing={working => { setProcessing(working); onWorkingChange?.(working) }} />}
      <p className="mt-3 text-xs text-muted">Los productos se guardan en el catálogo. Su unidad se define al crearlos.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button className="button-primary" type="submit">{busy ? 'Guardando…' : product ? 'Guardar producto' : 'Crear producto'}</button>
        <button className="button-secondary" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </fieldset>
  </form>
}
