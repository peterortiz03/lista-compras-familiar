import { useState } from 'react'
import type { Product, ShoppingState } from '../types.ts'
import { UNITS } from '../types.ts'
import { groupPending } from '../lib/categories.ts'
import { Icon } from './Icon.tsx'
import { ProductThumbnail } from './ProductThumbnail.tsx'

interface ShoppingListProps {
  state: ShoppingState
  onEdit: (product: Product) => void
  onRemove: (product: Product) => void
  onBuy: (product: Product) => void
}

const formatQuantity = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 })

export function ShoppingList({ state, onEdit, onRemove, onBuy }: ShoppingListProps) {
  const [query, setQuery] = useState('')
  const groups = groupPending(state, query)

  return (
    <section className="surface overflow-hidden" aria-labelledby="pending-title">
      <div className="border-b border-line p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="pending-title" className="text-xl font-bold tracking-tight">Por comprar <span className="ml-2 inline-flex size-7 items-center justify-center rounded-full bg-sage align-middle text-sm text-forest">{state.pending.length}</span></h2>
          <span className="hidden text-xs text-muted sm:inline">Tu próxima compra empieza acá</span>
        </div>
        <label htmlFor="pending-search" className="sr-only">Buscar en pendientes</label>
        <div className="relative">
          <Icon name="search" size={18} style={{ position: 'absolute', left: 14, top: 15, color: '#68766e' }} />
          <input id="pending-search" className="field pl-11" type="search" placeholder="Buscar en pendientes…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      {groups.length > 0 ? (
        <ul className="divide-y divide-line" aria-label="Productos pendientes">
          {groups.map(group => <li key={group.category}>
            <h3 className="bg-sage px-5 py-2 text-sm font-semibold text-forest">{group.category}</h3>
            <ul className="divide-y divide-line">{group.items.map(({ product, quantity, note, urgent, addedByName, addedAt }) => (
            <li key={product.id} className="pending-product group flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-5">
              <button className="buy-button" type="button" aria-label={`Registrar compra de ${product.name}`} title="Registrar compra completa o parcial" onClick={() => onBuy(product)}><Icon name="check" size={19} /></button>
              <ProductThumbnail key={product.photoPath} product={product} />
              <div className="min-w-0 flex-1">
                <h3 className="break-words text-[15px] font-semibold sm:text-base">{product.name}{urgent && <span className="ml-2 text-xs font-semibold text-amber-800">Urgente</span>}</h3>
                {note && <p className="mt-1 break-words text-sm text-muted">{note}</p>}
                <p className="mt-1 text-[11px] text-muted">Agregado por {addedByName ?? 'Integrante anterior'}{addedAt && <> · <time dateTime={addedAt}>{new Date(addedAt).toLocaleDateString('es-AR')}</time></>}</p>
                <p className="mt-1 text-xs text-muted">{UNITS.find((entry) => entry.value === product.unit)?.label}</p>
              </div>
              <button type="button" className="quantity-button" aria-label={`Editar cantidad de ${product.name}: ${formatQuantity.format(quantity)} ${product.unit}`} onClick={() => onEdit(product)}>
                <span className="font-bold">{formatQuantity.format(quantity)} <span className="font-medium text-muted">{UNITS.find((entry) => entry.value === product.unit)?.short}</span></span>
                <Icon name="edit" size={14} />
              </button>
              <button type="button" className="icon-button text-muted hover:bg-red-50 hover:text-red-700" aria-label={`Eliminar ${product.name} de pendientes`} title="Eliminar de pendientes" onClick={() => onRemove(product)}><Icon name="trash" size={18} /></button>
            </li>
          ))}</ul></li>)}
        </ul>
      ) : (
        <div className="px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-sage text-forest"><Icon name={state.pending.length ? 'search' : 'check'} size={26} /></span>
          <h3 className="font-bold">{state.pending.length ? 'No encontramos ese producto' : '¡Todo listo por acá!'}</h3>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">{state.pending.length ? 'Probá con otro nombre o limpiá la búsqueda.' : 'No hay productos pendientes. Sumá lo que haga falta para la próxima compra.'}</p>
          {query && <button type="button" className="button-secondary mx-auto mt-5" onClick={() => setQuery('')}>Limpiar búsqueda</button>}
        </div>
      )}
      <div className="flex items-start gap-2 border-t border-line bg-[#fcfcf9] px-5 py-4 text-xs leading-relaxed text-muted sm:px-6"><Icon name="info" size={16} style={{ flexShrink: 0, marginTop: 1 }} /><p>Tocá el círculo para registrar una compra completa o parcial. Tocá la cantidad para editarla.</p></div>
    </section>
  )
}
