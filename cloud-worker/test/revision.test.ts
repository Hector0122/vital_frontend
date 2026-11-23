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
    // semana anterior y racha pasan si son válidas; si no, se ignoran
    expect(validarEntrada({ ...entrada, diasConRegistroAnterior: 4, racha: 3 })).toMatchObject({ diasConRegistroAnterior: 4, racha: 3 })
    expect(validarEntrada({ ...entrada, racha: -2 })).not.toHaveProperty('racha')
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

describe('v0.4: notas, metas reales y secciones', () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = { API_TOKEN: 't', GROQ_API_KEY: 'g' } as unknown as Env
  const rica = {
    ...entrada,
    registros: [
      { fecha: '2026-11-14', dia: 'sábado', actividadId: 'a0-0', actividad: 'Ejercicio', area: 'Bienestar', minutos: 60, sensacion: 'Con energía', nota: 'x'.repeat(500) },
      { fecha: 'mal', actividadId: 'a0-0', actividad: 'Ejercicio' } // se ignora, no tumba nada
    ],
    metas: [{ actividadId: 'a0-0', nombre: 'Ejercicio', meta: 2, dias: 3 }],
    diasUsandoApp: 3,
    logros: ['Llevas 2 semanas seguidas cuidándote.']
  }
  const secciones = {
    titular: 'Semana con energía.',
    destacado: ['El sábado, una hora de ejercicio.'],
    metas: 'Ejercicio se cumplió, 3 días contra 2.',
    sentir: '',
    proxima: 'Mantener 2 días. Veamos cómo nos va.',
    sugerencias: [{ actividadId: 'a0-0', veces: 3, motivo: 'Vas bien' }]
  }
  const post = (body: unknown) =>
    worker.fetch(
      new Request('https://w.dev/revision', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: JSON.stringify(body) }) as never,
      env
    )

  it('valida lo nuevo: recorta notas e ignora registros rotos', () => {
    const v = validarEntrada(rica)!
    expect(v.registros).toHaveLength(1)
    expect(v.registros![0].nota).toHaveLength(300)
    expect(v.metas).toEqual(rica.metas)
    expect(v.diasUsandoApp).toBe(3)
    expect(v.logros).toEqual(rica.logros)
  })

  it('devuelve secciones y un análisis completo para versiones viejas', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify(secciones) } }] }))
    vi.stubGlobal('fetch', fetchMock)
    const r = (await (await post(rica)).json()) as { analisis: string; secciones: unknown; sugerencias: unknown[] }
    expect(r.secciones).toMatchObject({ titular: 'Semana con energía.', sentir: '' })
    expect(r.analisis).toBe(
      'Semana con energía.\n\nEl sábado, una hora de ejercicio.\n\nEjercicio se cumplió, 3 días contra 2.\n\nMantener 2 días. Veamos cómo nos va.'
    )
    expect(r.sugerencias).toHaveLength(1)
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body).toMatchObject({ reasoning_effort: 'low', max_completion_tokens: 4000, response_format: { type: 'json_schema' } })
  })

  it('si el modelo principal falla, reintenta con el de respaldo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '' } }] })) // se quedó sin tokens
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: JSON.stringify(secciones) } }] }))
    vi.stubGlobal('fetch', fetchMock)
    expect((await post(rica)).status).toBe(200)
    const modelos = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).model)
    expect(modelos).toEqual(['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'])
  })
})
