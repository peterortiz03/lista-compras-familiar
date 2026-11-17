import { useEffect, useState } from 'react'
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  useEffect(() => {
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const installed = () => setPrompt(null)
    window.addEventListener('beforeinstallprompt', available)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('beforeinstallprompt', available); window.removeEventListener('appinstalled', installed) }
  }, [])
  if (!prompt || window.matchMedia('(display-mode: standalone)').matches) return null
  return <button className="button-secondary" type="button" onClick={async () => {
    try { await prompt.prompt(); await prompt.userChoice } catch { /* El menú del navegador sigue disponible. */ } finally { setPrompt(null) }
  }}>Instalar</button>
}
