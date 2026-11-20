import { useState } from 'react'
import type { FamilyContext, ShoppingSession } from '../types.ts'
import { supabase } from '../lib/supabase.ts'
import { Icon } from './Icon.tsx'

export function ShoppingNotice({ family, session, onRefresh }: {
  family: FamilyContext
  session: ShoppingSession | null
  onRefresh: () => Promise<boolean>
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const mine = session?.startedBy === family.userId
  const canEnd = mine || family.ownerId === family.userId

  async function change(current: ShoppingSession | null) {
    if (!supabase || busy) return
    if (!current && !window.confirm('¿Avisar a tu familia que estás haciendo las compras? El aviso dura hasta 90 minutos.')) return
    setBusy(true); setMessage(''); setError('')
    try {
      const request = current ? supabase.rpc('end_shopping_session', { p_session_id: current.id }) : supabase.rpc('start_shopping_session')
      const { data, error: failure } = await request.abortSignal(AbortSignal.timeout(12000))
      if (failure || typeof data !== 'boolean') throw new Error('No pudimos confirmar el cambio. Actualizá la lista para ver el estado del aviso.')
      setMessage(current ? (data ? 'Aviso finalizado.' : 'Ese aviso ya terminó.') : (data ? 'Avisaste a tu familia.' : 'Ya hay una compra en curso.'))
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos actualizar el aviso.') }
    finally { await onRefresh(); setBusy(false) }
  }

  return <div className="mb-4">
    {session ? <section aria-label="Compra en curso" role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-sage p-3 text-forest">
      <span className="rounded-xl bg-white p-2"><Icon name="basket" size={20} /></span>
      <div className="min-w-0 flex-1 basis-36">
        <p className="[overflow-wrap:anywhere] font-semibold">{mine ? 'Estás haciendo las compras' : `${session.displayName} está haciendo las compras`}</p>
        <p className="mt-1 text-sm">{mine ? 'Tu familia puede seguir agregando lo que necesite.' : 'Podés seguir agregando lo que necesites a la lista.'}</p>
      </div>
      {canEnd && <button type="button" className="button-secondary disabled:opacity-50" disabled={busy} onClick={() => void change(session)}>Finalizar compra</button>}
    </section> : <button type="button" className="button-secondary disabled:opacity-50" disabled={busy} onClick={() => void change(null)}>
      <Icon name="basket" size={18} />Avisar que estoy comprando
    </button>}
    {message && <p role="status" className="mt-2 text-sm text-forest">{message}</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  </div>
}
