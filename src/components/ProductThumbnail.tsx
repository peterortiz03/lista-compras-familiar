import { createContext, lazy, Suspense, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { FamilyContext, Product } from '../types.ts'
import { supabase } from '../lib/supabase.ts'
import { belongsToFamily, PHOTO_BUCKET } from '../lib/product-photos.ts'
import { CategoryIcon } from './CategoryIcon.tsx'
import { libraryPhoto } from '../lib/library-photos.ts'

type Entry = { url: string; expires: number }
type PhotoContext = { familyId: string; get: (path: string) => Promise<string> } | null
const Photos = createContext<PhotoContext>(null)
const PhotoCredit = lazy(() => import('./PhotoCredit.tsx').then(module => ({ default: module.PhotoCredit })))

export function ProductPhotoProvider({ family, children }: { family: FamilyContext | null; children: ReactNode }) {
  // Solo memoria; el Workspace y este proveedor se desmontan al cambiar cuenta o familia.
  const [cache] = useState(() => new Map<string, Entry>())
  const [requests] = useState(() => new Map<string, Promise<string>>())
  const value: PhotoContext = family && supabase ? { familyId: family.id, get(path) {
    if (!belongsToFamily(path, family.id)) return Promise.reject(new Error('Foto ajena'))
    const cached = cache.get(path)
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.url)
    const request = requests.get(path)
    if (request) return request
    const next = supabase!.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60).then(({ data, error }) => {
      if (error || !data) throw new Error('Foto no disponible')
      cache.set(path, { url: data.signedUrl, expires: Date.now() + 40000 })
      return data.signedUrl
    }).finally(() => requests.delete(path))
    requests.set(path, next)
    return next
  } } : null
  return <Photos.Provider value={value}>{children}</Photos.Provider>
}

// Se conserva el espacio y el estilo de los controles; una foto rota nunca oculta el nombre.
export function ProductThumbnail({ product }: { product: Product }) {
  const photos = useContext(Photos)
  const frame = useRef<HTMLSpanElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [loadedUrl, setLoadedUrl] = useState('')
  const [visible, setVisible] = useState(false)
  const [brokenDefault, setBrokenDefault] = useState<string>()
  const [previewError, setPreviewError] = useState(false)
  const defaultPhoto = libraryPhoto(product)
  const path = product.photoPath
  const familyId = photos?.familyId
  const get = photos?.get
  const getRef = useRef(get)
  useEffect(() => { getRef.current = get }, [get])
  useEffect(() => {
    if (!familyId || !frame.current) return
    const observer = new IntersectionObserver(entries => setVisible(!!entries[0]?.isIntersecting))
    observer.observe(frame.current)
    return () => observer.disconnect()
  }, [familyId])
  useEffect(() => {
    if (!path || !visible) return
    let active = true
    async function load() {
      if (document.hidden || !getRef.current) return
      try { const next = await getRef.current(path!); if (active) setUrl(next) }
      catch { if (active) setUrl('') }
    }
    void load()
    const timer = window.setInterval(() => void load(), 45000)
    window.addEventListener('focus', load)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load) }
  }, [path, visible])
  const privatePhoto = photos && path ? url : ''
  const source = privatePhoto || (brokenDefault !== defaultPhoto ? defaultPhoto : undefined)
  const loaded = !!source && loadedUrl === source

  function openPhoto() {
    flushSync(() => { setPreviewError(false); setExpanded(true) })
    dialog.current?.showModal()
  }

  return <>
    <span ref={frame} className="product-thumbnail relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage text-forest">
      <CategoryIcon category={product.category} />
      {source && <img key={source} src={source} alt="" width={48} height={48} loading="lazy" decoding="async"
        referrerPolicy="no-referrer" className={`absolute inset-0 size-full bg-sage object-contain ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoadedUrl(source)} onError={() => {
          setLoadedUrl('')
          if (privatePhoto) setUrl('')
          else setBrokenDefault(source)
        }} />}
      {loaded && <button type="button" className="absolute inset-0 rounded-xl focus-visible:outline-offset-[-4px]"
        aria-label={`Ampliar foto de ${product.name}`} onClick={openPhoto} />}
    </span>
    {expanded && <dialog ref={dialog} aria-label={`Foto de ${product.name}`}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-white p-4 text-ink backdrop:bg-black/55"
      onClose={() => setExpanded(false)} onClick={event => {
        if (event.target === event.currentTarget) dialog.current?.close()
      }}>
      <div onClick={event => event.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="min-w-0 break-words font-semibold">{product.name}</h3>
          <button type="button" className="button-secondary" autoFocus onClick={() => dialog.current?.close()}>Cerrar</button>
        </div>
        {source && !previewError ? <img src={source} alt={product.name} referrerPolicy="no-referrer"
          className="max-h-[65dvh] w-full rounded-lg bg-sage object-contain" onError={() => setPreviewError(true)} />
          : <p role="status" className="p-4 text-sm text-muted">La foto no está disponible en este momento.</p>}
        {source?.startsWith('/library/') && <Suspense fallback={null}><PhotoCredit source={source} /></Suspense>}
      </div>
    </dialog>}
  </>
}
