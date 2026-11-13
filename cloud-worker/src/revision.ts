/**
 * Revisión semanal con IA (Groq, mismo patrón que veya_backend/src/ai/ai.service.ts).
 * Recibe solo conteos y sensaciones — nunca notas ni fotos — y devuelve un
 * análisis corto y hasta 2 metas ligeras. Si Groq falla, responde 502 y la app
 * usa sus reglas locales.
 */

export interface ActividadSemana {
  id: string
  nombre: string
  area: string
  veces: number
  minutos: number
  metaAnterior?: number
}

export interface EntradaRevision {
  actividades: ActividadSemana[]
  sensaciones: Record<string, number>
  diasConRegistro: number
  enfoque?: string // lo que la persona dijo que quería priorizar esa semana
}

export interface Sugerencia {
  actividadId: string
  veces: number
  motivo: string
}

export interface SalidaRevision {
  analisis: string
  sugerencias: Sugerencia[]
}

const corto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const entero = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

/** Valida lo que manda la app (frontera de confianza). Devuelve null si no sirve. */
export function validarEntrada(body: unknown): EntradaRevision | null {
  const b = body as Partial<EntradaRevision> | null
  if (!b || !Array.isArray(b.actividades) || b.actividades.length > 60) return null
  if (!entero(b.diasConRegistro, 0, 7)) return null
  const actividades: ActividadSemana[] = []
  for (const a of b.actividades) {
    if (!a || !corto(a.id, 40) || !corto(a.nombre, 60) || !entero(a.veces, 0, 100) || !entero(a.minutos, 0, 10000)) {
      return null
    }
    actividades.push({
      id: corto(a.id, 40),
      nombre: corto(a.nombre, 60),
      area: corto(a.area, 60),
      veces: a.veces,
      minutos: a.minutos,
      ...(entero(a.metaAnterior, 1, 7) ? { metaAnterior: a.metaAnterior } : {})
    })
  }
  const sensaciones: Record<string, number> = {}
  for (const [k, v] of Object.entries(b.sensaciones ?? {}).slice(0, 10)) {
    if (corto(k, 30) && entero(v, 0, 100)) sensaciones[corto(k, 30)] = v as number
  }
  const enfoque = corto(b.enfoque, 300)
  return { actividades, sensaciones, diasConRegistro: b.diasConRegistro!, ...(enfoque ? { enfoque } : {}) }
}

/** Lo que devuelve el modelo no es de fiar: solo pasan ids conocidos, 1–7 veces, máx. 2. */
export function limpiarSalida(texto: string, entrada: EntradaRevision): SalidaRevision | null {
  let r: { analisis?: unknown; sugerencias?: unknown }
  try {
    r = JSON.parse(texto)
  } catch {
    return null
  }
  const analisis = corto(r.analisis, 700)
  if (!analisis) return null
  return { analisis, sugerencias: limpiarMetas(r.sugerencias, entrada.actividades, 2) }
}

/** Solo ids conocidos, sin repetir, 1–7 veces, hasta `max`. */
export function limpiarMetas(lista: unknown, actividades: { id: string }[], max: number): Sugerencia[] {
  const ids = new Set(actividades.map((a) => a.id))
  const vistos = new Set<string>()
  const metas: Sugerencia[] = []
  for (const s of Array.isArray(lista) ? (lista as Record<string, unknown>[]) : []) {
    const id = corto(s?.actividadId, 40)
    if (!ids.has(id) || vistos.has(id) || !entero(s?.veces, 1, 7)) continue
    vistos.add(id)
    metas.push({ actividadId: id, veces: s.veces as number, motivo: corto(s?.motivo, 160) })
    if (metas.length === max) break
  }
  return metas
}

const SISTEMA = `Eres el asistente de Vital, una app de equilibrio personal (no de productividad).
Recibes cuántas veces la persona hizo cada actividad esta semana (lunes a domingo), cómo se sintió, las metas que tenía y, si existe, el "enfoque" que se propuso para esa semana (menciónalo con amabilidad y tenlo en cuenta).

Reglas de tono — obligatorias:
- Español neutro, cálido y breve. Habla de "tú".
- Describe, no juzgues: nada de "fallaste", "deberías", "no cumpliste", "mal". Lo no hecho se nombra con suavidad o no se nombra.
- El descanso y el tiempo con la familia valen igual que el ejercicio o los proyectos.
- Sin diagnósticos de salud ni psicológicos. Sin emojis.

Tarea:
1. "analisis": 2 a 4 frases sobre la semana basadas SOLO en los datos (qué hubo, qué patrón se ve con las sensaciones si lo hay, qué quedó de lado).
2. "sugerencias": de 0 a 2 metas ligeras para la próxima semana. Progreso de a poco:
   - Si una meta se cumplió y la persona no se sintió cansada, sube como mucho 1 vez.
   - Si no se cumplió, propón lo que sí logró (mínimo 1), sin subir.
   - Puedes proponer retomar algo descuidado con 1 vez.
   - Si predomina el cansancio, prioriza descanso y no subas nada.
   - "motivo": una frase corta y amable.
   Usa solo ids de la lista recibida.

Responde SOLO con JSON: {"analisis": string, "sugerencias": [{"actividadId": string, "veces": number, "motivo": string}]}`

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
}

/** Llama a Groq; null si no hay llave, falla o la respuesta no sirve. Nunca lanza. */
export async function revisarConGroq(
  entrada: EntradaRevision,
  apiKey: string | undefined,
  modelo?: string
): Promise<SalidaRevision | null> {
  const texto = await llamarGroq(SISTEMA, entrada, apiKey, modelo)
  return texto ? limpiarSalida(texto, entrada) : null
}

/** Pide JSON a Groq (mismo patrón que veya_backend/src/ai/ai.service.ts). Devuelve el texto o null. */
export async function llamarGroq(
  sistema: string,
  entrada: unknown,
  apiKey: string | undefined,
  modelo = 'openai/gpt-oss-120b'
): Promise<string | null> {
  if (!apiKey) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.4,
        max_completion_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: JSON.stringify(entrada) }
        ]
      }),
      signal: AbortSignal.timeout(25_000)
    })
    if (!res.ok) return null
    const data = (await res.json()) as GroqResponse
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch {
    return null
  }
}
