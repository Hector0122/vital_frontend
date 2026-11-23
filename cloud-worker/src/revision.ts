/**
 * Revisión semanal con IA (Groq, mismo patrón que veya_backend/src/ai/ai.service.ts).
 * Recibe conteos, sensaciones y, desde v0.4, cada registro con su nota (recortada)
 * para hablar de momentos concretos. Devuelve el análisis por secciones y hasta 2
 * metas ligeras. Si Groq falla dos veces (modelo principal y respaldo), responde
 * 502 y la app usa sus reglas locales.
 */

export interface ActividadSemana {
  id: string
  nombre: string
  area: string
  veces: number
  minutos: number
  metaAnterior?: number
  vecesAnterior?: number // días la semana previa (versiones viejas de la app no lo mandan)
}

export interface RegistroSemana {
  fecha: string
  dia: string // 'martes'
  actividadId: string
  actividad: string
  area: string
  minutos?: number
  sensacion?: string
  nota?: string
}

export interface MetaReal {
  actividadId: string
  nombre: string
  meta: number
  dias: number
}

export interface EntradaRevision {
  actividades: ActividadSemana[]
  sensaciones: Record<string, number>
  diasConRegistro: number
  diasConRegistroAnterior?: number
  racha?: number // semanas seguidas con algún registro
  enfoque?: string // lo que la persona dijo que quería priorizar esa semana
  // Desde v0.4 (opcionales: versiones viejas de la app no los mandan)
  registros?: RegistroSemana[]
  metas?: MetaReal[] // las metas que había ESA semana, con días logrados
  diasUsandoApp?: number // < 7 = semana parcial (empezó a usar la app a media semana)
  logros?: string[] // hechos ya calculados por la app (racha, mejor semana…): ciertos
}

export interface Sugerencia {
  actividadId: string
  veces: number
  motivo: string
}

export interface Secciones {
  titular: string
  destacado: string[]
  metas: string
  sentir: string
  proxima: string
}

export interface SalidaRevision {
  analisis: string // texto completo: lo leen las versiones viejas de la app
  sugerencias: Sugerencia[]
  secciones?: Secciones
}

const corto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const entero = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
const FECHA = /^\d{4}-\d{2}-\d{2}$/

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
      ...(entero(a.metaAnterior, 1, 7) ? { metaAnterior: a.metaAnterior } : {}),
      ...(entero(a.vecesAnterior, 0, 7) ? { vecesAnterior: a.vecesAnterior } : {})
    })
  }
  const sensaciones: Record<string, number> = {}
  for (const [k, v] of Object.entries(b.sensaciones ?? {}).slice(0, 10)) {
    if (corto(k, 30) && entero(v, 0, 100)) sensaciones[corto(k, 30)] = v as number
  }

  const registros: RegistroSemana[] = []
  for (const r of Array.isArray(b.registros) ? b.registros.slice(0, 80) : []) {
    if (!r || typeof r.fecha !== 'string' || !FECHA.test(r.fecha) || !corto(r.actividadId, 40) || !corto(r.actividad, 60))
      continue // un registro raro se ignora; no tumba la revisión
    const nota = corto(r.nota, 300)
    const sensacion = corto(r.sensacion, 30)
    registros.push({
      fecha: r.fecha,
      dia: corto(r.dia, 12),
      actividadId: corto(r.actividadId, 40),
      actividad: corto(r.actividad, 60),
      area: corto(r.area, 60),
      ...(entero(r.minutos, 1, 1440) ? { minutos: r.minutos } : {}),
      ...(sensacion ? { sensacion } : {}),
      ...(nota ? { nota } : {})
    })
  }
  const metas: MetaReal[] = []
  for (const m of Array.isArray(b.metas) ? b.metas.slice(0, 20) : []) {
    if (m && corto(m.actividadId, 40) && entero(m.meta, 1, 7) && entero(m.dias, 0, 7))
      metas.push({ actividadId: corto(m.actividadId, 40), nombre: corto(m.nombre, 60), meta: m.meta, dias: m.dias })
  }
  const logros = (Array.isArray(b.logros) ? b.logros : [])
    .map((l) => corto(l, 200))
    .filter(Boolean)
    .slice(0, 6)

  const enfoque = corto(b.enfoque, 300)
  return {
    actividades,
    sensaciones,
    diasConRegistro: b.diasConRegistro!,
    ...(entero(b.diasConRegistroAnterior, 0, 7) ? { diasConRegistroAnterior: b.diasConRegistroAnterior } : {}),
    ...(entero(b.racha, 0, 520) ? { racha: b.racha } : {}),
    ...(enfoque ? { enfoque } : {}),
    ...(registros.length ? { registros } : {}),
    ...(metas.length ? { metas } : {}),
    ...(entero(b.diasUsandoApp, 1, 7) ? { diasUsandoApp: b.diasUsandoApp } : {}),
    ...(logros.length ? { logros } : {})
  }
}

