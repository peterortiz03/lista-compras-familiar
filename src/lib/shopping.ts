import type { ProductDraft, ShoppingState, Unit } from '../types.ts'

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

// La misma comparación se usa al sugerir productos y al evitar duplicados.
export function normalizeName(name: string): string {
  return cleanName(name).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es')
}

export function quantityError(quantity: number, unit: Unit): string | null {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999) {
    return 'Ingresá una cantidad mayor que 0 y menor o igual a 9999.'
  }
  if ((unit === 'unidad' || unit === 'paquete') && !Number.isInteger(quantity)) {
    return 'Las unidades y los paquetes se cuentan con números enteros.'
  }
  if (Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001) {
    return 'Usá hasta tres decimales para kilogramos o litros.'
  }
  return null
}

export function addProduct(state: ShoppingState, draft: ProductDraft, newId: string) {
  const name = cleanName(draft.name)
  if (!name || name.length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.')

  const existing = state.catalog.find((product) => normalizeName(product.name) === normalizeName(name))
  const product = existing?.active === false ? { ...existing, active: true } : existing ?? { id: newId, name, unit: draft.unit }
  const error = quantityError(draft.quantity, product.unit)
  if (error) throw new Error(error)

  const catalog = existing?.active === false ? state.catalog.map(entry => entry.id === product.id ? product : entry) : state.catalog

  if (state.pending.some((item) => item.productId === product.id)) {
    return { kind: 'duplicate' as const, state: catalog === state.catalog ? state : { ...state, catalog }, product }
  }

  return {
    kind: 'added' as const,
    product,
    state: {
      ...state,
      catalog: existing ? catalog : [...catalog, product],
      pending: [...state.pending, { productId: product.id, quantity: draft.quantity }],
    },
  }
}

export function createCatalogProduct(state: ShoppingState, name: string, unit: Unit, id: string): ShoppingState {
  const clean = cleanName(name)
  if (!clean || clean.length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.')
  if (state.catalog.some(product => normalizeName(product.name) === normalizeName(clean))) throw new Error('Ya existe ese nombre. Revisá los productos quitados y recuperalo si corresponde.')
  return { ...state, catalog: [...state.catalog, { id, name: clean, unit, active: true }] }
}

export function changeCatalogProduct(state: ShoppingState, productId: string, change: { name: string } | { active: boolean }): ShoppingState {
  if (!state.catalog.some(product => product.id === productId)) throw new Error('Producto inexistente.')
  if ('name' in change) {
    const name = cleanName(change.name)
    if (!name || name.length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.')
    if (state.catalog.some(product => product.id !== productId && normalizeName(product.name) === normalizeName(name))) throw new Error('Ya existe ese nombre en el catálogo.')
    change = { name }
  }
  return { ...state, catalog: state.catalog.map(product => product.id === productId ? { ...product, ...change } : product) }
}

export function revertPurchase(state: ShoppingState, purchaseId: string, date: string): ShoppingState {
  const purchase = state.history.find(entry => entry.id === purchaseId)
  if (!purchase) throw new Error('Compra inexistente.')
  if (purchase.revertedAt) return state
  const product = state.catalog.find(entry => entry.id === purchase.productId)
  if (!product || product.unit !== purchase.unit) throw new Error('El producto o su unidad original no está disponible.')
  const pending = state.pending.find(entry => entry.productId === purchase.productId)
  const quantity = Math.round(((pending?.quantity ?? 0) + purchase.quantity) * 1000) / 1000
  const error = quantityError(quantity, purchase.unit)
  if (error) throw new Error(error)
  return {
    ...state,
    pending: pending ? state.pending.map(entry => entry.productId === purchase.productId ? { ...entry, quantity } : entry)
      : [...state.pending, { productId: purchase.productId, quantity }],
    history: state.history.map(entry => entry.id === purchaseId ? { ...entry, revertedAt: date } : entry),
  }
}

export function updateQuantity(state: ShoppingState, productId: string, quantity: number): ShoppingState {
  const product = state.catalog.find((entry) => entry.id === productId)
  if (!product || !state.pending.some((item) => item.productId === productId)) {
    throw new Error('Este producto ya no está pendiente.')
  }
  const error = quantityError(quantity, product.unit)
  if (error) throw new Error(error)
  return {
    ...state,
    pending: state.pending.map((item) => item.productId === productId ? { ...item, quantity } : item),
  }
}

// Eliminar un pendiente no es una compra y no genera historial.
export function removePending(state: ShoppingState, productId: string): ShoppingState {
  return { ...state, pending: state.pending.filter((item) => item.productId !== productId) }
}

export function recordPurchase(state: ShoppingState, productId: string, quantity: number, id: string, purchasedAt: string): ShoppingState {
  const product = state.catalog.find((entry) => entry.id === productId)
  const pending = state.pending.find((entry) => entry.productId === productId)
  if (!product || !pending) throw new Error('Este producto ya no está pendiente.')
  const error = quantityError(quantity, product.unit)
  if (error) throw new Error(error)
  // Trabajamos en milésimas para evitar restos como 0.19999999999999998.
  const remaining = Math.round(pending.quantity * 1000) - Math.round(quantity * 1000)
  if (remaining < 0) throw new Error('La compra no puede superar la cantidad pendiente.')
  return {
    ...state,
    pending: remaining === 0
      ? state.pending.filter((entry) => entry.productId !== productId)
      : state.pending.map((entry) => entry.productId === productId ? { ...entry, quantity: remaining / 1000 } : entry),
    history: [{ id, productId, name: product.name, unit: product.unit, quantity, purchasedAt }, ...state.history],
  }
}
