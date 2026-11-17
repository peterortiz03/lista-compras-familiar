import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { UNITS } from '../types.ts'
import type { Product, ProductDraft, Unit } from '../types.ts'
import { cleanName, normalizeName, quantityError } from '../lib/shopping.ts'
import { CATEGORIES, suggestCategory } from '../lib/categories.ts'
import type { Category } from '../lib/categories.ts'
import { suggestProducts } from '../lib/suggestions.ts'
import type { PendingItem, Purchase } from '../types.ts'
import { Icon } from './Icon.tsx'

interface ProductFormProps {
  catalog: Product[]
  history: Purchase[]
  pending: PendingItem[]
  pendingIds: string[]
  editing: { product: Product; quantity: number; note?: string; urgent?: boolean } | null
  onAdd: (draft: ProductDraft) => Promise<Product | null>
  onSave: (productId: string, quantity: number, note: string, urgent: boolean) => Promise<void>
  onEdit: (product: Product) => void
  onCancel: () => void
}

export function ProductForm({ catalog, history, pending, pendingIds, editing, onAdd, onSave, onEdit, onCancel }: ProductFormProps) {
  const [name, setName] = useState(editing?.product.name ?? '')
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1))
  const [unit, setUnit] = useState<Unit>(editing?.product.unit ?? 'unidad')
  const [note, setNote] = useState(editing?.note ?? '')
  const [urgent, setUrgent] = useState(editing?.urgent ?? false)
  const [category, setCategory] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [duplicate, setDuplicate] = useState<Product | null>(null)
  const quantityRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const focusAfterSave = useRef(false)
  const selected = catalog.find((product) => normalizeName(product.name) === normalizeName(name))
  const activeUnit = selected?.unit ?? unit
  const suggestions = !editing
    ? suggestProducts(catalog, history, name, 5, pending)
    : []

  useEffect(() => {
    if (editing) {
      quantityRef.current?.focus()
      quantityRef.current?.select()
    }
  }, [editing])

  useEffect(() => {
    if (!busy && focusAfterSave.current) {
      focusAfterSave.current = false
      nameRef.current?.focus()
    }
  }, [busy])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setDuplicate(null)
    const amount = Number(quantity.replace(',', '.'))
    const validation = quantityError(amount, activeUnit)
    if (!cleanName(name)) {
      setError('Ingresá el nombre del producto.')
      return
    }
    if (validation) {
      setError(validation)
      return
    }
    setError('')
    if (busy) return
    setBusy(true)
    try {
      if (editing) {
        await onSave(editing.product.id, amount, note, urgent)
      } else {
        const existing = await onAdd({ name, quantity: amount, unit: activeUnit, note, urgent, category: selected?.category ?? category ?? suggestCategory(name) })
        if (existing) {
          setDuplicate(existing)
          return
        }
        setName(''); setNote(''); setUrgent(false); setCategory(null)
        setQuantity('1')
        setUnit('unidad')
        focusAfterSave.current = true
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar. Intentá actualizar la lista.')
    } finally { setBusy(false) }
  }

  return (
    <section id="agregar-producto" className="surface scroll-mt-6 p-5 sm:p-6" aria-labelledby="form-title">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-sage text-forest"><Icon name={editing ? 'edit' : 'plus'} /></span>
        <div>
          <h2 id="form-title" className="text-lg font-bold tracking-tight">{editing ? 'Editar cantidad' : 'Sumá a la lista'}</h2>
          <p className="mt-0.5 text-sm text-muted">{editing ? 'Actualizá lo que hace falta.' : '¿Qué hace falta en casa?'}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          <div>
            <label className="field-label" htmlFor="product-name">Producto</label>
            <input ref={nameRef} id="product-name" className="field" placeholder="Ej.: Manzanas" value={name} maxLength={80} readOnly={!!editing} autoComplete="off" aria-describedby={error ? 'form-error' : undefined} onChange={(event) => { setName(event.target.value); setError(''); setDuplicate(null) }} />
            {suggestions.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white">
                <p className="px-3 pt-3 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{name ? 'Coincidencias' : 'Favoritos y compras habituales'}</p>
                <ul aria-label="Sugerencias de productos">
                  {suggestions.map((product) => (
                    <li key={product.id}>
                      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sage" onClick={() => { setName(product.name); setUnit(product.unit); setDuplicate(null); quantityRef.current?.focus() }}>
                        <span className="font-medium">{product.favorite ? '★ ' : ''}{product.name}</span>
                        <span className="text-xs text-muted">{pendingIds.includes(product.id) ? 'Ya pendiente' : UNITS.find((entry) => entry.value === product.unit)?.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-3">
            <div>
              <label className="field-label" htmlFor="product-quantity">Cantidad</label>
              <input ref={quantityRef} id="product-quantity" className="field" type="text" inputMode={activeUnit === 'kg' || activeUnit === 'litro' ? 'decimal' : 'numeric'} value={quantity} maxLength={12} aria-invalid={!!error} aria-describedby={error ? 'form-error' : 'quantity-help'} onChange={(event) => { setQuantity(event.target.value); setError(''); setDuplicate(null) }} />
            </div>
            <div>
              <label className="field-label" htmlFor="product-unit">Unidad</label>
              <select id="product-unit" className="field" value={activeUnit} disabled={!!selected || !!editing} onChange={(event) => { setUnit(event.target.value as Unit); setError('') }}>
                {UNITS.map((entry) => <option key={entry.value} value={entry.value}>{entry.label}</option>)}
              </select>
            </div>
          </div>
          {!selected && !editing && <div><label className="field-label" htmlFor="product-category">Categoría sugerida (podés cambiarla)</label><select id="product-category" className="field" value={category ?? suggestCategory(name)} onChange={event => setCategory(event.target.value as Category)}>{CATEGORIES.map(entry => <option key={entry}>{entry}</option>)}</select></div>}
          <div><label className="field-label" htmlFor="product-note">Nota opcional</label><input id="product-note" className="field" value={note} maxLength={300} placeholder="Ej.: cortados finitos" onChange={event => setNote(event.target.value)} /></div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5" checked={urgent} onChange={event => setUrgent(event.target.checked)} />Urgente</label>
          <p id="quantity-help" className="text-xs leading-relaxed text-muted">{selected ? 'La unidad es la del producto guardado en el catálogo. ' : ''}Unidades y paquetes: enteros. Kg y litros: hasta 3 decimales (ej.: 1,5).</p>
          {error && <p id="form-error" role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {duplicate && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p><strong>{duplicate.name}</strong> ya está pendiente. Podés editar su cantidad y nota.</p>
              <button type="button" className="mt-2 min-h-11 font-bold underline underline-offset-4" onClick={() => onEdit(duplicate)}>Editar cantidad existente <span aria-hidden="true">→</span></button>
            </div>
          )}
          <button type="submit" className="button-primary w-full"><Icon name={editing ? 'check' : 'plus'} size={18} />{editing ? 'Guardar cantidad' : 'Agregar producto'}</button>
          {editing && <button type="button" className="button-secondary w-full" onClick={onCancel}>Cancelar edición</button>}
        </fieldset>
      </form>
      {!editing && <p className="mt-4 border-t border-line pt-4 text-xs leading-relaxed text-muted">Cada producto nuevo se suma al catálogo y a tus sugerencias.</p>}
    </section>
  )
}
