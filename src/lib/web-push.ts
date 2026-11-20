import type { SupabaseClient } from '@supabase/supabase-js'

type PushSupport = 'available' | 'install-on-ios' | 'unsupported' | 'unconfigured'
const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim()

function decodeKey(value: string | undefined) {
  if (!value || !/^B[A-Za-z0-9_-]{86}$/.test(value)) return null
  return Uint8Array.from(atob(`${value.replaceAll('-', '+').replaceAll('_', '/')}=`), entry => entry.charCodeAt(0))
}

export const applicationServerKey = decodeKey(publicKey)

export function pushSupport(): PushSupport {
  const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (appleMobile && !standalone) return 'install-on-ios'
  if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return applicationServerKey ? 'available' : 'unconfigured'
}

async function within<T>(operation: Promise<T>, milliseconds: number) {
  let timer: number | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error('Tiempo de espera agotado')), milliseconds)
    })])
  } finally { window.clearTimeout(timer) }
}

export async function preparePush() {
  const registration = await navigator.serviceWorker.register('/shopping-push.js', { updateViaCache: 'none' })
  return registration.active ? registration : within(navigator.serviceWorker.ready, 10000)
}

export function usesConfiguredKey(subscription: PushSubscription) {
  const key = subscription.options.applicationServerKey
  if (!key || !applicationServerKey) return false
  const bytes = new Uint8Array(key)
  return bytes.length === applicationServerKey.length && applicationServerKey.every((byte, position) => byte === bytes[position])
}

export async function registerPush(client: SupabaseClient, subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Suscripción incompleta')
  const { error } = await client.rpc('register_shopping_push', {
    p_endpoint: endpoint, p_p256dh: keys.p256dh, p_auth: keys.auth,
    p_expires_at: subscription.expirationTime === null ? null : new Date(subscription.expirationTime).toISOString(),
  }).abortSignal(AbortSignal.timeout(8000))
  if (error) throw error
}

export async function unregisterPush(client: SupabaseClient, subscription: PushSubscription) {
  const unregisterServer = async () => {
    const { error } = await client.rpc('unregister_shopping_push', { p_endpoint: subscription.endpoint }).abortSignal(AbortSignal.timeout(5000))
    if (error) throw error
    return 'server' as const
  }
  const results = await Promise.allSettled([unregisterServer(), within(subscription.unsubscribe(), 5000)])
  const browser = results[1].status === 'fulfilled'
  if (results[0].status === 'rejected' && !browser) throw new Error('No pudimos desactivar los avisos. Revisá tu conexión e intentá de nuevo.')
  return browser
}

export async function unregisterPushOnSignOut(client: SupabaseClient) {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager?.getSubscription()
    if (subscription) await unregisterPush(client, subscription)
  } catch { /* La cuenta puede cerrarse aunque el proveedor push esté temporalmente indisponible. */ }
}

export function shoppingNoticeFromUrl() {
  const id = new URLSearchParams(window.location.search).get('shopping')
  return id && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id) ? id : null
}
