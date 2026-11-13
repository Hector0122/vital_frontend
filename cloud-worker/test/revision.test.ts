import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from '../src/index'
import { limpiarSalida, validarEntrada, type EntradaRevision } from '../src/revision'

const entrada: EntradaRevision = {
  actividades: [
    { id: 'a0-0', nombre: 'Ejercicio', area: 'Bienestar', veces: 3, minutos: 90, metaAnterior: 3 },
    { id: 'a1-0', nombre: 'Bajo / música', area: 'Creatividad', veces: 0, minutos: 0 }
  ],
  sensaciones: { 'Con energía': 2 },
  diasConRegistro: 3
}

describe('validarEntrada', () => {
  it('acepta un resumen válido y rechaza basura', () => {
    expect(validarEntrada(entrada)).toEqual(entrada)
    expect(validarEntrada(null)).toBeNull()
    expect(validarEntrada({ ...entrada, diasConRegistro: 9 })).toBeNull()
    expect(validarEntrada({ ...entrada, actividades: [{ id: 'x', nombre: 'y', veces: -1, minutos: 0 }] })).toBeNull()
  })
})

describe('limpiarSalida', () => {
  it('solo deja ids conocidos, 1–7 veces y máximo 2', () => {
    const r = limpiarSalida(
      JSON.stringify({
        analisis: 'Semana movida.',
        sugerencias: [
          { actividadId: 'inventada', veces: 2, motivo: 'x' },
          { actividadId: 'a0-0', veces: 99, motivo: 'x' },
          { actividadId: 'a0-0', veces: 4, motivo: 'Vas bien' },
          { actividadId: 'a0-0', veces: 4, motivo: 'repetida' },
          { actividadId: 'a1-0', veces: 1, motivo: 'Retomar' }
        ]
      }),
      entrada
    )
    expect(r).toEqual({
      analisis: 'Semana movida.',
      sugerencias: [
        { actividadId: 'a0-0', veces: 4, motivo: 'Vas bien' },
        { actividadId: 'a1-0', veces: 1, motivo: 'Retomar' }
      ]
    })
  })

  it('JSON roto o sin análisis = null', () => {
    expect(limpiarSalida('no json', entrada)).toBeNull()
    expect(limpiarSalida('{"sugerencias": []}', entrada)).toBeNull()
  })
})

describe('POST /revision', () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = { API_TOKEN: 't', GROQ_API_KEY: 'g' } as unknown as Env
  const post = (body: unknown, e = env) =>
    worker.fetch(
      new Request('https://w.dev/revision', {
        method: 'POST',
        headers: { Authorization: 'Bearer t' },
        body: JSON.stringify(body)
      }) as never,
      e
    )

  it('devuelve el análisis limpio de Groq', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ analisis: 'Bien.', sugerencias: [] }) } }] })
    )
    vi.stubGlobal('fetch', fetchMock)
    const res = await post(entrada)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ analisis: 'Bien.', sugerencias: [] })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(init.body as string).model).toBe('openai/gpt-oss-120b')
  })

  it('502 si Groq falla o no hay llave; 400 con resumen inválido', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    expect((await post(entrada)).status).toBe(502)
    expect((await post(entrada, { API_TOKEN: 't' } as unknown as Env)).status).toBe(502)
    expect((await post({ nada: 1 })).status).toBe(400)
  })
})
