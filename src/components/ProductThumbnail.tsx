import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { FamilyContext, Product } from '../types.ts'
import { supabase } from '../lib/supabase.ts'
import { belongsToFamily, PHOTO_BUCKET } from '../lib/product-photos.ts'
import { CategoryIcon } from './CategoryIcon.tsx'

type Entry = { url: string; expires: number }
type PhotoContext = { familyId: string; get: (path: string) => Promise<string> } | null
const Photos = createContext<PhotoContext>(null)

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
  const [url, setUrl] = useState('')
  const [visible, setVisible] = useState(false)
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
  if (!photos) return null // El modo local conserva su presentación y no consulta Storage.
  return <span ref={frame} className="product-thumbnail flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage text-forest" aria-hidden="true">
    {path && url ? <img key={url} src={url} alt="" width={48} height={48} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="size-full object-cover" onError={() => setUrl('')} /> : <CategoryIcon category={product.category} />}
  </span>
}
