import { useState } from 'react'
import type { FamilyContext, Purchase } from '../types.ts'
import { UNITS } from '../types.ts'
import { groupPurchases, HISTORY_ZONE, historyLabel } from '../lib/history.ts'
import { usePurchasePeriods } from '../hooks/usePurchasePeriods.ts'

const hour = new Intl.DateTimeFormat('es-AR', { timeZone: HISTORY_ZONE, timeStyle: 'short' })
const dateTime = new Intl.DateTimeFormat('es-AR', { timeZone: HISTORY_ZONE, dateStyle: 'short', timeStyle: 'short' })

export function PurchaseHistory({ history, family, revision, onRevert }: {
  history: Purchase[]
  family: FamilyContext | null
  revision?: string
  onRevert: (purchase: Purchase) => Promise<void>
}) {
  const [showReverted, setShowReverted] = useState(false)
  const periods = usePurchasePeriods(history, !!family, revision)
  const groups = groupPurchases(periods.purchases.filter(purchase => showReverted || !purchase.revertedAt))
  return <section className="surface p-5 sm:p-6" aria-labelledby="history-title">
    <h2 id="history-title" className="text-xl font-bold">Historial de compras</h2>
    <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input className="size-5" type="checkbox" checked={showReverted} onChange={event => setShowReverted(event.target.checked)} />Mostrar compras revertidas
    </label>
    <p className="text-xs text-muted">Revertir devuelve la cantidad a pendientes.</p>
    {periods.loading && <p role="status" className="mt-3 text-sm text-muted">Cargando historial…</p>}
    {periods.error && <div className="mt-3">
      <p role="alert" className="text-sm text-red-800">{periods.error}</p>
      <button type="button" className="button-secondary mt-2" onClick={periods.retry}>Reintentar</button>
    </div>}
    {!periods.loading && !periods.error && !groups.size && <p className="mt-4 text-sm text-muted">
      {periods.purchases.length ? 'No hay compras visibles. Activá el filtro para ver las revertidas.' : 'No hubo compras en los últimos 3 días.'}
    </p>}
    {[...groups.entries()].map(([day, purchases]) => <section key={day} className="mt-4" aria-label={historyLabel(day, periods.today)}>
      <h3 className="rounded-lg bg-sage px-3 py-2 text-sm font-semibold text-forest">{historyLabel(day, periods.today)}</h3>
      <ul className="divide-y divide-line">
        {purchases.map(purchase => <li key={purchase.id} className="grid items-start gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <p className="font-semibold">{purchase.name}</p>
            <p className="text-sm font-semibold text-forest">{purchase.quantity.toLocaleString('es-AR')} {UNITS.find(unit => unit.value === purchase.unit)?.short}</p>
            <p className="text-xs text-muted"><time dateTime={purchase.purchasedAt}>{hour.format(new Date(purchase.purchasedAt))}</time>{purchase.author && ` · Por ${purchase.author}`}</p>
            {purchase.note && <p className="text-sm text-muted">{purchase.note}</p>}
            {purchase.revertedAt && <p className="text-xs text-muted">Revertida el {dateTime.format(new Date(purchase.revertedAt))}</p>}
          </div>
          {!purchase.revertedAt && (!family || family.ownerId === family.userId || purchase.purchasedBy === family.userId) &&
            <button className="button-secondary justify-self-start" type="button" aria-label={`Revertir compra de ${purchase.name}`} onClick={() => void onRevert(purchase)}>Revertir compra</button>}
        </li>)}
      </ul>
    </section>)}
    {periods.more && !periods.error && <button className="button-secondary mt-4" type="button" disabled={periods.loading} onClick={periods.loadOlder}>
      {periods.moreInPeriod ? 'Cargar más compras del período' : 'Cargar períodos anteriores'}
    </button>}
  </section>
}
