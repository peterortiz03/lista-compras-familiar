export const PHOTO_BUCKET = 'product-photos'
export const MAX_INPUT_BYTES = 12 * 1024 * 1024
export const MAX_PHOTO_BYTES = 256 * 1024
const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])

export function validatePhoto(file: { type: string; size: number }): void {
  if (!accepted.has(file.type)) throw new Error('Elegí una imagen JPG, PNG o WebP. Si está en HEIC, exportala como JPG desde tu galería.')
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) throw new Error('La fotografía debe pesar como máximo 12 MB y no estar vacía.')
}

export function photoDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 40_000_000) throw new Error('La imagen no es válida o supera los 40 megapíxeles. Elegí una versión más pequeña.')
  const scale = Math.min(1, 512 / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function belongsToFamily(path: string, familyId: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  return new RegExp(`^${uuid}/${uuid}/${uuid}\\.(?:webp|jpg)$`, 'i').test(path) && path.split('/')[0] === familyId
}

export function photoMime(type: string): 'image/webp' | 'image/jpeg' {
  if (type !== 'image/webp' && type !== 'image/jpeg') throw new Error('El resultado debe ser WebP o JPEG.')
  return type
}
export function photoExtension(type: string): 'webp' | 'jpg' {
  return photoMime(type) === 'image/webp' ? 'webp' : 'jpg'
}
