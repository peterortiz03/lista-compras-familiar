import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

// verify_jwt=false: esta función valida un secreto exclusivo del trabajo programado.
// No recibe rutas del solicitante y no registra secretos ni URLs privadas.
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const expected = Deno.env.get('PHOTO_CLEANUP_SECRET') ?? ''
  const supplied = request.headers.get('x-photo-cleanup-secret') ?? ''
  if (expected.length < 32) return new Response('Worker not configured', { status: 503 })
  const hash = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  const [left, right] = await Promise.all([hash(expected), hash(supplied)])
  let difference = 0
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index]
  if (difference !== 0) return new Response('Unauthorized', { status: 401 })
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: paths, error } = await client.rpc('get_all_product_photo_cleanup')
    if (error || !Array.isArray(paths)) return new Response('Could not read cleanup queue', { status: 503 })
    let cleaned = 0
    let failed = 0
    for (const path of paths) {
      const result = await client.storage.from('product-photos').remove([path])
      if (result.error) { failed++; continue }
      const ack = await client.rpc('ack_all_product_photo_cleanup', { p_path: path })
      if (ack.error) failed++
      else cleaned++
    }
    return Response.json({ cleaned, failed }, { status: failed ? 503 : 200 })
  } catch { return new Response('Cleanup unavailable; queued files will retry', { status: 503 }) }
})
