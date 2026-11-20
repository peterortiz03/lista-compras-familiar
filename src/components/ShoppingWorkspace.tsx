import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import type { FamilyContext, Product, ProductDraft, Purchase } from '../types.ts'
import type { ShoppingCommand } from '../lib/shared-shopping.ts'
import { useShoppingData } from '../hooks/useShoppingData.ts'
import { loadState } from '../lib/storage.ts'
import { importProducts } from '../lib/shared-shopping.ts'
import { ProductForm } from './ProductForm.tsx'
import { ShoppingList } from './ShoppingList.tsx'
import { PurchaseDialog } from './PurchaseDialog.tsx'
import { Icon } from './Icon.tsx'
import { ShareList } from './ShareList.tsx'
import { ProductPhotoProvider } from './ProductThumbnail.tsx'
import { getCatalogSetup, saveCatalogSetup } from '../lib/onboarding.ts'

const CatalogPanel = lazy(() => import('./CatalogPanel.tsx').then(module => ({ default: module.CatalogPanel })))
const CatalogSetup = lazy(() => import('./CatalogSetup.tsx').then(module => ({ default: module.CatalogSetup })))
const PurchaseHistory = lazy(() => import('./PurchaseHistory.tsx').then(module => ({ default: module.PurchaseHistory })))

