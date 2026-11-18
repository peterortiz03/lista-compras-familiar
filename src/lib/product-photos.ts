import type { SupabaseClient } from '@supabase/supabase-js'

import { PHOTO_BUCKET, MAX_PHOTO_BYTES, photoDimensions, validatePhoto, photoMime, photoExtension } from './photo-rules.ts'
export { PHOTO_BUCKET, belongsToFamily } from './photo-rules.ts'

// La decodificación nativa aplica EXIF; se exportan píxeles sin los metadatos originales.
export async function processPhoto(file: File): Promise<Blob> {
  validatePhoto(file)
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error(/hei[cf]/i.test(file.type) ? 'Este navegador no puede leer HEIC/HEIF. Exportá o seleccioná una versión JPEG desde tu galería.' : 'No pudimos leer esta imagen. Elegí otro JPG, PNG o WebP.'))
      image.src = url
    })
    const dimensions = photoDimensions(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    let generated = false
    for (const scale of [1, 0.75, 0.5]) {
      canvas.width = Math.max(1, Math.round(dimensions.width * scale))
      canvas.height = Math.max(1, Math.round(dimensions.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No pudimos preparar la fotografía en este navegador.')
      for (const type of ['image/webp', 'image/jpeg'] as const) {
        context.clearRect(0, 0, canvas.width, canvas.height)
        // JPEG no tiene transparencia: fondo blanco en lugar de negro.
        if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height) }
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        for (const quality of [0.82, 0.65, 0.45]) {
          let blob: Blob | null = null
          try { blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality)) } catch { break }
          if (!blob || blob.type !== type || blob.size === 0) break
          generated = true
          if (blob.size <= MAX_PHOTO_BYTES) return blob
        }
      }
    }
    throw new Error(generated ? 'No pudimos reducir la foto a 256 KB. Elegí una imagen más pequeña.' : 'No pudimos generar una foto WebP ni JPEG. Elegí otra imagen o intentá desde otro navegador.')
  } finally { image.onload = null; image.onerror = null; URL.revokeObjectURL(url) }
}

export async function reservePhoto(client: SupabaseClient, productId: string, revision: string | undefined, isNew: boolean, type: string): Promise<string> {
  const { data, error } = await client.rpc('begin_product_photo', { p_product_id: productId, p_revision: revision ?? null, p_new: isNew, p_mime: photoMime(type) }).abortSignal(AbortSignal.timeout(12000))
  if (error?.code === 'PGRST202') throw new Error('Falta aplicar la migración 0007 de compatibilidad de fotografías.')
  if (error || typeof data !== 'string') throw new Error(error?.code === '40001' ? 'El producto cambió. Cancelá y abrí su edición nuevamente.' : 'No pudimos preparar la fotografía. Revisá la conexión, los permisos y la configuración de Storage.')
  return data
}

export async function uploadPhoto(client: SupabaseClient, path: string, photo: Blob): Promise<void> {
  if (!path.endsWith('.' + photoExtension(photo.type)) || photo.size <= 0 || photo.size > MAX_PHOTO_BYTES) throw new Error('La fotografía no coincide con su ruta o supera 256 KB.')
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('La carga demoró demasiado. La foto anterior se conserva; revisá la conexión y volvé a guardar.')), 25000) })
    const result = await Promise.race([client.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: photoMime(photo.type), upsert: false, cacheControl: '0' }), timeout])
    if (result.error) throw new Error('No se pudo subir la fotografía. El producto y la foto anterior se conservan. Revisá la conexión y volvé a guardar.')
  } finally { clearTimeout(timer) }
  // Storage puede terminar una carga después del timeout: su registro vence y la limpieza la recoge.
}

// La cola persistente sobrevive al cierre del navegador; el trabajador programado también la procesa.
export async function cleanupPhotos(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.rpc('get_product_photo_cleanup').abortSignal(AbortSignal.timeout(12000))
  if (error || !Array.isArray(data)) return
  for (const path of data) {
    if (typeof path !== 'string') continue
    const removed = await client.storage.from(PHOTO_BUCKET).remove([path])
    if (!removed.error) await client.rpc('ack_product_photo_cleanup', { p_path: path })
  }
}
