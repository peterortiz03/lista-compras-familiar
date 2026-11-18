import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyContext, PurchaseStat, ShoppingState } from '../types.ts'
import { loadState, saveState } from '../lib/storage.ts'
import { addProduct, changeCatalogProduct, createCatalogProduct, normalizeName, recordPurchase, removePending, revertPurchase, updateQuantity } from '../lib/shopping.ts'
import { parseMutationResult, parseSharedState, sharedError } from '../lib/shared-shopping.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { supabase } from '../lib/supabase.ts'
import { cleanupPhotos } from '../lib/product-photos.ts'

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
  const cleaning = useRef(false)
  const lastCleanup = useRef(0)
  const purchaseSummary = useRef<{ revision: string; stats: PurchaseStat[] } | null>(null)
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
      const response = await supabase.rpc('get_family_list', { p_stats_revision: purchaseSummary.current?.revision ?? null }).abortSignal(controller.signal)
      if (response.error?.code === '42501' && active.current && request === sequence.current) {
        purchaseSummary.current = null
        setState({ catalog: [], pending: [], history: [] })
        setReady(false)
      }
      if (response.error?.code === 'PGRST202') throw new Error('Falta aplicar la migración 0008 de historial y biblioteca.')
      if (response.error) throw new Error(sharedError(response.error.code))
      const snapshot = parseSharedState(response.data)
      if (active.current && request === sequence.current) {
        const revision = snapshot.purchaseRevision
        const stats = snapshot.purchaseStats ?? (purchaseSummary.current?.revision === revision ? purchaseSummary.current?.stats : undefined)
        if (typeof revision !== 'string' || !Array.isArray(stats)) throw new Error('No pudimos leer las estadísticas de compras.')
        purchaseSummary.current = { revision, stats }
        setState({ ...snapshot, purchaseStats: stats }); setError(''); setReady(true); setLastSync(new Date())
        if (snapshot.photoStorage && !cleaning.current && Date.now() - lastCleanup.current > 60000) {
          cleaning.current = true; lastCleanup.current = Date.now()
          void cleanupPhotos(supabase).catch(() => {}).finally(() => { cleaning.current = false })
        }
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
          const result = addProduct(state, command, crypto.randomUUID(), new Date().toISOString())
          setState(result.state)
          return { kind: result.kind, product: result.product }
        }
        case 'update': setState(updateQuantity(state, command.productId, command.quantity, command)); break
        case 'remove': setState(removePending(state, command.productId)); break
        case 'buy': setState(recordPurchase(state, command.productId, command.quantity, crypto.randomUUID(), new Date().toISOString())); break
        case 'catalog_add': setState(createCatalogProduct(state, command.name, command.unit, crypto.randomUUID(), command.category)); break
        case 'catalog_update': setState(changeCatalogProduct(state, command.productId, { name: command.name, ...(command.category ? { category: command.category } : {}) })); break
        case 'catalog_archive': setState(changeCatalogProduct(state, command.productId, { active: false })); break
        case 'catalog_restore': setState(changeCatalogProduct(state, command.productId, { active: true })); break
        case 'catalog_favorite': setState(changeCatalogProduct(state, command.productId, { favorite: command.favorite })); break
        case 'catalog_library': {
          let next = state
          let added = 0
          let restored = 0
          for (const entry of command.products) {
            const product = next.catalog.find(item => item.libraryId === entry.id)
              ?? next.catalog.find(item => normalizeName(item.name) === normalizeName(entry.name))
            if (entry.restoreId) {
              if (product?.id === entry.restoreId && product.active === false) {
                next = changeCatalogProduct(next, product.id, { active: true })
                restored++
              }
            } else if (!product) {
              const id = crypto.randomUUID()
              next = createCatalogProduct(next, entry.name, entry.unit, id, entry.category)
              next = { ...next, catalog: next.catalog.map(item => item.id === id ? { ...item, libraryId: entry.id } : item) }
              added++
            }
          }
          setState(next)
          return { kind: 'library', added, restored, skipped: command.products.length - added - restored }
        }
        case 'revert_purchase': setState(revertPurchase(state, command.purchaseId, new Date().toISOString())); break
        case 'catalog_save_photo': throw new Error('Las fotografías solo están disponibles en una familia conectada.')
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
