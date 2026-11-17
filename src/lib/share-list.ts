import type { ShoppingState } from '../types.ts'
import { UNITS } from '../types.ts'
import { groupPending } from './categories.ts'

export function listText(state: ShoppingState): string {
  const groups = groupPending(state)
  return groups.length ? ['En casa · Lista de compras', ...groups.map(group => '\n' + group.category + '\n' + group.items.map(item =>
    `• ${item.urgent ? '[URGENTE] ' : ''}${item.product.name}: ${item.quantity.toLocaleString('es-AR')} ${UNITS.find(unit => unit.value === item.product.unit)?.short}${item.note ? '\n  ' + item.note : ''}`).join('\n'))].join('\n') : 'En casa · No hay productos pendientes.'
}
