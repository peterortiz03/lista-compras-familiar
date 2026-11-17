import type { Category } from '../lib/categories.ts'

// Íconos vectoriales pequeños; no se descargan fotografías predeterminadas.
const paths: Record<Category, string> = {
  'Lácteos y huevos': 'M7 3h7l3 5v13H5V8l2-5Zm0 0v5h10M5 8h12M9 12h4v5H9z',
  'Carnes y pescados': 'M4 12c4-7 10-7 15 0-5 7-11 7-15 0Zm15 0 3-4v8l-3-4M13 10h.1',
  'Frutas y verduras': 'M12 7C4 3 2 12 7 20c3 2 4-1 5-1s3 3 5 1c5-8 3-17-5-13Zm0 0c0-4 2-5 5-5-1 4-3 5-5 5Z',
  'Panadería': 'M5 20C-1 10 7 2 17 4c10 7 2 17-7 16H5Zm2-12 4 4m1-6 4 4',
  'Almacén': 'M6 4h12v17H6V4Zm0 4h12M9 12h6m-6 4h6',
  'Bebidas': 'M9 2h6v5l3 4v10H6V11l3-4V2Zm-3 11h12M9 5h6',
  'Congelados': 'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3',
  'Snacks y golosinas': 'M8 6h8v12H8V6Zm0 0L3 3v6l5-3Zm8 0 5-3v6l-5-3M8 18l-5-3v6l5-3Zm8 0 5-3v6l-5-3',
  'Limpieza': 'M9 3h8v3h-8V3Zm3 3v3l5 4v8H7v-8l5-4M7 15h10M17 4h4v4',
  'Higiene personal': 'M8 8h8v13H8V8Zm4 0V4H8m4 0h6v3M8 14h8',
  'Hogar y descartables': 'M3 11 12 3l9 8M5 9v12h14V9M9 21v-7h6v7',
  'Mascotas': 'M7 18c0-6 10-6 10 0 0 5-3 2-5 2s-5 3-5-2ZM4 8c-3 0-2 5 0 5s3-5 0-5Zm5-5c-3 0-2 6 0 6s3-6 0-6Zm6 0c-3 0-2 6 0 6s3-6 0-6Zm5 5c-3 0-2 5 0 5s3-5 0-5Z',
  'Farmacia y cuidado': 'M4 4h16v16H4V4Zm6 3h4v3h3v4h-3v3h-4v-3H7v-4h3V7Z',
  'Otros': 'M4 7h16l-2 14H6L4 7Zm3 0 5-5 5 5M9 11v6m6-6v6',
}
export function CategoryIcon({ category = 'Otros' }: { category?: Category }) {
  return <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[category]} /></svg>
}
