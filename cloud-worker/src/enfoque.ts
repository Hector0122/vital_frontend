import { limpiarMetas, llamarGroq, type Sugerencia } from './revision'

/**
 * "Esta semana me quiero enfocar en…": Groq reacomoda las metas de la semana en
 * curso. Recibe solo nombres, metas y conteos — nada de notas ni fotos.
 */

export interface EntradaEnfoque {
  texto: string
  diasRestantes: number // incluyendo hoy
  actividades: { id: string; nombre: string; area: string; metaActual?: number; vecesEstaSemana: number }[]
}

export interface SalidaEnfoque {
  mensaje: string
  metas: Sugerencia[]
}

const corto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const entero = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

export function validarEnfoque(body: unknown): EntradaEnfoque | null {
  const b = body as Partial<EntradaEnfoque> | null
  const texto = corto(b?.texto, 300)
  if (!b || !texto || !entero(b.diasRestantes, 1, 7) || !Array.isArray(b.actividades) || b.actividades.length > 60) {
    return null
  }
  const actividades: EntradaEnfoque['actividades'] = []
  for (const a of b.actividades) {
    if (!a || !corto(a.id, 40) || !corto(a.nombre, 60) || !entero(a.vecesEstaSemana, 0, 7)) return null
    actividades.push({
      id: corto(a.id, 40),
      nombre: corto(a.nombre, 60),
      area: corto(a.area, 60),
      vecesEstaSemana: a.vecesEstaSemana,
      ...(entero(a.metaActual, 1, 7) ? { metaActual: a.metaActual } : {})
    })
  }
  return { texto, diasRestantes: b.diasRestantes!, actividades }
}

const SISTEMA = `Eres el asistente de Vital, una app de equilibrio personal (no de productividad).
La persona escribió en qué se quiere enfocar esta semana. Recibes ese texto, sus actividades con su meta actual (si tiene), cuántas veces ya las hizo esta semana y cuántos días quedan (incluyendo hoy).

Ajusta sus metas semanales de forma ligera:
- Da prioridad a lo que pidió: súbele 1 o 2 veces a esa meta, o propón 2–3 si no tenía.
- Una meta nunca puede pedir más de (vecesEstaSemana + diasRestantes) veces, ni más de 7.
- Si la semana se llena, baja un poco otra meta para hacer espacio. No quites el descanso ni el tiempo con la familia.
- Conserva las demás metas como están. Máximo 3 metas en total.
- Si el texto no corresponde a ninguna actividad, no inventes ids: conserva las metas y explícalo en el mensaje.

Tono: español neutro, cálido, breve, de "tú". Sin "deberías", sin presión, sin emojis.

Responde SOLO con JSON: {"mensaje": string (1–2 frases), "metas": [{"actividadId": string, "veces": number, "motivo": string corto}]}`

export async function enfocarConGroq(
  entrada: EntradaEnfoque,
  apiKey: string | undefined,
  modelo?: string
): Promise<SalidaEnfoque | null> {
  const texto = await llamarGroq(SISTEMA, entrada, apiKey, modelo)
  if (!texto) return null
  try {
    const r = JSON.parse(texto) as { mensaje?: unknown; metas?: unknown }
    const mensaje = corto(r.mensaje, 400)
    if (!mensaje) return null
    // El tope de veces depende de lo que queda de la semana: el modelo no lo garantiza.
    const metas = limpiarMetas(r.metas, entrada.actividades, 3).map((m) => {
      const a = entrada.actividades.find((x) => x.id === m.actividadId)!
      return { ...m, veces: Math.min(m.veces, a.vecesEstaSemana + entrada.diasRestantes) }
    })
    return { mensaje, metas }
  } catch {
    return null
  }
}
