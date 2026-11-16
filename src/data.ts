import type { ShoppingState } from './types.ts'

export function createInitialState(): ShoppingState {
  return {
    history: [],
    catalog: [
      { id: 'leche', name: 'Leche', unit: 'litro' },
      { id: 'huevos', name: 'Huevos', unit: 'unidad' },
      { id: 'tomates', name: 'Tomates', unit: 'kg' },
      { id: 'arroz', name: 'Arroz', unit: 'paquete' },
      { id: 'pan', name: 'Pan integral', unit: 'unidad' },
      { id: 'manzanas', name: 'Manzanas', unit: 'kg' },
      { id: 'aceite', name: 'Aceite de oliva', unit: 'litro' },
      { id: 'cafe', name: 'Café', unit: 'paquete' },
    ],
    pending: [
      { productId: 'leche', quantity: 2 },
      { productId: 'huevos', quantity: 12 },
      { productId: 'tomates', quantity: 1.5 },
      { productId: 'arroz', quantity: 1 },
      { productId: 'pan', quantity: 1 },
    ],
  }
}
