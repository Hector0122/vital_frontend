import { describe, expect, it } from 'vitest'
import worker, { type Env } from '../src/index'

function fakeBucket() {
  const store = new Map<string, Uint8Array>()
  return {
    store,
    async put(key: string, body: ArrayBuffer | string) {
      store.set(key, typeof body === 'string' ? new TextEncoder().encode(body) : new Uint8Array(body))
    },
    async get(key: string) {
      const data = store.get(key)
      return data ? { body: new Response(data).body } : null
    },
    async delete(key: string) {
      store.delete(key)
    }
  }
}

const TOKEN = 'secreto'
const auth = { Authorization: `Bearer ${TOKEN}` }

function setup(token: string | null = TOKEN) {
  const bucket = fakeBucket()
  const env = { BUCKET: bucket, API_TOKEN: token ?? undefined } as unknown as Env
  const call = (path: string, init?: RequestInit) =>
    worker.fetch(new Request(`https://w.dev${path}`, init) as never, env)
  return { bucket, call }
}

describe('vital-cloud', () => {
  it('sube, descarga y borra una foto', async () => {
    const { bucket, call } = setup()
    const body = new Uint8Array([1, 2, 3])
    const put = await call('/fotos/abc-1.jpg', {
      method: 'PUT',
      body,
      headers: auth // sin Content-Length, como un envío chunked
    })
    expect(put.status).toBe(201)
    expect(bucket.store.get('fotos/abc-1.jpg')).toEqual(body)

    const get = await call('/fotos/abc-1.jpg', { headers: auth })
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(body)

    expect((await call('/fotos/abc-1.jpg', { method: 'DELETE', headers: auth })).status).toBe(204)
    expect((await call('/fotos/abc-1.jpg', { headers: auth })).status).toBe(404)
  })

  it('rechaza sin token, con token equivocado o sin token configurado', async () => {
    expect((await setup().call('/fotos/a.jpg')).status).toBe(401)
    expect((await setup().call('/fotos/a.jpg', { headers: { Authorization: 'Bearer otro' } })).status).toBe(401)
    expect((await setup(null).call('/fotos/a.jpg', { headers: auth })).status).toBe(401)
  })

  it('solo acepta nombres de foto válidos (sin escapar de fotos/)', async () => {
    const { call } = setup()
    for (const p of ['/fotos/..%2Fx.jpg', '/fotos/a.png', '/otra/a.jpg', '/fotos/a/b.jpg']) {
      expect((await call(p, { headers: auth })).status).toBe(404)
    }
  })

  it('rechaza cuerpos vacíos o enormes', async () => {
    const { call } = setup()
    const put = (body: Uint8Array) => call('/fotos/a.jpg', { method: 'PUT', body, headers: auth })
    expect((await put(new Uint8Array(0))).status).toBe(413)
    expect((await put(new Uint8Array(16 * 1024 * 1024))).status).toBe(413)
  })

  it('guarda y devuelve el respaldo; rechaza lo que no es de Vital', async () => {
    const { bucket, call } = setup()
    const respaldo = JSON.stringify({ app: 'vital', version: 1, datos: {} })
    const put = await call('/respaldo', { method: 'PUT', body: respaldo, headers: auth })
    expect(put.status).toBe(201)
    expect([...bucket.store.keys()].sort()).toEqual(['respaldos/ultimo.json', expect.stringMatching(/^respaldos\/\d{4}-\d{2}-\d{2}\.json$/)].sort())
    expect(await (await call('/respaldo', { headers: auth })).text()).toBe(respaldo)
    expect((await call('/respaldo', { method: 'PUT', body: '{"app":"otra"}', headers: auth })).status).toBe(400)
    expect((await call('/respaldo', { method: 'PUT', body: 'x', headers: auth })).status).toBe(400)
    expect((await call('/respaldo', { method: 'PUT', body: respaldo })).status).toBe(401)
  })

  it('health no pide token', async () => {
    expect((await setup().call('/health')).status).toBe(200)
  })
})