/** Lo que devuelve el modelo no es de fiar: solo pasan ids conocidos, 1–7 veces, máx. 2. */
export function limpiarSalida(texto: string, entrada: EntradaRevision): SalidaRevision | null {
  let r: Partial<Record<keyof Secciones | 'analisis' | 'sugerencias', unknown>>
  try {
    r = JSON.parse(texto)
  } catch {
    return null
  }
  const sugerencias = limpiarMetas(r.sugerencias, entrada.actividades, 2)
  const titular = corto(r.titular, 200)
  if (titular) {
    const secciones: Secciones = {
      titular,
      destacado: (Array.isArray(r.destacado) ? r.destacado : [])
        .map((d) => corto(d, 400))
        .filter(Boolean)
        .slice(0, 3),
      metas: corto(r.metas, 500),
      sentir: corto(r.sentir, 500),
      proxima: corto(r.proxima, 500)
    }
    const analisis = [titular, ...secciones.destacado, secciones.metas, secciones.sentir, secciones.proxima]
      .filter(Boolean)
      .join('\n\n')
    return { analisis, sugerencias, secciones }
  }
  // Formato viejo (o un modelo que no siguió el esquema): un solo texto.
  const analisis = corto(r.analisis, 1500)
  return analisis ? { analisis, sugerencias } : null
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

const SISTEMA = `Eres el asistente de Vital, una app de equilibrio personal (no de productividad). Escribes el resumen del domingo: lo que la persona lee para darse cuenta de cómo le fue y querer seguir.

Recibes (JSON):
- "registros": cada cosa que registró esa semana, con día, actividad, área, minutos, sensación y nota. Las notas son su voz: de ahí salen los momentos concretos.
- "actividades": conteo de días por actividad esta semana ("veces") y la anterior ("vecesAnterior").
- "metas": las metas que tenía ESA semana, con "dias" logrados contra "meta".
- "logros": hechos ya calculados por la app (racha, mejor semana, lo retomado). Son ciertos; úsalos.
- "enfoque": lo que se propuso priorizar esa semana, si existe.
- "diasUsandoApp": si es menor que 7, empezó a usar la app a media semana.
- "sensaciones", "diasConRegistro", "diasConRegistroAnterior", "racha".

Escribe estas secciones (español neutro, de "tú", cálido y directo, sin emojis, sin listas ni viñetas dentro del texto):
- "titular": una frase (máx. 20 palabras) que capture la semana con algo concreto y cierto. No genérico: nada de "fue una buena semana".
- "destacado": de 1 a 3 frases, cada una un momento concreto, sacado de las notas cuando las hay (lo que terminó, retomó, disfrutó o vivió con alguien). Con días y horas cuando ayuden ("el sábado, 4 horas de…"). Si no hay notas, usa días, horas y patrones, sin inventar de qué se trató.
- "metas": 1 o 2 frases con el estado real de cada meta (ej. "Caminata se cumplió de sobra, 3 días contra 1; Dibujo no lo registramos ningún día."). Cadena vacía si no hay metas.
- "sentir": 1 o 2 frases con el patrón de sensaciones ligado a actividades si lo hay (ej. "los días con ejercicio, con energía; el cansancio vino con el trabajo"). Cadena vacía si no hay datos suficientes.
- "proxima": 1 o 2 frases con una propuesta concreta y pequeña para la semana que viene, coherente con las sugerencias. Cierre tipo "veamos cómo nos va".
- "sugerencias": de 0 a 2 metas ligeras (ver reglas).

Reglas de tono:
- Honesto sin regañar: lo que faltó se nombra con calma y en plural ("no lo registramos", "veamos cómo nos va"). Nunca "fallaste", "deberías", "no cumpliste", "mal".
- Si algo bajó frente a la semana anterior, dilo en una frase con una invitación a retomarlo.
- Nada de elogios vacíos: reconoce solo cosas concretas.
- El descanso y el tiempo con la familia valen igual que el ejercicio o los proyectos.
- Sin diagnósticos de salud ni psicológicos.

Reglas de datos — obligatorias:
- No inventes. Un registro sin nota se describe solo con su día, actividad y duración.
- No uses la nota de un día para deducir qué pasó otro día sin nota.
- El enfoque manda: si pidió dejar algo, no lo sugieras; si pidió hacer algo, priorízalo.
- El área "Trabajo" no es creatividad ni descanso: si pesó en la semana, menciónala aparte.
- Semana parcial (diasUsandoApp < 7): dilo y no la compares como si fuera completa.
- Horas: convierte minutos a horas cuando pase de 60 ("2 horas y media").

Sugerencias (progreso de a poco):
- Meta cumplida y sin cansancio predominante: sube como mucho 1 vez.
- Meta no cumplida: propón lo que sí logró (mínimo 1), sin subir.
- Puedes proponer retomar algo descuidado con 1 vez.
- Si predomina el cansancio, prioriza descanso y no subas nada.
- "motivo": una frase corta y amable. Usa solo ids de "actividades".

Responde SOLO con JSON: {"titular": string, "destacado": string[], "metas": string, "sentir": string, "proxima": string, "sugerencias": [{"actividadId": string, "veces": number, "motivo": string}]}`

/** Esquema estricto: Groq garantiza la forma de la respuesta (si el modelo lo soporta). */
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['titular', 'destacado', 'metas', 'sentir', 'proxima', 'sugerencias'],
  properties: {
    titular: { type: 'string' },
    destacado: { type: 'array', items: { type: 'string' } },
    metas: { type: 'string' },
    sentir: { type: 'string' },
    proxima: { type: 'string' },
    sugerencias: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['actividadId', 'veces', 'motivo'],
        properties: { actividadId: { type: 'string' }, veces: { type: 'integer' }, motivo: { type: 'string' } }
      }
    }
  }
}

