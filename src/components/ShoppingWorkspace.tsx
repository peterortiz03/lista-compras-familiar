import { useState } from 'react'
import type { FamilyContext, Product, ProductDraft, Purchase } from '../types.ts'
import type { ShoppingCommand } from '../lib/shared-shopping.ts'
import { useShoppingData } from '../hooks/useShoppingData.ts'
import { loadState } from '../lib/storage.ts'
import { importProducts } from '../lib/shared-shopping.ts'
import { ProductForm } from './ProductForm.tsx'
import { ShoppingList } from './ShoppingList.tsx'
import { PurchaseDialog } from './PurchaseDialog.tsx'
import { PurchaseHistory } from './PurchaseHistory.tsx'
import { Icon } from './Icon.tsx'
import { ShareList } from './ShareList.tsx'
import { CatalogPanel } from './CatalogPanel.tsx'

interface Selection { product: Product; quantity: number; version?: string; note?: string; urgent?: boolean }

export function ShoppingWorkspace({ family }: { family: FamilyContext | null }) {
  const { state, error, ready, busy, lastSync, refresh, mutate } = useShoppingData(family)
  const [editing, setEditing] = useState<Selection | null>(null)
  const [buying, setBuying] = useState<Selection | null>(null)
  const [notice, setNotice] = useState('')
  const [operationError, setOperationError] = useState('')
  const [view, setView] = useState<'list' | 'catalog' | 'history'>('list')

  function select(product: Product): Selection | null {
    const item = state.pending.find(entry => entry.productId === product.id)
    return item ? { product, quantity: item.quantity, version: item.version, note: item.note, urgent: item.urgent } : null
  }
  function handleEdit(product: Product) {
    setEditing(select(product))
    document.getElementById('agregar-producto')?.scrollIntoView({ block: 'start' })
  }
  async function handleAdd(draft: ProductDraft): Promise<Product | null> {
    const result = await mutate({ type: 'add', ...draft })
    if (result.kind === 'duplicate') return result.product
    setNotice(`${draft.name} se agregó a la lista.`); setOperationError('')
    return null
  }
  async function handleSave(productId: string, quantity: number, note: string, urgent: boolean) {
    await mutate({ type: 'update', productId, quantity, note, urgent, version: editing?.version })
    setEditing(null); setNotice('Cantidad actualizada.'); setOperationError('')
  }
  async function handleRemove(product: Product) {
    const item = select(product)
    if (!item) return
    try {
      await mutate({ type: 'remove', productId: product.id, version: item.version })
      if (editing?.product.id === product.id) setEditing(null)
      setNotice(`${product.name} se eliminó de pendientes.`); setOperationError('')
    } catch (failure) { setOperationError(failure instanceof Error ? failure.message : 'No se pudo eliminar.') }
  }
  async function handlePurchase(quantity: number) {
    if (!buying) return
    await mutate({ type: 'buy', productId: buying.product.id, quantity, version: buying.version })
    if (editing?.product.id === buying.product.id) setEditing(null)
    setBuying(null); setNotice('Compra registrada. El historial y los pendientes se actualizaron.'); setOperationError('')
  }
  async function handleRevert(purchase: Purchase) {
    if (!window.confirm(`¿Revertir la compra de ${purchase.name}? Se devolverán ${purchase.quantity.toLocaleString('es-AR')} ${purchase.unit} a pendientes y saldrá del historial habitual.`)) return
    try {
      await mutate({ type: 'revert_purchase', purchaseId: purchase.id })
      setNotice('Compra revertida. La cantidad volvió a pendientes.'); setOperationError('')
    } catch (failure) { setOperationError(failure instanceof Error ? failure.message : 'No se pudo revertir la compra.') }
  }
  async function catalogAction(command: ShoppingCommand) { await mutate(command) }
  async function handleImport() {
    const local = loadState(() => window.localStorage)
    if (!local.canSave) { setOperationError('No se pudo leer la lista local. La copia original se conserva.'); return }
    if (!window.confirm('¿Copiar el catálogo y los pendientes locales a esta familia? Solo se permite si está vacía. El historial local no se importa y la copia original se conserva.')) return
    try {
      await mutate({ type: 'import', products: importProducts(local.state) })
      setNotice('Catálogo y pendientes importados. La copia local y su historial permanecen en este navegador.'); setOperationError('')
    } catch (failure) { setOperationError(failure instanceof Error ? failure.message : 'No se pudo importar.') }
  }

  const disabled = busy || !ready || (!!family && !!error)
  return <section aria-label={family ? `Lista familiar de ${family.name}` : 'Lista local'}>
    <aside className="mb-5 rounded-2xl border border-line bg-sage p-4 text-sm leading-relaxed text-forest">
      <strong>{family ? `Lista compartida · ${family.name}` : 'Lista local de este navegador'}</strong>
      <p className="mt-1">{family ? 'Los integrantes ven los mismos productos. Se actualiza cada 3 segundos mientras esta pestaña está visible y al volver a ella. Las operaciones requieren conexión.' : 'Se guarda en este navegador. Ingresá y creá o elegí tu familia para usar la lista compartida. Esta copia no se sube automáticamente.'}</p>
      {family && <div className="mt-3 flex flex-wrap items-center gap-3"><button className="button-secondary" disabled={busy} onClick={() => void refresh(true)}>Actualizar lista</button><span className="text-xs">{busy ? 'Guardando…' : lastSync ? `Última actualización: ${lastSync.toLocaleTimeString('es-AR')}` : 'Cargando lista familiar…'}</span></div>}
    </aside>
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}{family && ' Se mantienen los últimos datos confirmados; las operaciones quedan deshabilitadas hasta recuperar la conexión.'}</p>}
    {operationError && <p role="alert" className="mb-4 text-sm text-red-800">{operationError}</p>}
    <p role="status" aria-live="polite" className={notice ? 'mb-4 rounded-xl bg-sage p-3 text-sm text-forest' : 'sr-only'}>{notice}</p>
    <nav aria-label="Secciones de compras" className="mb-5 flex flex-wrap gap-3">{([{ id: 'list', label: 'Lista' }, { id: 'catalog', label: 'Catálogo' }, { id: 'history', label: 'Historial' }] as const).map(entry => <button key={entry.id} className={view === entry.id ? 'button-primary' : 'button-secondary'} type="button" aria-pressed={view === entry.id} onClick={() => { setView(entry.id); setEditing(null); setOperationError('') }}>{entry.label}</button>)}</nav>
    {view === 'list' && <ShareList state={state} />}
    {view === 'list' && <a href="#agregar-producto" className="button-primary mb-5" onClick={event => { if (disabled) event.preventDefault(); else setEditing(null) }} aria-disabled={disabled}><Icon name="plus" size={18} />Agregar faltante</a>}
    {family && ready && state.catalog.length === 0 && <div className="surface mb-5 p-4"><p className="text-sm text-muted">La familia empieza vacía. Podés agregar productos o copiar el catálogo y los pendientes locales. El historial anterior queda en este navegador.</p><button className="button-secondary mt-3" disabled={disabled} onClick={handleImport}>Importar catálogo y pendientes locales</button></div>}
    <div className="mb-6 grid grid-cols-2 gap-3">
      <div className="stat-card"><div><p className="text-xs text-muted">Productos pendientes</p><p className="mt-1 text-3xl font-bold">{state.pending.length}</p></div><Icon name="basket" /></div>
      <div className="stat-card"><div><p className="text-xs text-muted">En tu catálogo</p><p className="mt-1 text-3xl font-bold">{state.catalog.filter(product => product.active !== false).length}</p></div><Icon name="leaf" /></div>
    </div>
    <fieldset disabled={disabled} className="min-w-0">
      {view === 'catalog' ? <CatalogPanel products={state.catalog} onAction={catalogAction} /> : view === 'history' ? <PurchaseHistory history={state.history} family={family} onRevert={handleRevert} /> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0"><ShoppingList state={state} onEdit={handleEdit} onRemove={handleRemove} onBuy={product => setBuying(select(product))} /></div>
        <div className="min-w-0 lg:sticky lg:top-6"><ProductForm key={editing?.product.id ?? 'new'} catalog={state.catalog} history={state.history} pending={state.pending} pendingIds={state.pending.map(item => item.productId)} editing={editing} onAdd={handleAdd} onSave={handleSave} onEdit={handleEdit} onCancel={() => setEditing(null)} /></div>
      </div>}
    </fieldset>
    {buying && <PurchaseDialog product={buying.product} pending={buying.quantity} onSave={handlePurchase} onCancel={() => setBuying(null)} />}
  </section>
}
