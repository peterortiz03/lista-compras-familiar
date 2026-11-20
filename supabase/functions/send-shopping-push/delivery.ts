// @ts-types="npm:@types/web-push@3.6.4"
import webPush, { type RequestOptions } from 'npm:web-push@3.6.7'

type VapidDetails = NonNullable<RequestOptions['vapidDetails']>

export interface Delivery {
  session_id: string
  subscription_id: string
  revision: string
  endpoint: string
  p256dh: string
  auth_key: string
  display_name: string
  deliver_until: string
}

function allowedEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash
      && (url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
        || /\.(push\.apple\.com|(notify|wns)\.windows\.com)$/.test(url.hostname))
  } catch { return false }
}

export function configureVapid(subject: string, publicKey: string, privateKey: string): VapidDetails {
  webPush.setVapidDetails(subject, publicKey, privateKey)
  return { subject, publicKey, privateKey }
}

export async function sendDelivery(delivery: Delivery, vapidDetails: VapidDetails, send = fetch) {
  if (!allowedEndpoint(delivery.endpoint)) return 'invalid'
  const TTL = Math.min(300, Math.floor((Date.parse(delivery.deliver_until) - Date.now()) / 1000))
  if (!(TTL > 0)) return 'expired'
  try {
    const details = webPush.generateRequestDetails({ endpoint: delivery.endpoint, keys: { auth: delivery.auth_key, p256dh: delivery.p256dh } },
      JSON.stringify({ kind: 'shopping-session', sessionId: delivery.session_id, displayName: delivery.display_name }),
      { vapidDetails, TTL, urgency: 'high', topic: delivery.session_id.replaceAll('-', '') })
    const response = await send(details.endpoint, {
      method: details.method, headers: new Headers(details.headers as Record<string, string>),
      body: details.body ? new Uint8Array(details.body) : undefined,
      redirect: 'error', signal: AbortSignal.timeout(5000),
    })
    await response.body?.cancel().catch(() => {})
    if (response.status === 404 || response.status === 410) return 'invalid'
    return response.ok ? 'sent' : 'failed'
  } catch { return 'failed' }
}
