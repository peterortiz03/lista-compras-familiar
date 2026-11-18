import type { Purchase } from '../types.ts'

export const HISTORY_ZONE = 'America/Argentina/Buenos_Aires'
const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: HISTORY_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
})
const dayLabel = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })

export function purchaseDay(date: string | Date): string {
  const values = Object.fromEntries(parts.formatToParts(new Date(date)).map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function shiftDay(day: string, by: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + by)
  return date.toISOString().slice(0, 10)
}

export function historyLabel(day: string, today: string): string {
  const relative = ['Hoy', 'Ayer', 'Anteayer'][[today, shiftDay(today, -1), shiftDay(today, -2)].indexOf(day)]
  const date = dayLabel.format(new Date(`${day}T00:00:00Z`))
  return relative ? `${relative} · ${date.replace(/ de \d{4}$/, '')}` : date
}

export function groupPurchases(history: Purchase[]) {
  const groups = new Map<string, Purchase[]>()
  for (const purchase of history) {
    const day = purchaseDay(purchase.purchasedAt)
    const group = groups.get(day)
    if (group) group.push(purchase)
    else groups.set(day, [purchase])
  }
  return groups
}
