import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applicationServerKey, preparePush, pushSupport, registerPush, unregisterPush, usesConfiguredKey } from '../lib/web-push.ts'

type Preference = 'checking' | 'on' | 'off' | 'blocked' | 'unknown'
const statusText: Record<Preference, string> = {
  checking: 'Comprobando este dispositivo…',
  on: 'Activadas en este dispositivo.',
  off: 'Desactivadas en este dispositivo.',
  blocked: 'Bloqueadas por los permisos del navegador.',
  unknown: 'No pudimos comprobar el estado de los avisos.',
}
const permissionDenied = () => Notification.permission === 'denied'

export function ShoppingPushSettings({ client }: { client: SupabaseClient }) {
  const support = pushSupport()
  const [preference, setPreference] = useState<Preference>('checking')
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const operation = useRef(false)
  const sequence = useRef(0)
  const staleKey = subscription && !usesConfiguredKey(subscription)

  const inspect = useCallback(async () => {
    if (support !== 'available' || operation.current) return
    const request = ++sequence.current
    try {
      const worker = await preparePush()
      const current = await worker.pushManager.getSubscription()
      if (sequence.current !== request) return
      setRegistration(worker)
      setSubscription(current)
      if (Notification.permission === 'denied') { setPreference('blocked'); return }
      if (Notification.permission !== 'granted' || !current || !usesConfiguredKey(current)
        || (current.expirationTime !== null && current.expirationTime <= Date.now())) { setPreference('off'); return }
      const { data, error: failure } = await client.rpc('has_shopping_push', { p_endpoint: current.endpoint }).abortSignal(AbortSignal.timeout(8000))
      if (failure || typeof data !== 'boolean') throw new Error('Estado no disponible')
      if (sequence.current === request) setPreference(data ? 'on' : 'off')
    } catch { if (sequence.current === request) setPreference('unknown') }
  }, [client, support])

  useEffect(() => {
    if (support !== 'available') return
    function checkWhenVisible() { if (!document.hidden) void inspect() }
    // La lectura de la suscripción y su registro se resuelven de forma asíncrona.
    // oxlint-disable-next-line react/set-state-in-effect
    void inspect()
    window.addEventListener('focus', checkWhenVisible)
    document.addEventListener('visibilitychange', checkWhenVisible)
    return () => {
      // Se invalida la última solicitud aunque haya empezado después de este efecto.
      // oxlint-disable-next-line react-hooks/exhaustive-deps
      ++sequence.current
      window.removeEventListener('focus', checkWhenVisible)
      document.removeEventListener('visibilitychange', checkWhenVisible)
    }
  }, [inspect, support])

  async function enable() {
    if (!registration || !applicationServerKey || operation.current) return
    if (permissionDenied()) { setPreference('blocked'); return }
    const request = ++sequence.current
    operation.current = true
    setBusy(true); setError('')
    try {
      // Invocar dentro del gesto también permite que Safari solicite el permiso.
      const current = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      if (sequence.current !== request) { if (!subscription) await current.unsubscribe(); return }
      setSubscription(current)
      await registerPush(client, current)
      if (sequence.current === request) setPreference('on')
    } catch {
      if (sequence.current !== request) return
      if (permissionDenied()) setPreference('blocked')
      else {
        setPreference('unknown')
        setError('No pudimos activar los avisos. Revisá la conexión e intentá de nuevo.')
      }
    } finally { operation.current = false; setBusy(false) }
  }

  async function disable() {
    if (!subscription || operation.current) return
    ++sequence.current
    operation.current = true
    setBusy(true); setError('')
    try {
      if (await unregisterPush(client, subscription)) setSubscription(null)
      setPreference(Notification.permission === 'denied' ? 'blocked' : 'off')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No pudimos desactivar los avisos.') }
    finally { operation.current = false; setBusy(false) }
  }

  return <section aria-labelledby="push-settings-title" className="mt-5 rounded-xl border border-line bg-sage p-4">
    <h4 id="push-settings-title" className="font-semibold">Recibir avisos cuando alguien está haciendo las compras</h4>
    {support === 'install-on-ios' ? <p className="mt-2 text-sm text-muted">En iPhone o iPad con iOS 16.4 o posterior, usá Compartir y «Agregar a pantalla de inicio». Abrí En casa desde su ícono y volvé a esta opción.</p>
      : support === 'unsupported' ? <p className="mt-2 text-sm text-muted">Este dispositivo no admite notificaciones push. Vas a seguir viendo los avisos en la lista.</p>
        : support === 'unconfigured' ? <p className="mt-2 text-sm text-muted">Las notificaciones push todavía no están disponibles. Podés consultar los avisos en la lista familiar.</p>
          : <>
            <p role="status" className="mt-2 text-sm text-muted">{busy ? 'Actualizando avisos…' : statusText[preference]}</p>
            {preference === 'blocked' && <p className="mt-2 text-sm text-muted">Para habilitarlas, revisá los permisos de notificaciones de En casa en el navegador o en los ajustes del dispositivo.</p>}
            {staleKey && <p className="mt-2 text-sm text-muted">Para volver a activar los avisos, quitá la suscripción anterior de este dispositivo.</p>}
            {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {registration && !staleKey && (preference === 'off' || preference === 'unknown') &&
                <button type="button" className="button-primary disabled:opacity-50" disabled={busy} onClick={() => void enable()}>Activar avisos</button>}
              {subscription && <button type="button" className="button-secondary disabled:opacity-50" disabled={busy} onClick={() => void disable()}>Desactivar en este dispositivo</button>}
              {preference === 'unknown' && <button type="button" className="button-secondary disabled:opacity-50" disabled={busy} onClick={() => void inspect()}>Comprobar estado</button>}
            </div>
          </>}
  </section>
}
