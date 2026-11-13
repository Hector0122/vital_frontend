import { isAuthorized } from './auth'
import { enfocarConGroq, validarEnfoque } from './enfoque'
import { revisarConGroq, validarEntrada } from './revision'

export interface Env {
  BUCKET: R2Bucket
  API_TOKEN?: string
  GROQ_API_KEY?: string
  GROQ_MODEL?: string
}

// Mismo formato que los nombres que genera la app (src/services/fotos.ts).
export const NOMBRE_FOTO = /^[\w-]{1,64}\.jpg$/
const MAX_BYTES = 15 * 1024 * 1024 // la app reduce a 1600px; esto solo frena abusos
const MAX_RESPALDO = 5 * 1024 * 1024 // datos sin fotos: años de registros caben de sobra

const texto = (status: number, body: string) => new Response(body, { status })

/**
 * API mínima, un solo usuario:
 *   GET    /health
 *   PUT    /fotos/:nombre   (cuerpo = jpeg)
 *   GET    /fotos/:nombre
 *   DELETE /fotos/:nombre
 *   PUT    /respaldo       (JSON de datos sin fotos; guarda el último + una copia por día)
 *   GET    /respaldo       (el último)
 *   POST   /enfoque        ("esta semana me quiero enfocar en…" → metas reacomodadas, vía Groq)
 *   POST   /revision       (resumen de la semana → análisis + metas ligeras, vía Groq)
 * Las fotos se escriben con el binding de R2: no hacen falta llaves S3.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/health') return Response.json({ ok: true })
    if (!(await isAuthorized(request, env.API_TOKEN))) return texto(401, 'No autorizado')

    if (pathname === '/respaldo') {
      if (request.method === 'GET') {
        const obj = await env.BUCKET.get('respaldos/ultimo.json')
        return obj ? new Response(obj.body, { headers: { 'Content-Type': 'application/json' } }) : texto(404, 'Sin respaldo')
      }
      if (request.method !== 'PUT') return texto(405, 'Método no permitido')
      const cuerpo = await request.text()
      if (!cuerpo || cuerpo.length > MAX_RESPALDO) return texto(413, 'Tamaño inválido')
      let respaldo: { app?: unknown; exportadoEn?: unknown }
      try {
        respaldo = JSON.parse(cuerpo)
      } catch {
        return texto(400, 'JSON inválido')
      }
      if (respaldo.app !== 'vital') return texto(400, 'No es un respaldo de Vital')
      const opciones = { httpMetadata: { contentType: 'application/json' } }
      const dia = new Date().toISOString().slice(0, 10)
      await Promise.all([
        env.BUCKET.put('respaldos/ultimo.json', cuerpo, opciones),
        env.BUCKET.put(`respaldos/${dia}.json`, cuerpo, opciones)
      ])
      return texto(201, 'ok')
    }

    if (pathname === '/enfoque') {
      if (request.method !== 'POST') return texto(405, 'Método no permitido')
      if (Number(request.headers.get('Content-Length')) > 64 * 1024) return texto(413, 'Demasiado grande')
      const entrada = validarEnfoque(await request.json().catch(() => null))
      if (!entrada) return texto(400, 'Enfoque inválido')
      const salida = await enfocarConGroq(entrada, env.GROQ_API_KEY, env.GROQ_MODEL || undefined)
      return salida ? Response.json(salida) : texto(502, 'La IA no respondió')
    }

    if (pathname === '/revision') {
      if (request.method !== 'POST') return texto(405, 'Método no permitido')
      if (Number(request.headers.get('Content-Length')) > 64 * 1024) return texto(413, 'Demasiado grande')
      const entrada = validarEntrada(await request.json().catch(() => null))
      if (!entrada) return texto(400, 'Resumen inválido')
      const salida = await revisarConGroq(entrada, env.GROQ_API_KEY, env.GROQ_MODEL || undefined)
      return salida ? Response.json(salida) : texto(502, 'La IA no respondió')
    }

    const match = /^\/fotos\/([^/]+)$/.exec(pathname)
    if (!match || !NOMBRE_FOTO.test(match[1])) return texto(404, 'No encontrado')
    const key = `fotos/${match[1]}`

    switch (request.method) {
      case 'PUT': {
        // Se lee completo (fotos chicas): R2 exige largo conocido y el cliente puede mandar chunked.
        if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return texto(413, 'Tamaño inválido')
        const datos = await request.arrayBuffer()
        if (!datos.byteLength || datos.byteLength > MAX_BYTES) return texto(413, 'Tamaño inválido')
        await env.BUCKET.put(key, datos, { httpMetadata: { contentType: 'image/jpeg' } })
        return texto(201, 'ok')
      }
      case 'GET': {
        const obj = await env.BUCKET.get(key)
        if (!obj) return texto(404, 'No encontrado')
        return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg' } })
      }
      case 'DELETE':
        await env.BUCKET.delete(key)
        return new Response(null, { status: 204 })
      default:
        return texto(405, 'Método no permitido')
    }
  }
} satisfies ExportedHandler<Env>
