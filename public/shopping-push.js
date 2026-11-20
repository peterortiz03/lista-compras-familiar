const sessionIdPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()))

self.addEventListener('push', event => {
  let payload
  try { payload = event.data?.json() } catch { return }
  if (payload?.kind !== 'shopping-session' || typeof payload.sessionId !== 'string' || !sessionIdPattern.test(payload.sessionId)
    || typeof payload.displayName !== 'string' || !payload.displayName.trim() || payload.displayName.length > 120) return
  event.waitUntil(self.registration.showNotification('En casa · Compra en curso', {
    body: `${payload.displayName} está haciendo las compras. ¿Necesitás agregar algo?`,
    icon: '/icons/icon-192.png',
    tag: `shopping-${payload.sessionId}`,
    data: { sessionId: payload.sessionId },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const id = event.notification.data?.sessionId
  if (typeof id !== 'string' || !sessionIdPattern.test(id)) return
  const target = new URL('/', self.location.origin)
  target.searchParams.set('shopping', id)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const current = windows.find(client => {
      const url = new URL(client.url)
      return url.origin === target.origin && url.pathname === '/'
    })
    if (current) {
      try {
        const client = await current.navigate(target.href)
        if (client) { await client.focus().catch(() => {}); return }
      } catch { /* Algunos navegadores requieren abrir la app desde la notificación. */ }
    }
    await self.clients.openWindow(target.href)
  })())
})
