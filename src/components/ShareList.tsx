import { useState } from 'react'
import type { ShoppingState } from '../types.ts'
import { listText } from '../lib/share-list.ts'

export function ShareList({ state }: { state: ShoppingState }) {
  const [message, setMessage] = useState('')
  const [fallback, setFallback] = useState(false)
  const text = listText(state)
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage('Lista copiada.'); setFallback(false) }
    catch { setFallback(true); setMessage('Seleccioná el texto para copiarlo manualmente.') }
  }
  async function share() {
    if (!navigator.share) { await copy(); return }
    try { await navigator.share({ title: 'Lista de compras', text }); setMessage('Lista compartida.') }
    catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) await copy() }
  }
  return <details className="mb-4 text-sm"><summary className="min-h-11 cursor-pointer py-3 text-forest">Compartir lista</summary>
    <div className="flex flex-wrap gap-2"><button className="button-secondary" type="button" onClick={share}>Compartir</button><button className="button-secondary" type="button" onClick={copy}>Copiar texto</button></div>
    <p role="status" className="mt-2 text-muted">{message}</p>{fallback && <textarea className="field mt-2 min-h-40" readOnly aria-label="Texto para compartir" value={text} onFocus={event => event.target.select()} />}
  </details>
}
