import { useState } from 'react'
import { ProductForm } from './components/ProductForm.tsx'
import { ShoppingList } from './components/ShoppingList.tsx'
import { Icon } from './components/Icon.tsx'
import { createInitialState } from './data.ts'
import { addProduct, removePending, updateQuantity } from './lib/shopping.ts'
import type { Product, ProductDraft } from './types.ts'

export default function App() {
  const [state, setState] = useState(createInitialState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const editingProduct = state.catalog.find((product) => product.id === editingId)
  const editingItem = state.pending.find((item) => item.productId === editingId)
  const editing = editingProduct && editingItem ? { product: editingProduct, quantity: editingItem.quantity } : null

  function handleAdd(draft: ProductDraft): Product | null {
    const result = addProduct(state, draft, crypto.randomUUID())
    if (result.kind === 'duplicate') return result.product
    setState(result.state)
    setNotice(`${result.product.name} se agregó a la lista.`)
    return null
  }

  function handleEdit(product: Product) {
    setEditingId(product.id)
    document.getElementById('agregar-producto')?.scrollIntoView({ block: 'start' })
  }

  function handleSave(productId: string, quantity: number) {
    setState((current) => updateQuantity(current, productId, quantity))
    setEditingId(null)
    setNotice('Cantidad actualizada. Ya está lista para la próxima compra.')
  }

  function handleRemove(product: Product, bought: boolean) {
    setState((current) => removePending(current, product.id))
    if (editingId === product.id) setEditingId(null)
    setNotice(bought ? `${product.name} se marcó como comprado y salió de pendientes.` : `${product.name} se eliminó de pendientes.`)
  }

  return (
    <div className="min-h-screen">
      <a href="#contenido" className="skip-link">Ir a la lista</a>
      <header className="border-b border-line bg-white/80">
        <div className="mx-auto flex min-h-24 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
          <a href="#" className="flex items-center gap-3 text-ink no-underline" aria-label="En casa, inicio">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-forest text-white"><Icon name="basket" size={25} /></span>
            <span><span className="block text-xl font-extrabold tracking-tight">en casa<span className="text-forest">.</span></span><span className="mt-0.5 block text-[11px] font-medium tracking-wide text-muted">LISTA DE COMPRAS FAMILIAR</span></span>
          </a>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-muted"><span className="size-1.5 rounded-full bg-amber-500" />Modo local</span>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-6xl px-5 pt-8 pb-10 sm:px-8 sm:pt-12">
        <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:mb-9 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-[11px] font-bold tracking-[0.16em] text-forest uppercase">Un poco de orden, todos los días</p>
            <h1 className="text-[clamp(2rem,5vw,3rem)] leading-[1.12] font-extrabold tracking-[-0.045em]">Lo que falta en casa.</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">Anotá lo que hace falta. Llevá la lista. Volvé con todo.</p>
          </div>
          <a className="button-primary shrink-0" href="#agregar-producto" onClick={() => setEditingId(null)}><Icon name="plus" size={18} />Agregar producto</a>
        </div>

        <aside className="mb-7 flex items-start gap-3 rounded-2xl border border-[#e4dcc2] bg-[#f7f2e5] px-4 py-3.5 text-[#655733] sm:px-5" aria-label="Aviso sobre datos temporales">
          <Icon name="info" size={19} style={{ flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs leading-relaxed sm:text-sm"><strong>Esta es una versión de prueba local.</strong> Los datos viven en memoria y se pierden al recargar. Por ahora, la lista no se comparte entre dispositivos.</p>
        </aside>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="stat-card"><div><p className="text-xs font-medium text-muted sm:text-sm">Productos pendientes</p><p className="mt-1 text-3xl font-bold tracking-tight">{state.pending.length.toString().padStart(2, '0')}</p></div><span className="stat-icon bg-sage text-forest"><Icon name="basket" size={24} /></span></div>
          <div className="stat-card"><div><p className="text-xs font-medium text-muted sm:text-sm">En tu catálogo</p><p className="mt-1 text-3xl font-bold tracking-tight">{state.catalog.length.toString().padStart(2, '0')}</p></div><span className="stat-icon bg-[#f4eee4] text-[#997747]"><Icon name="leaf" size={24} /></span></div>
        </div>

        <div role="status" aria-live="polite" aria-atomic="true" className={notice ? 'mb-5 flex items-start gap-2 rounded-xl border border-[#caddcd] bg-sage px-4 py-3 text-sm text-forest' : 'sr-only'}>{notice && <Icon name="check" size={18} style={{ flexShrink: 0, marginTop: 1 }} />}{notice}</div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ShoppingList state={state} onEdit={handleEdit} onRemove={(product) => handleRemove(product, false)} onBuy={(product) => handleRemove(product, true)} />
          <div className="space-y-5 lg:sticky lg:top-6">
            <ProductForm key={editingId ?? 'new'} catalog={state.catalog} pendingIds={state.pending.map((item) => item.productId)} editing={editing} onAdd={handleAdd} onSave={handleSave} onEdit={handleEdit} onCancel={() => setEditingId(null)} />
            <div className="flex items-start gap-3 px-2 py-1"><Icon name="leaf" size={21} style={{ color: '#245c46', flexShrink: 0, marginTop: 2 }} /><div><h2 className="text-sm font-semibold">Una lista que va creciendo</h2><p className="mt-1 text-xs leading-relaxed text-muted">Tus productos quedan en el catálogo de esta sesión, incluso después de comprarlos.</p></div></div>
          </div>
        </div>
        <footer className="mt-10 flex flex-col justify-between gap-2 border-t border-line pt-5 text-xs text-muted sm:flex-row"><p>Hecha para la vida de todos los días.</p><p>Primera entrega · Datos temporales</p></footer>
      </main>
    </div>
  )
}