export async function revisarConGroq(
  entrada: EntradaRevision,
  apiKey: string | undefined,
  modelo?: string
): Promise<SalidaRevision | null> {
  return pedirAGroq(SISTEMA, entrada, apiKey, modelo, (t) => limpiarSalida(t, entrada), ESQUEMA)
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[]
}

export const MODELO_PRINCIPAL = 'openai/gpt-oss-120b'
export const MODELO_RESPALDO = 'llama-3.3-70b-versatile'

/**
 * Pide JSON a Groq y lo pasa por `limpiar`. Si el modelo principal falla o
 * responde algo que no sirve, reintenta una vez con el de respaldo.
 */
export async function pedirAGroq<T>(
  sistema: string,
  entrada: unknown,
  apiKey: string | undefined,
  modelo: string | undefined,
  limpiar: (texto: string) => T | null,
  esquema?: object
): Promise<T | null> {
  if (!apiKey) {
    console.error('groq: falta GROQ_API_KEY')
    return null
  }
  for (const m of [modelo || MODELO_PRINCIPAL, MODELO_RESPALDO]) {
    const texto = await llamarGroq(sistema, entrada, apiKey, m, esquema)
    const r = texto ? limpiar(texto) : null
    if (r) return r
    if (texto) console.error('groq: respuesta no usable', m, texto.slice(0, 300))
  }
  return null
}

/** Una llamada a Groq. Devuelve el texto o null; nunca lanza. */
export async function llamarGroq(
  sistema: string,
  entrada: unknown,
  apiKey: string,
  modelo: string,
  esquema?: object
): Promise<string | null> {
  const razona = modelo.startsWith('openai/gpt-oss')
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.5,
        // El razonamiento de gpt-oss cuenta contra este tope: con 800 se quedaba sin espacio para responder.
        max_completion_tokens: 4000,
        ...(razona ? { reasoning_effort: 'low' } : {}),
        response_format:
          esquema && razona
            ? { type: 'json_schema', json_schema: { name: 'salida', strict: true, schema: esquema } }
            : { type: 'json_object' },
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: JSON.stringify(entrada) }
        ]
      }),
      signal: AbortSignal.timeout(25_000)
    })
    // Los motivos quedan en los logs de Cloudflare (observability en wrangler.toml); nunca se loguea la entrada.
    if (!res.ok) {
      console.error('groq', modelo, res.status, (await res.text()).slice(0, 300))
      return null
    }
    const data = (await res.json()) as GroqResponse
    const texto = data.choices?.[0]?.message?.content?.trim()
    if (!texto) console.error('groq: respuesta vacía', modelo, JSON.stringify(data).slice(0, 300))
    return texto || null
  } catch (e) {
    console.error('groq: error de red o timeout', modelo, String(e))
    return null
  }
}
