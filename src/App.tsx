import { useCallback, useEffect, useRef, useState } from 'react'
import type { FamilyContext } from './types.ts'
import { AccountPanel } from './components/AccountPanel.tsx'
import { ShoppingWorkspace } from './components/ShoppingWorkspace.tsx'
import { supabase } from './lib/supabase.ts'
import { Icon } from './components/Icon.tsx'
import { InstallApp } from './components/InstallApp.tsx'
import { UsageGuide } from './components/UsageGuide.tsx'
import { finishGuide, getCatalogSetup, shouldShowGuide } from './lib/onboarding.ts'
import { shoppingNoticeFromUrl } from './lib/web-push.ts'

export default function App() {
  const [accountOpen, setAccountOpen] = useState(false)
  const [family, setFamily] = useState<FamilyContext | null>(null)
  const [resolving, setResolving] = useState(!!supabase)
  const [manualGuide, setManualGuide] = useState(false)
  const [lastGuideUser, setLastGuideUser] = useState<string | null>(null)
  const [notificationId] = useState(shoppingNoticeFromUrl)
  const shownCatalogSetup = useRef<string | null>(null)
  const handleFamily = useCallback((next: FamilyContext | null) => {
    setFamily(current => current?.id === next?.id && current?.userId === next?.userId && current?.name === next?.name && current?.ownerId === next?.ownerId ? current : next)
    if (next && getCatalogSetup(next.userId, next.id)) {
      const key = `${next.userId}:${next.id}`
      if (shownCatalogSetup.current !== key) {
        shownCatalogSetup.current = key
        setAccountOpen(false)
      }
    }
  }, [])
  const guideOpen = !resolving && (manualGuide || !!(family && lastGuideUser !== family.userId && shouldShowGuide(family.userId)))

  useEffect(() => {
    if (!notificationId) return
    const url = new URL(window.location.href)
    url.searchParams.delete('shopping')
    window.history.replaceState(window.history.state, '', url)
  }, [notificationId])

  function closeGuide(outcome: 'completed' | 'skipped') {
    if (family) {
      finishGuide(family.userId, outcome)
      setLastGuideUser(family.userId)
    }
    setManualGuide(false)
  }
  return <div className="min-h-screen">
    <a href="#contenido" className="skip-link">Ir a la lista</a>
    <header className="border-b border-line bg-white/80">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-8">
        <a href="#" className="flex items-center gap-3 text-ink no-underline" aria-label="En casa, inicio"><span className="flex size-11 items-center justify-center rounded-2xl bg-forest text-white"><Icon name="basket" size={25} /></span><span><span className="block text-xl font-extrabold tracking-tight">en casa.</span><span className="text-[11px] text-muted">LISTA DE COMPRAS FAMILIAR</span></span></a>
        <div className="flex flex-wrap gap-2"><InstallApp /><button type="button" className="button-secondary" disabled={resolving} onClick={() => setManualGuide(true)}><Icon name="help" size={17} />Ayuda</button><button type="button" className="button-secondary" aria-expanded={accountOpen} aria-controls="cuenta" onClick={() => setAccountOpen(open => !open)}>Cuenta y familia</button></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pt-3 pb-10 sm:px-8 sm:pt-5">
      <h1 className="sr-only">En casa · Lista de compras familiar</h1>
      <div id="cuenta" hidden={!accountOpen}>
        <AccountPanel onFamilyChange={handleFamily} onResolvingChange={setResolving} />
      </div>
      <div id="contenido">{resolving ? <p role="status" className="surface p-5">Recuperando tu sesión y familia…</p> : <ShoppingWorkspace key={family ? `${family.userId}:${family.id}` : 'local'} family={family} guideOpen={guideOpen} notificationId={notificationId} />}</div>
      <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">En casa · Lista familiar compartida</footer>
    </main>
    {guideOpen && <UsageGuide key={family?.userId ?? 'local'} onFinish={closeGuide} />}
  </div>
}
