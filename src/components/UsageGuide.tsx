import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from './Icon.tsx'

const steps = [
  { icon: 'basket', title: 'Bienvenido a En casa', text: 'En casa reúne los faltantes en una lista de compras compartida. Cada integrante puede agregar lo que necesita y ver qué queda por comprar.' },
  { icon: 'list', title: 'Lista de compras', text: 'Tocá «Agregar faltante» para sumar un producto. Podés ajustar la cantidad, anotar un detalle o marcarlo como urgente. Al comprar, registrá todo lo pendiente o solo una parte.' },
  { icon: 'catalog', title: 'Catálogo y biblioteca', text: 'El catálogo guarda los productos de tu familia y la biblioteca argentina te ofrece productos para incorporar. En la lista solo aparecen los faltantes que agregás. En el catálogo podés usar categorías, favoritos y fotos.' },
  { icon: 'history', title: 'Historial', text: 'Las compras registradas se agrupan por día. Podés consultar períodos anteriores y, si tenés permiso, revertir una compra para devolver la cantidad a pendientes.' },
  { icon: 'family', title: 'Familia y sincronización', text: 'Cada integrante entra con su cuenta y comparte la misma lista, que se actualiza al conectarse. Podés avisar cuando estés haciendo las compras y, si tu dispositivo es compatible, activar notificaciones opcionales.' },
] as const

export function UsageGuide({ onFinish }: { onFinish: (outcome: 'completed' | 'skipped') => void }) {
  const [index, setIndex] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const description = useId()
  const step = steps[index]
  const isLast = index === steps.length - 1

  useEffect(() => {
    const element = dialog.current!
    element.showModal()
    return () => element.close()
  }, [])

  return <dialog ref={dialog} aria-labelledby={title} aria-describedby={description}
    onCancel={event => { event.preventDefault(); onFinish('skipped') }}
    className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-auto rounded-2xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-black/40 sm:p-7">
    <div aria-live="polite" aria-atomic="true">
      <p className="mb-2 text-sm font-semibold text-forest">Paso {index + 1} de {steps.length}</p>
      <div className="mb-5 grid grid-cols-5 gap-1.5" aria-hidden="true">
        {steps.map((entry, position) => <span key={entry.icon} className={`h-1.5 rounded-full ${position <= index ? 'bg-forest' : 'bg-line'}`} />)}
      </div>
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-sage text-forest"><Icon name={step.icon} size={25} /></span>
      <h2 id={title} tabIndex={-1} autoFocus className="text-xl font-bold">{step.title}</h2>
      <p id={description} className="mt-2 text-base text-muted">{step.text}</p>
    </div>
    <div className="mt-6 grid grid-cols-2 gap-2">
      <button type="button" className="button-secondary disabled:opacity-50" disabled={index === 0} onClick={() => setIndex(index - 1)}>Anterior</button>
      <button type="button" className="button-primary" onClick={() => isLast ? onFinish('completed') : setIndex(index + 1)}>{isLast ? 'Empezar' : 'Siguiente'}</button>
    </div>
    <button type="button" className="mt-2 min-h-11 w-full text-sm font-semibold text-forest" onClick={() => onFinish('skipped')}>Omitir</button>
  </dialog>
}
