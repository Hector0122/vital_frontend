import { isAuthorized } from './auth'
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

const texto = (status: number, body: string) => new Response(body, { status })

/**
 * API mínima, un solo usuario:
 *   GET    /health
 *   PUT    /fotos/:nombre   (cuerpo = jpeg)
 *   GET    /fotos/:nombre
 *   DELETE /fotos/:nombre
 *   POST   /revision       (resumen de la semana → análisis + metas ligeras, vía Groq)
 * Las fotos se escriben con el binding de R2: no hacen falta llaves S3.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/health') return Response.json({ ok: true })
    if (!(await isAuthorized(request, env.API_TOKEN))) return texto(401, 'No autorizado')

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
