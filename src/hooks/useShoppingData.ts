import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyContext, ShoppingState } from '../types.ts'
import { loadState, saveState } from '../lib/storage.ts'
import { addProduct, recordPurchase, removePending, updateQuantity } from '../lib/shopping.ts'
import { parseMutationResult, parseSharedState, sharedError } from '../lib/shared-shopping.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { supabase } from '../lib/supabase.ts'

export function useShoppingData(family: FamilyContext | null) {
  const [initial] = useState(() => family
    ? { state: { catalog: [], pending: [], history: [] } as ShoppingState, error: '', canSave: false }
    : loadState(() => window.localStorage))
  const [state, setState] = useState(initial.state)
  const [error, setError] = useState(initial.error)
  const [ready, setReady] = useState(!family)
  const [busy, setBusy] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const active = useRef(true)
  const writing = useRef(false)
  const sequence = useRef(0)
  const reading = useRef<AbortController | null>(null)
  const pending = useRef<{ signature: string; id: string } | null>(null)
  const invalidateRead = useCallback(() => {
    ++sequence.current
    reading.current?.abort()
    reading.current = null
  }, [])

  useEffect(() => {
    if (!family && initial.canSave) {
      // El estado del aviso depende del resultado de escribir fuera de React.
      // oxlint-disable-next-line react/set-state-in-effect
      setError(saveState(() => window.localStorage, state))
    }
  }, [state, family, initial.canSave])

  const refresh = useCallback(async (force = false): Promise<boolean> => {
    if (!family || !supabase) return true
    if (!force && (reading.current || writing.current)) return false
    reading.current?.abort()
    const controller = new AbortController()
    reading.current = controller
    const request = ++sequence.current
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    try {
      const response = await supabase.rpc('get_family_shopping').abortSignal(controller.signal)
      if (response.error) throw new Error(sharedError(response.error.code))
      const snapshot = parseSharedState(response.data)
      if (active.current && request === sequence.current) {
        setState(snapshot); setError(''); setReady(true); setLastSync(new Date())
      }
      return true
    } catch (failure) {
      if (active.current && request === sequence.current) setError(failure instanceof Error ? failure.message : 'No pudimos actualizar la lista familiar.')
      return false
    } finally {
      window.clearTimeout(timeout)
      if (reading.current === controller) reading.current = null
    }
  }, [family])

  useEffect(() => {
    active.current = true
    if (!family) return () => { active.current = false }
    // Esta actualización sincroniza con la red y espera una respuesta antes de renderizar.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh(true)
    const update = () => { if (!document.hidden) void refresh() }
    const interval = window.setInterval(update, 3000)
    window.addEventListener('focus', update)
    window.addEventListener('online', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      active.current = false; invalidateRead()
      window.clearInterval(interval)
      window.removeEventListener('focus', update)
      window.removeEventListener('online', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [family, refresh, invalidateRead])

  async function mutate(command: ShoppingCommand): Promise<MutationResult> {
    if (!family) {
      switch (command.type) {
        case 'add': {
          const result = addProduct(state, command, crypto.randomUUID())
          setState(result.state)
          return { kind: result.kind, product: result.product }
        }
        case 'update': setState(updateQuantity(state, command.productId, command.quantity)); break
        case 'remove': setState(removePending(state, command.productId)); break
        case 'buy': setState(recordPurchase(state, command.productId, command.quantity, crypto.randomUUID(), new Date().toISOString())); break
        default: throw new Error('La importación requiere una familia conectada.')
      }
      return { kind: 'ok' }
    }
    if (!supabase || !ready || error || writing.current) throw new Error('Esperá a que la lista termine de actualizarse.')
    writing.current = true; setBusy(true)
    invalidateRead()
    const signature = JSON.stringify(command)
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() }
    const { type, ...payload } = command
    try {
      const response = await supabase.rpc('mutate_shopping', { p_request_id: pending.current.id, p_action: type, p_payload: payload }).abortSignal(AbortSignal.timeout(15000))
      if (response.error) {
        // Conservamos el identificador ante un fallo de red: el servidor pudo guardar.
        if (response.error.code && response.error.code !== '57014') pending.current = null
        await refresh(true)
        throw new Error(sharedError(response.error.code))
      }
      const result = parseMutationResult(response.data)
      pending.current = null
      await refresh(true)
      return result
    } finally {
      writing.current = false
      if (active.current) setBusy(false)
    }
  }

  return { state, error, ready, busy, lastSync, refresh, mutate }
}
