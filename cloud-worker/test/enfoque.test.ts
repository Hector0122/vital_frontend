import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from '../src/index'
import { validarEnfoque, type EntradaEnfoque } from '../src/enfoque'

const entrada: EntradaEnfoque = {
  texto: 'Esta semana quiero dibujar más',
  diasRestantes: 2,
  actividades: [
    { id: 'a1-1', nombre: 'Dibujo', area: 'Creatividad', vecesEstaSemana: 1 },
    { id: 'a0-0', nombre: 'Ejercicio', area: 'Bienestar', metaActual: 3, vecesEstaSemana: 2 }
  ]
}

describe('validarEnfoque', () => {
  it('pide texto y días válidos', () => {
    expect(validarEnfoque(entrada)).toEqual(entrada)
    expect(validarEnfoque({ ...entrada, texto: '  ' })).toBeNull()
    expect(validarEnfoque({ ...entrada, diasRestantes: 0 })).toBeNull()
  })
})

describe('POST /enfoque', () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = { API_TOKEN: 't', GROQ_API_KEY: 'g' } as unknown as Env
  const post = (body: unknown) =>
    worker.fetch(
      new Request('https://w.dev/enfoque', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: JSON.stringify(body) }) as never,
      env
    )

  it('limita las veces a lo que todavía cabe en la semana', async () => {
    const respuesta = { mensaje: 'Va por el dibujo.', metas: [{ actividadId: 'a1-1', veces: 5, motivo: 'Tu enfoque' }] }
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify(respuesta) } }] })))
    const res = await post(entrada)
    expect(res.status).toBe(200)
    // ya dibujó 1 vez + quedan 2 días = máximo 3
    expect(await res.json()).toEqual({ mensaje: 'Va por el dibujo.', metas: [{ actividadId: 'a1-1', veces: 3, motivo: 'Tu enfoque' }] })
  })

  it('502 si Groq falla; 400 si falta el texto', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })))
    expect((await post(entrada)).status).toBe(502)
    expect((await post({ ...entrada, texto: '' })).status).toBe(400)
  })
})
