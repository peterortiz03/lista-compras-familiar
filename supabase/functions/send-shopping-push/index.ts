import { timingSafeEqual } from 'node:crypto'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { configureVapid, sendDelivery } from './delivery.ts'
import type { Delivery } from './delivery.ts'

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  const secret = Deno.env.get('SHOPPING_PUSH_CRON_SECRET') ?? ''
  if (secret.length < 32) return new Response('Worker not configured', { status: 503 })
  const hash = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const [expected, supplied] = await Promise.all([hash(secret), hash(request.headers.get('x-shopping-push-secret') ?? '')])
  if (!timingSafeEqual(new Uint8Array(expected), new Uint8Array(supplied))) return new Response('Unauthorized', { status: 401 })

  try {
    const vapid = configureVapid(Deno.env.get('WEB_PUSH_SUBJECT') ?? '', Deno.env.get('WEB_PUSH_PUBLIC_KEY') ?? '', Deno.env.get('WEB_PUSH_PRIVATE_KEY') ?? '')
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.rpc('claim_shopping_push').abortSignal(AbortSignal.timeout(5000))
    if (error || !Array.isArray(data)) return new Response('Queue unavailable', { status: 503 })

    const deliveries: Delivery[] = data
    const counters = { sent: 0, invalid: 0, expired: 0, failed: 0 }
    for (let start = 0; start < deliveries.length; start += 8) {
      await Promise.all(deliveries.slice(start, start + 8).map(async delivery => {
        const result = await sendDelivery(delivery, vapid)
        if (result === 'invalid') {
          const cleanup = await client.rpc('invalidate_shopping_push', { p_id: delivery.subscription_id, p_revision: delivery.revision })
            .abortSignal(AbortSignal.timeout(3000))
          if (cleanup.error) { counters.failed++; return }
        }
        counters[result]++
      }))
    }
    return Response.json(counters)
  } catch { return new Response('Worker unavailable', { status: 503 }) }
})
