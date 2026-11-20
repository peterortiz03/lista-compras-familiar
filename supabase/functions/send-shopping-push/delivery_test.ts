import assert from 'node:assert/strict'
import { createECDH, randomBytes } from 'node:crypto'
import { configureVapid, sendDelivery } from './delivery.ts'
import type { Delivery } from './delivery.ts'

const sender = createECDH('prime256v1')
const publicKey = sender.generateKeys().toString('base64url')
const vapid = configureVapid('mailto:push@example.invalid', publicKey, sender.getPrivateKey().toString('base64url'))
const delivery: Delivery = {
  session_id: '11111111-1111-4111-8111-111111111111', subscription_id: 'device', revision: 'revision',
  endpoint: 'https://web.push.apple.com/fake', p256dh: createECDH('prime256v1').generateKeys().toString('base64url'),
  auth_key: randomBytes(16).toString('base64url'), display_name: 'Luz', deliver_until: new Date(Date.now() + 120000).toISOString(),
}

Deno.test('cifra el aviso, acota su TTL y desactiva un endpoint que devuelve 410', async () => {
  const send: typeof fetch = async (endpoint, options) => {
    assert.equal(endpoint, delivery.endpoint)
    assert.equal(options?.method, 'POST')
    assert.equal(options?.redirect, 'error')
    const headers = new Headers(options?.headers)
    assert.match(headers.get('authorization') ?? '', /^vapid t=.+, k=/)
    assert.equal(headers.get('content-encoding'), 'aes128gcm')
    assert(Number(headers.get('ttl')) > 0 && Number(headers.get('ttl')) <= 120)
    assert.equal(headers.get('topic'), delivery.session_id.replaceAll('-', ''))
    assert(options?.body instanceof Uint8Array && options.body.length > 100)
    assert(!new TextDecoder().decode(options.body).includes('"displayName"'))
    return new Response(null, { status: 410 })
  }
  assert.equal(await sendDelivery(delivery, vapid, send), 'invalid')
})

Deno.test('descarta entregas vencidas y limita las solicitudes a proveedores admitidos', async () => {
  let calls = 0
  const send: typeof fetch = async () => { calls++; return new Response(null, { status: 201 }) }
  assert.equal(await sendDelivery({ ...delivery, deliver_until: new Date(0).toISOString() }, vapid, send), 'expired')
  assert.equal(await sendDelivery({ ...delivery, endpoint: 'https://web.push.apple.com.example.invalid/fake' }, vapid, send), 'invalid')
  assert.equal(calls, 0)
  assert.equal(await sendDelivery(delivery, vapid, send), 'sent')
  assert.equal(calls, 1)
})
