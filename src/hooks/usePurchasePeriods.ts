import { useEffect, useMemo, useState } from 'react'
import type { Purchase } from '../types.ts'
import { purchaseDay, shiftDay } from '../lib/history.ts'
import { supabase } from '../lib/supabase.ts'

interface Query {
  start: string
  end: string
  before?: Purchase
}
interface Page {
  purchases: Purchase[]
  next: Query | null
}
const pageSize = 100

function pageFromRows(query: Query, rows: Purchase[], olderDay: string | null): Page {
  const purchases = rows.slice(0, pageSize)
  const next = rows.length > pageSize ? { ...query, before: purchases[purchases.length - 1] }
    : olderDay ? { start: shiftDay(olderDay, -6), end: shiftDay(olderDay, 1) } : null
  return { purchases, next }
}

export function usePurchasePeriods(history: Purchase[], shared: boolean, revision: string | undefined) {
  const [today, setToday] = useState(() => purchaseDay(new Date()))
  const [requested, setRequested] = useState(1)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; pages: Page[]; error: string } | null>(null)
  const key = `${today}:${revision}:${requested}:${retry}`
  const initial = useMemo(() => ({ start: shiftDay(today, -2), end: shiftDay(today, 1) }), [today])

  useEffect(() => {
    const update = () => setToday(purchaseDay(new Date()))
    const timer = window.setInterval(update, 15000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])

  useEffect(() => {
    if (!shared || !supabase || !revision) return
    const client = supabase
    const controller = new AbortController()
    async function load() {
      const pages = result?.key.startsWith(`${today}:${revision}:`) ? result.pages.slice() : []
      let query: Query | null = pages.length ? pages[pages.length - 1].next : initial
      try {
        while (query && pages.length < requested) {
          const { data, error } = await client.rpc('get_family_purchase_period', {
            p_start: query.start, p_end: query.end,
            p_before_at: query.before?.purchasedAt ?? null, p_before_id: query.before?.id ?? null,
          }).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]))
          if (error || !Array.isArray(data?.purchases)) throw new Error('No pudimos cargar este período.')
          const page: Page = pageFromRows(query, data.purchases, data.olderDay)
          pages.push(page)
          query = page.next
        }
        if (!controller.signal.aborted) setResult({ key, pages, error: '' })
      } catch {
        if (!controller.signal.aborted) setResult({ key, pages, error: 'No pudimos cargar el historial. Revisá la conexión e intentá de nuevo.' })
      }
    }
    void load()
    return () => controller.abort()
    // El resultado anterior se reutiliza solo al pedir otra página de la misma revisión.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, key, initial])

  const localPages = useMemo(() => {
    if (shared) return []
    const ordered = history.slice().sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt) || b.id.localeCompare(a.id))
    const dated = ordered.map(purchase => ({ purchase, day: purchaseDay(purchase.purchasedAt) }))
    const pages: Page[] = []
    let query: Query | null = initial
    while (query && pages.length < requested) {
      const range: Query = query
      const rows = dated.filter(({ day, purchase }) => day >= range.start && day < range.end
        && (!range.before || purchase.purchasedAt < range.before.purchasedAt
          || (purchase.purchasedAt === range.before.purchasedAt && purchase.id < range.before.id)))
      const page: Page = pageFromRows(range, rows.map(row => row.purchase), dated.find(row => row.day < range.start)?.day ?? null)
      pages.push(page)
      query = page.next
    }
    return pages
  }, [shared, history, initial, requested])

  const pages = shared ? result?.pages ?? [] : localPages
  const next = pages.at(-1)?.next
  return {
    today,
    purchases: pages.flatMap(page => page.purchases),
    loading: shared && result?.key !== key,
    error: result?.key === key ? result.error : '',
    more: !!next,
    moreInPeriod: !!next?.before,
    loadOlder: () => setRequested(count => count + 1),
    retry: () => setRetry(count => count + 1),
  }
}
