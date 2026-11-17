import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { UNITS } from '../types.ts'
import type { Product } from '../types.ts'
import { quantityError } from '../lib/shopping.ts'

export function PurchaseDialog({ product, pending, onSave, onCancel }: {
  product: Product; pending: number; onSave: (quantity: number) => Promise<void>; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [quantity, setQuantity] = useState(String(pending))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(quantity.replace(',', '.'))
    const validation = quantityError(amount, product.unit)
    if (validation || amount > pending) {
      setError(validation ?? 'La compra no puede superar la cantidad pendiente.')
      return
    }
    if (busy) return
    setBusy(true)
    try { await onSave(amount) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo confirmar la compra.') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={(event) => { if (busy) event.preventDefault(); else onCancel() }} aria-labelledby="purchase-title" className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/40">
    <h2 id="purchase-title" className="text-xl font-bold">Registrar compra</h2>
    <p className="mt-2 break-words font-semibold">{product.name}</p>
    <p id="purchase-help" className="mt-2 text-sm text-muted">Pendiente: {pending.toLocaleString('es-AR')} {UNITS.find((unit) => unit.value === product.unit)?.short}. Podés comprar todo o solo una parte.</p>
    <form onSubmit={submit} noValidate className="mt-5 space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4">
      <label className="field-label" htmlFor="purchase-quantity">Cantidad comprada</label>
      <input id="purchase-quantity" className="field" autoFocus inputMode={product.unit === 'kg' || product.unit === 'litro' ? 'decimal' : 'numeric'} value={quantity} maxLength={12} aria-describedby={error ? 'purchase-error' : 'purchase-help'} aria-invalid={!!error} onChange={(event) => { setQuantity(event.target.value); setError('') }} />
      {error && <p id="purchase-error" role="alert" className="text-sm text-red-800">{error}</p>}
      <button className="button-primary w-full" type="submit">Confirmar compra</button>
      <button className="button-secondary w-full" type="button" onClick={onCancel}>Cancelar</button>
      </fieldset>
    </form>
  </dialog>
}
