import { useEffect, useRef, useState } from 'react'
import type { Product } from '../types.ts'
import type { MutationResult, ShoppingCommand } from '../lib/shared-shopping.ts'
import { CatalogProductForm } from './CatalogProductForm.tsx'
import { Icon } from './Icon.tsx'
import { LibraryPanel } from './LibraryPanel.tsx'

export function CatalogSetup({ kind, products, photosEnabled, disabled, visible, onAction, onComplete, onExit }: {
  kind: 'create' | 'join' | 'manual'
  products: Product[]
  photosEnabled: boolean
  disabled: boolean
  visible: boolean
  onAction: (command: ShoppingCommand) => Promise<MutationResult>
  onComplete: () => void
  onExit: (outcome: 'completed' | 'skipped', view: 'list' | 'catalog') => void
}) {
  const [stage, setStage] = useState<'welcome' | 'library' | 'product' | 'done'>('welcome')
  const [count, setCount] = useState(0)
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const hasCatalog = products.some(product => product.active !== false)

  useEffect(() => { if (visible) heading.current?.focus() }, [stage, visible])

  function finish() {
    onComplete()
    setStage('done')
  }

  async function updateCatalog(command: ShoppingCommand) {
    setWorking(true)
    try { return await onAction(command) }
    finally { setWorking(false) }
  }

  if (stage === 'library') return <div className="mx-auto max-w-3xl">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 ref={heading} tabIndex={-1} className="font-semibold">Prepará tu catálogo</h2>
      <button type="button" className="button-secondary" disabled={working} onClick={finish}>Finalizar configuración</button>
    </div>
    <LibraryPanel catalog={products} onAction={updateCatalog} disabled={disabled} backLabel="Volver a la configuración"
      onClose={() => setStage('welcome')} onImport={added => setCount(value => value + added)} />
  </div>

  if (stage === 'product') return <section className="mx-auto max-w-xl" aria-labelledby="setup-product-title">
    <h2 id="setup-product-title" className="mb-3 font-semibold">Prepará tu catálogo</h2>
    <fieldset className="min-w-0" disabled={disabled}>
      <CatalogProductForm product={null} photosEnabled={photosEnabled} onAction={onAction}
        onCancel={() => setStage('welcome')} onSave={() => {
          setCount(value => value + 1)
          setNotice('Producto guardado en el catálogo.')
          setStage('welcome')
        }} />
    </fieldset>
    {disabled && <button type="button" className="button-secondary mt-3" onClick={() => setStage('welcome')}>Volver a la configuración</button>}
  </section>

  return <section className="surface mx-auto max-w-xl p-4 sm:p-6" aria-labelledby="setup-title">
    <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-sage text-forest"><Icon name={stage === 'done' ? 'check' : 'catalog'} size={25} /></span>
    {stage === 'done' ? <>
      <h2 id="setup-title" ref={heading} tabIndex={-1} className="text-xl font-bold">¡Tu catálogo está listo!</h2>
      <p className="mt-2 text-base text-muted">{count > 0 ? `${count === 1 ? 'Incorporaste 1 producto a tu catálogo.' : `Incorporaste ${count} productos a tu catálogo.`} Ya podés armar tu lista de compras.` : 'Podés armar tu lista de compras y sumar productos al catálogo cuando quieras.'}</p>
      <button type="button" className="button-primary mt-5 w-full sm:w-auto" onClick={() => onExit('completed', 'list')}>Ir a mi lista</button>
    </> : <>
      <h2 id="setup-title" ref={heading} tabIndex={-1} className="text-xl font-bold">{kind === 'join' ? '¡Ya estás en la familia!' : '¡Preparemos tu catálogo!'}</h2>
      <p className="mt-2 text-base text-muted">{kind === 'join' ? (hasCatalog ? 'Tu familia ya tiene un catálogo compartido. Podés explorarlo o sumar los productos que hagan falta.' : 'El catálogo es compartido. Podés explorarlo o ayudar a tu familia a completarlo con sus productos habituales.') : 'Elegí los productos que compran habitualmente. Después vas a poder agregarlos a la lista con unos pocos toques.'}</p>
      {notice && <p role="status" className="mt-3 text-sm text-forest">{notice}</p>}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button type="button" className="button-primary" onClick={() => { setNotice(''); setStage('library') }}><Icon name="search" size={18} />Explorar biblioteca</button>
        <button type="button" className="button-secondary" disabled={disabled} onClick={() => { setNotice(''); setStage('product') }}><Icon name="plus" size={18} />Crear un producto</button>
        {kind === 'join' && <button type="button" className="button-secondary sm:col-span-2" onClick={() => onExit(count > 0 ? 'completed' : 'skipped', 'catalog')}>Ver catálogo familiar</button>}
        {count === 0 && kind !== 'manual'
          ? <button type="button" className="button-secondary sm:col-span-2" onClick={() => onExit('skipped', 'list')}>Empezar sin cargar productos</button>
          : <button type="button" className="button-secondary sm:col-span-2" onClick={finish}>Finalizar configuración</button>}
      </div>
    </>}
  </section>
}
