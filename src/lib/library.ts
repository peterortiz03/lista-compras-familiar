import type { Product, Unit } from '../types.ts'
import type { Category } from './categories.ts'
import { normalizeName } from './shopping.ts'

export interface LibraryProduct {
  id: string
  name: string
  key: string
  aliases: string[]
  category: Category
  unit: Unit
}

type Entry = [id: string, name: string, unit: Unit, aliases?: string[]]
const groups: [Category, Entry[]][] = [
  ['Almacén', [
    ['yerba-mate', 'Yerba mate', 'paquete', ['yerba']],
    ['arroz', 'Arroz', 'paquete'], ['fideos-secos', 'Fideos secos', 'paquete', ['pasta']],
    ['harina-000', 'Harina 000', 'paquete'], ['azucar', 'Azúcar', 'paquete'],
    ['sal-fina', 'Sal fina', 'paquete'], ['aceite-girasol', 'Aceite de girasol', 'litro'],
    ['aceite-oliva', 'Aceite de oliva', 'litro'], ['pure-tomate', 'Puré de tomate', 'paquete'],
    ['dulce-leche', 'Dulce de leche', 'unidad'], ['pan-rallado', 'Pan rallado', 'paquete'],
    ['tapas-empanadas', 'Tapas para empanadas', 'paquete'], ['cafe', 'Café', 'paquete'],
    ['te', 'Té', 'paquete'], ['mate-cocido', 'Mate cocido', 'paquete'],
    ['dulce-membrillo', 'Dulce de membrillo', 'unidad'],
  ]],
  ['Lácteos y huevos', [
    ['leche', 'Leche', 'litro'], ['huevos', 'Huevos', 'unidad'], ['yogur', 'Yogur', 'unidad', ['yogurt']],
    ['manteca', 'Manteca', 'unidad'], ['crema-leche', 'Crema de leche', 'unidad'],
    ['queso-cremoso', 'Queso cremoso', 'kg'], ['queso-rallado', 'Queso rallado', 'paquete'],
    ['queso-untable', 'Queso untable', 'unidad'], ['queso-fresco', 'Queso fresco', 'kg'],
  ]],
  ['Carnes y pescados', [
    ['jamon-cocido', 'Jamón cocido', 'kg'], ['carne-picada', 'Carne picada', 'kg'],
    ['bifes-vaca', 'Bifes de vaca', 'kg'], ['supremas-pollo', 'Supremas de pollo', 'kg', ['pollo supremas']],
    ['milanesas-pollo', 'Milanesas de pollo', 'kg'], ['pollo-entero', 'Pollo entero', 'unidad'],
  ]],
  ['Frutas y verduras', [
    ['tomates', 'Tomates', 'kg'], ['papas', 'Papas', 'kg'], ['cebollas', 'Cebollas', 'kg'],
    ['zanahorias', 'Zanahorias', 'kg'], ['manzanas', 'Manzanas', 'kg'], ['bananas', 'Bananas', 'kg'],
    ['naranjas', 'Naranjas', 'kg'], ['zapallo-cabutia', 'Zapallo cabutiá', 'unidad', ['kabutia']],
    ['lechuga', 'Lechuga', 'unidad'], ['frutillas', 'Frutillas', 'kg'],
  ]],
  ['Panadería', [['pan-frances', 'Pan francés', 'kg'], ['pan-integral', 'Pan integral', 'unidad']]],
  ['Congelados', [['papas-congeladas', 'Papas congeladas', 'paquete']]],
  ['Bebidas', [
    ['agua-mineral', 'Agua mineral', 'litro'], ['soda', 'Soda', 'litro'],
    ['cola-sin-azucar', 'Gaseosa cola sin azúcar', 'litro', ['Coca Zero']],
    ['amargo-serrano', 'Amargo serrano', 'litro', ['Terma']],
  ]],
  ['Snacks y golosinas', [['galletitas-agua', 'Galletitas de agua', 'paquete'], ['alfajores', 'Alfajores', 'unidad']]],
  ['Limpieza', [
    ['detergente', 'Detergente', 'unidad'], ['lavandina', 'Lavandina', 'litro'],
    ['jabon-ropa', 'Jabón para ropa', 'unidad'], ['suavizante', 'Suavizante', 'unidad'],
    ['esponja', 'Esponja', 'unidad'],
  ]],
  ['Hogar y descartables', [
    ['bolsas-residuos', 'Bolsas de residuos', 'paquete'], ['rollo-cocina', 'Rollo de cocina', 'paquete'],
  ]],
  ['Higiene personal', [
    ['papel-higienico', 'Papel higiénico', 'paquete'], ['jabon-tocador', 'Jabón de tocador', 'unidad'],
    ['pasta-dental', 'Pasta dental', 'unidad', ['dentífrico']],
  ]],
]

export const LIBRARY: LibraryProduct[] = groups.flatMap(([category, entries]) =>
  entries.map(([id, name, unit, aliases = []]) => ({ id, name, key: normalizeName(name), unit, category, aliases })))

export interface LibrarySelection {
  id: string
  name: string
  unit: Unit
  category: Category
  restoreId?: string
  revision?: string
}

export function libraryMatch(product: LibraryProduct, catalog: Product[]) {
  return catalog.find(entry => entry.libraryId === product.id)
    ?? catalog.find(entry => normalizeName(entry.name) === product.key)
}
