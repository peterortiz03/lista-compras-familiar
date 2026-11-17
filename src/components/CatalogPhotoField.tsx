import { useEffect, useRef, useState } from 'react'
import type { Product } from '../types.ts'
import { processPhoto } from '../lib/product-photos.ts'
import { ProductThumbnail } from './ProductThumbnail.tsx'

export function CatalogPhotoField({ product, blob, removed, onChange, onProcessing }: {
  product: Product | null; blob: Blob | null; removed: boolean
  onChange: (blob: Blob | null, removed: boolean) => void; onProcessing: (busy: boolean) => void
}) {
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const sequence = useRef(0)
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // Es un recurso del navegador, no una copia del estado del formulario.
    // oxlint-disable-next-line react/set-state-in-effect
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])
  useEffect(() => () => { ++sequence.current }, [])
  async function choose(file?: File) {
    if (!file) return
    const current = ++sequence.current
    setProcessing(true); onProcessing(true); setError('')
    try { const next = await processPhoto(file); if (current === sequence.current) onChange(next, false) }
    catch (failure) { if (current === sequence.current) setError(failure instanceof Error ? failure.message : 'No pudimos procesar la fotografía.') }
    finally { if (current === sequence.current) { setProcessing(false); onProcessing(false) } }
  }
  return <div className="mt-4 border-t border-line pt-4">
    <p className="field-label">Fotografía opcional</p>
    <div className="flex items-center gap-3">
      {blob && preview ? <img src={preview} alt="Vista previa de la foto seleccionada" width={56} height={56} className="size-14 shrink-0 rounded-xl object-cover" /> : product && !removed ? <ProductThumbnail key={product.photoPath} product={product} /> : null}
      <p className="text-xs text-muted">{removed ? 'Se quitará al guardar.' : blob ? 'Nueva fotografía lista para guardar.' : 'Compartida con tu familia. JPG, PNG o WebP; hasta 12 MB.'}</p>
    </div>
    <fieldset disabled={processing} className="mt-3 flex min-w-0 flex-wrap gap-2">
      <label className="button-secondary cursor-pointer focus-within:outline-2 focus-within:outline-forest">Elegir foto<input aria-label="Elegir fotografía" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} /></label>
      <label className="button-secondary cursor-pointer focus-within:outline-2 focus-within:outline-forest">Tomar foto<input aria-label="Tomar fotografía" className="sr-only" type="file" accept="image/*" capture="environment" onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} /></label>
      {(blob || (product?.photoPath && !removed)) && <button type="button" className="button-secondary" onClick={() => { onChange(null, !!product?.photoPath); setError('') }}>Quitar foto</button>}
      {removed && <button type="button" className="button-secondary" onClick={() => onChange(null, false)}>Conservar foto actual</button>}
    </fieldset>
    <p className="mt-2 text-xs text-muted">{processing ? 'Preparando fotografía…' : 'Si la cámara no se abre, usá Elegir foto. Se reduce antes de subir; no se envía el original.'}</p>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  </div>
}
