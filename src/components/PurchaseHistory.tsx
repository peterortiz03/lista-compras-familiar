import { useState } from 'react'
import type { FamilyContext, Purchase } from '../types.ts'
import { UNITS } from '../types.ts'

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export function PurchaseHistory({ history, family, onRevert }: { history: Purchase[]; family: FamilyContext | null; onRevert: (purchase: Purchase) => Promise<void> }) {
  const [showReverted, setShowReverted] = useState(false)
  const visible = history.filter(purchase => showReverted || !purchase.revertedAt)
  return <section className="surface mt-6 p-5 sm:p-6" aria-labelledby="history-title">
    <h2 id="history-title" className="text-xl font-bold">Historial de compras</h2>
    <p className="mt-2 text-sm text-muted">{family ? 'Compartido con tu familia. Cada integrante puede revertir sus compras; el responsable puede revertir cualquiera.' : 'Guardado en este navegador. Podés revertir una compra equivocada.'} Revertir devuelve la cantidad a pendientes.</p>
    <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm"><input className="size-5" type="checkbox" checked={showReverted} onChange={event => setShowReverted(event.target.checked)} />Mostrar compras revertidas</label>
    {visible.length === 0 ? <p className="mt-5 text-sm text-muted">No hay compras en esta vista.</p> :
      <ul className="mt-4 divide-y divide-line" aria-label="Historial de compras">
        {visible.map((purchase) => <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
          <div className="min-w-0 flex-1"><p className="break-words font-semibold">{purchase.name}</p><time className="text-xs text-muted" dateTime={purchase.purchasedAt}>{dateFormat.format(new Date(purchase.purchasedAt))}</time>{purchase.author && <p className="break-words text-xs text-muted">Por {purchase.author}</p>}</div>
          {purchase.note && <p className="w-full break-words text-sm text-muted">{purchase.note}</p>}
          <p className="text-sm font-semibold text-forest">{purchase.quantity.toLocaleString('es-AR')} {UNITS.find((unit) => unit.value === purchase.unit)?.short}</p>
          {purchase.revertedAt ? <p className="w-full text-xs text-muted">Revertida el {dateFormat.format(new Date(purchase.revertedAt))}</p>
            : (!family || family.ownerId === family.userId || purchase.purchasedBy === family.userId) && <button className="button-secondary" type="button" aria-label={`Revertir compra de ${purchase.name}`} onClick={() => void onRevert(purchase)}>Revertir compra</button>}
        </li>)}
      </ul>}
  </section>
}