function subscribeToConnection(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

interface Selection { product: Product; quantity: number; version?: string; note?: string; urgent?: boolean }

export function ShoppingWorkspace({ family, guideOpen }: { family: FamilyContext | null; guideOpen: boolean }) {
  const { state, error, ready, busy, lastSync, refresh, mutate } = useShoppingData(family)
  const [editing, setEditing] = useState<Selection | null>(null)
  const [buying, setBuying] = useState<Selection | null>(null)
  const [notice, setNotice] = useState('')
  const [operationError, setOperationError] = useState('')
  const [view, setView] = useState<'list' | 'catalog' | 'history'>('list')
  const [setup, setSetup] = useState(() => family ? getCatalogSetup(family.userId, family.id) : null)
  const [manualSetup, setManualSetup] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const online = useSyncExternalStore(subscribeToConnection, () => navigator.onLine)

  async function refreshManually() {
    setRefreshing(true)
    try { await refresh(true) }
    finally { setRefreshing(false) }
  }

  function openForm(item: Selection | null) {
    flushSync(() => { setEditing(item); setFormOpen(true) })
    document.getElementById(item ? 'product-quantity' : 'product-name')?.focus()
  }

  function closeForm() {
    setEditing(null); setFormOpen(false)
    requestAnimationFrame(() => document.getElementById('open-product-form')?.focus())
  }

  function select(product: Product): Selection | null {
    const item = state.pending.find(entry => entry.productId === product.id)
    return item ? { product, quantity: item.quantity, version: item.version, note: item.note, urgent: item.urgent } : null
  }
  function handleEdit(product: Product) {
    const item = select(product)
    if (item) openForm(item)
  }
  async function handleAdd(draft: ProductDraft): Promise<Product | null> {
    const result = await mutate({ type: 'add', ...draft })
    if (result.kind === 'duplicate') return result.product
    setNotice(`${draft.name} se agregó a la lista.`); setOperationError('')
    return null
  }
  async function handleSave(productId: string, quantity: number, note: string, urgent: boolean) {
    await mutate({ type: 'update', productId, quantity, note, urgent, version: editing?.version })
    closeForm(); setNotice('Cantidad actualizada.'); setOperationError('')
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
  async function managePurchase(purchase: Purchase, action: 'void_purchase' | 'delete_purchase') {
    const deleting = action === 'delete_purchase'
    const message = deleting
      ? `¿Eliminar para siempre la compra de ${purchase.name}? Se quitará del historial familiar y de las estadísticas. Esta acción no se puede deshacer. Los pendientes quedan igual.`
      : `¿Anular la compra de ${purchase.name}? Dejará de contar y quedará visible al mostrar compras corregidas. Los pendientes quedan igual.`
    if (!window.confirm(message)) return
    try {
      await mutate({ type: action, purchaseId: purchase.id, confirmed: true })
      setNotice(deleting ? 'Compra eliminada del historial.' : 'Compra anulada. Los pendientes quedan igual.')
      setOperationError('')
    } catch (failure) {
      setOperationError(failure instanceof Error ? failure.message : 'No se pudo corregir la compra.')
    }
  }
  async function catalogAction(command: ShoppingCommand) { return mutate(command) }
  async function handleImport() {
    const local = loadState(() => window.localStorage)
    if (!local.canSave) { setOperationError('No se pudo leer la lista local. La copia original se conserva.'); return }
    if (!window.confirm('¿Copiar el catálogo y los pendientes locales a esta familia? Solo se permite si está vacía. El historial local no se importa y la copia original se conserva.')) return
    try {
      await mutate({ type: 'import', products: importProducts(local.state) })
      setNotice('Catálogo y pendientes importados. La copia local y su historial permanecen en este navegador.'); setOperationError('')
    } catch (failure) { setOperationError(failure instanceof Error ? failure.message : 'No se pudo importar.') }
  }

  const disabled = busy || !ready || (!!family && (!online || !!error))
  if (family && (setup || manualSetup)) return <ProductPhotoProvider family={family}>
    <div hidden={guideOpen}>
      {error && <p role="alert" className="mb-3 text-sm text-red-800">{error}</p>}
      <Suspense fallback={<p role="status">Cargando configuración del catálogo…</p>}>
        <CatalogSetup kind={setup ?? 'manual'} products={state.catalog} photosEnabled={!!state.photoStorage}
          disabled={!ready || !online || !!error} visible={!guideOpen} onAction={catalogAction}
          onComplete={() => saveCatalogSetup(family.userId, family.id, 'completed')} onExit={(outcome, nextView) => {
            saveCatalogSetup(family.userId, family.id, outcome)
            setSetup(null)
            setManualSetup(false)
            setView(nextView)
            requestAnimationFrame(() => document.getElementById(`shopping-${nextView}`)?.focus())
          }} />
      </Suspense>
    </div>
  </ProductPhotoProvider>
  return <ProductPhotoProvider family={family}><section aria-label={family ? `Lista familiar de ${family.name}` : 'Lista local'}>
    {family ? <details className="mb-2 text-sm text-forest">
      <summary className="min-h-11 cursor-pointer py-3">
        Lista compartida · {busy ? 'Guardando…' : !online ? 'Sin conexión' : refreshing ? 'Actualizando…' : error ? 'Error de sincronización' : ready ? 'Al día' : 'Actualizando…'}
      </summary>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button className="button-secondary" type="button" disabled={busy || refreshing || !online} onClick={() => void refreshManually()}>Actualizar lista</button>
        <span className="text-xs">{family.name}{lastSync ? ` · Última actualización ${lastSync.toLocaleTimeString('es-AR')}` : ''}</span>
      </div>
    </details> : <p className="mb-3 text-sm text-muted">Lista local · Guardada en este dispositivo</p>}
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}{family && ' Se mantienen los últimos datos confirmados; las operaciones quedan deshabilitadas hasta recuperar la conexión.'}</p>}
    {operationError && <p role="alert" className="mb-4 text-sm text-red-800">{operationError}</p>}
    <p role="status" aria-live="polite" className={notice ? 'mb-4 rounded-xl bg-sage p-3 text-sm text-forest' : 'sr-only'}>{notice}</p>
    <nav aria-label="Secciones de compras" className="mb-5 flex flex-wrap gap-3">{([{ id: 'list', label: 'Lista' }, { id: 'catalog', label: 'Catálogo' }, { id: 'history', label: 'Historial' }] as const).map(entry => <button key={entry.id} id={`shopping-${entry.id}`} className={view === entry.id ? 'button-primary' : 'button-secondary'} type="button" aria-pressed={view === entry.id} onClick={() => { setView(entry.id); setEditing(null); setFormOpen(false); setOperationError('') }}>{entry.label}</button>)}</nav>
    {view === 'list' && <button id="open-product-form" type="button" className="button-primary mb-3" disabled={disabled} onClick={() => openForm(null)}><Icon name="plus" size={18} />Agregar faltante</button>}
    {view === 'catalog' && family && ready && state.catalog.length === 0 && <details className="mb-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 text-forest">Copiar datos de este dispositivo</summary>
      <button className="button-secondary" type="button" disabled={disabled} onClick={handleImport}>Importar catálogo y pendientes locales</button>
    </details>}
    <fieldset disabled={disabled} className="min-w-0">
      {view === 'catalog' ? <Suspense fallback={<p role="status">Cargando catálogo…</p>}><CatalogPanel products={state.catalog} photosEnabled={!!family && !!state.photoStorage} onAction={catalogAction}
        onSetup={family ? () => setManualSetup(true) : undefined} /></Suspense> : view === 'history' ? ready && <Suspense fallback={<p role="status">Cargando historial…</p>}>
        <PurchaseHistory history={state.history} family={family} revision={state.purchaseRevision} onRevert={handleRevert}
          onManage={(state.featuresVersion ?? 0) >= 9 && family?.ownerId === family?.userId && family ? managePurchase : undefined} />
      </Suspense> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-2 min-w-0 lg:order-1"><ShoppingList state={state} onEdit={handleEdit} onRemove={handleRemove} onBuy={product => setBuying(select(product))} /></div>
        <div className={`${formOpen ? "block" : "hidden"} order-1 min-w-0 lg:sticky lg:top-6 lg:order-2 lg:block`}><ProductForm key={editing?.product.id ?? 'new'} catalog={state.catalog} history={state.history} purchaseStats={state.purchaseStats} pending={state.pending} pendingIds={state.pending.map(item => item.productId)} editing={editing} onAdd={handleAdd} onSave={handleSave} onEdit={handleEdit} onCancel={closeForm} /></div>
      </div>}
    </fieldset>
    {view === 'list' && <div className="mt-3"><ShareList state={state} /></div>}
    {buying && <PurchaseDialog product={buying.product} pending={buying.quantity} onSave={handlePurchase} onCancel={() => setBuying(null)} />}
  </section></ProductPhotoProvider>
}
