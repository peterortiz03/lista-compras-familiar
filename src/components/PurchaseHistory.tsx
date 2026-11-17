import type { Purchase } from '../types.ts'
import { UNITS } from '../types.ts'

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export function PurchaseHistory({ history }: { history: Purchase[] }) {
  return <section className="surface mt-6 p-5 sm:p-6" aria-labelledby="history-title">
    <h2 id="history-title" className="text-xl font-bold">Historial de compras</h2>
    <p className="mt-2 text-sm text-muted">Las más recientes primero. Se guarda en este navegador junto con tu lista.</p>
    {history.length === 0 ? <p className="mt-5 text-sm text-muted">Todavía no registraste compras.</p> :
      <ul className="mt-4 divide-y divide-line" aria-label="Historial de compras">
        {history.map((purchase) => <li key={purchase.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
          <div className="min-w-0 flex-1"><p className="break-words font-semibold">{purchase.name}</p><time className="text-xs text-muted" dateTime={purchase.purchasedAt}>{dateFormat.format(new Date(purchase.purchasedAt))}</time></div>
          <p className="text-sm font-semibold text-forest">{purchase.quantity.toLocaleString('es-AR')} {UNITS.find((unit) => unit.value === purchase.unit)?.short}</p>
        </li>)}
      </ul>}
  </section>
}
