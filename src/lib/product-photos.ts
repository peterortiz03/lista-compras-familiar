import type { SupabaseClient } from '@supabase/supabase-js'

import { PHOTO_BUCKET, MAX_PHOTO_BYTES, photoDimensions, validatePhoto } from './photo-rules.ts'
export { PHOTO_BUCKET, belongsToFamily } from './photo-rules.ts'

// El decodificador nativo aplica EXIF; el canvas exporta píxeles sin el archivo original ni sus metadatos.
export async function processPhoto(file: File): Promise<Blob> {
  validatePhoto(file)
  const url = URL.createObjectURL(file)
  const image = new Image()
  try {
    image.src = url
    await image.decode()
    const dimensions = photoDimensions(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    Object.assign(canvas, dimensions)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Este navegador no puede procesar imágenes.')
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height)
    for (const quality of [0.82, 0.65, 0.5]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))
      if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador no permite convertir a WebP. Probá con un navegador actualizado.')
      if (blob.size <= MAX_PHOTO_BYTES) return blob
    }
    throw new Error('No pudimos reducir la foto a 256 KB. Elegí otra imagen.')
  } catch (failure) {
    if (failure instanceof Error && failure.name !== 'EncodingError') throw failure
    throw new Error('No pudimos leer esta imagen. Elegí otro archivo JPG, PNG o WebP.')
  } finally { URL.revokeObjectURL(url) }
}

export async function reservePhoto(client: SupabaseClient, productId: string, revision: string | undefined, isNew: boolean): Promise<string> {
  const { data, error } = await client.rpc('begin_product_photo', { p_product_id: productId, p_revision: revision ?? null, p_new: isNew }).abortSignal(AbortSignal.timeout(12000))
  if (error || typeof data !== 'string') throw new Error(error?.code === '40001' ? 'El producto cambió. Cancelá y abrí su edición nuevamente.' : 'No pudimos preparar la fotografía. Revisá la conexión, los permisos y la configuración de Storage.')
  return data
}

export async function uploadPhoto(client: SupabaseClient, path: string, photo: Blob): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('La carga demoró demasiado. La foto anterior se conserva; revisá la conexión y volvé a guardar.')), 25000) })
    const result = await Promise.race([client.storage.from(PHOTO_BUCKET).upload(path, photo, { contentType: 'image/webp', upsert: false, cacheControl: '0' }), timeout])
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
