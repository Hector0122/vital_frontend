import {
  useDataStore,
  type Datos,
  type Revision,
  type Secciones,
  type Sugerencia,
} from '../stores/dataStore';
import { diasDeSemana, hoy, parseIso, toIso } from '../utils/fechas';
import { balanceSemana, metasDeSemana, veces } from '../utils/resumen';
import { leerConfig } from './nube';

/**
 * Lo que se manda a la IA (cloud-worker/src/revision.ts). Desde v0.4 incluye cada
 * registro con su nota recortada (decisión: ok mandar notas a Groq); nunca fotos.
 */
export interface EntradaRevision {
  actividades: {
    id: string;
    nombre: string;
    area: string;
    veces: number;
    minutos: number;
    metaAnterior?: number;
    vecesAnterior: number; // días distintos la semana previa, para hablar de avance o de lo que bajó
  }[];
  sensaciones: Record<string, number>;
  diasConRegistro: number;
  diasConRegistroAnterior: number;
  racha: number; // semanas seguidas con al menos un registro
  enfoque?: string;
  registros: {
    fecha: string;
    dia: string;
    actividadId: string;
    actividad: string;
    area: string;
    minutos?: number;
    sensacion?: string;
    nota?: string;
  }[];
  metas: { actividadId: string; nombre: string; meta: number; dias: number }[]; // las de ESA semana
  diasUsandoApp: number; // < 7: empezó a usar la app a media semana
  logros: string[]; // balanceSemana: hechos ciertos que la IA puede usar
}

type Resultado = Pick<Revision, 'analisis' | 'sugerencias' | 'secciones'>;

/**
 * Lunes de la semana a revisar: el domingo desde las 18:00 ya se puede cerrar
 * la semana en curso; antes de eso, la anterior.
 */
export function semanaARevisar(ahora: Date): string {
  const offset = ahora.getDay() === 0 && ahora.getHours() >= 18 ? 0 : -1;
  return diasDeSemana(toIso(ahora), offset)[0];
}

const diasDistintos = (rs: { fecha: string }[]) =>
  new Set(rs.map(r => r.fecha)).size;

export function construirEntrada(
  datos: Datos,
  dias: string[],
  hoyIso = hoy(),
): EntradaRevision {
  const { areas, actividades, registros, enfoques } = datos;
  const metas = metasDeSemana(datos, dias[0], hoyIso); // las de ESA semana, también al rehacer una vieja
  const enSemana = registros
    .filter(r => dias.includes(r.fecha))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn - b.creadoEn);
  const previa = diasDeSemana(dias[0], -1);
  const enPrevia = registros.filter(r => previa.includes(r.fecha));
  const actividadDe = new Map(actividades.map(a => [a.id, a]));
  const nombreArea = new Map(areas.map(a => [a.id, a.nombre]));
  const areasActivas = new Map(areas.filter(a => a.activo).map(a => [a.id, a]));
  const sensaciones: Record<string, number> = {};
  for (const r of enSemana)
    if (r.sensacion)
      sensaciones[r.sensacion] = (sensaciones[r.sensacion] ?? 0) + 1;
  const primerRegistro = registros.reduce(
    (m, r) => (r.fecha < m ? r.fecha : m),
    '9999-12-31',
  );
  const balance = balanceSemana(registros, actividades, dias, dias[6], metas);

  return {
    actividades: actividades
      .filter(a => a.activo && areasActivas.has(a.areaId))
      .map(a => {
        const meta = metas.find(m => m.actividadId === a.id);
        return {
          id: a.id,
          nombre: a.nombre,
          area: areasActivas.get(a.areaId)!.nombre,
          veces: diasDistintos(enSemana.filter(r => r.actividadId === a.id)), // días, igual que el widget
          minutos: enSemana
            .filter(r => r.actividadId === a.id)
            .reduce((s, r) => s + (r.duracionMin ?? 0), 0),
          ...(meta ? { metaAnterior: meta.veces } : {}),
          vecesAnterior: diasDistintos(
            enPrevia.filter(r => r.actividadId === a.id),
          ),
        };
      }),
    sensaciones,
    diasConRegistro: diasDistintos(enSemana),
    diasConRegistroAnterior: diasDistintos(enPrevia),
    racha: balance.racha,
    ...(enfoques?.[dias[0]] ? { enfoque: enfoques[dias[0]] } : {}),
    registros: enSemana.slice(0, 80).flatMap(r => {
      const a = actividadDe.get(r.actividadId);
      if (!a) return [];
      const nota = r.nota?.trim().slice(0, 300);
      return [
        {
          fecha: r.fecha,
          dia: parseIso(r.fecha).toLocaleDateString('es-MX', {
            weekday: 'long',
          }),
          actividadId: a.id,
          actividad: a.nombre,
          area: nombreArea.get(a.areaId) ?? '',
          ...(r.duracionMin ? { minutos: r.duracionMin } : {}),
          ...(r.sensacion ? { sensacion: r.sensacion } : {}),
          ...(nota ? { nota } : {}),
        },
      ];
    }),
    metas: metas.flatMap(m => {
      const a = actividadDe.get(m.actividadId);
      return a
        ? [
            {
              actividadId: a.id,
              nombre: a.nombre,
              meta: m.veces,
              dias: diasDistintos(enSemana.filter(r => r.actividadId === a.id)),
            },
          ]
        : [];
    }),
    // Semana parcial: solo cuentan los días desde el primer registro histórico.
    diasUsandoApp: dias.filter(d => d >= primerRegistro).length,
    logros: balance.mensajes.map(m => m.texto),
  };
}

/** Estado de una meta en palabras, igual de honesto con o sin IA. */
export const estadoMeta = (m: { nombre: string; meta: number; dias: number }) =>
  m.dias >= m.meta
    ? `${m.nombre} se cumplió (${m.dias} de ${m.meta} días)`
    : m.dias
    ? `${m.nombre} quedó en ${m.dias} de ${m.meta} días`
    : `${m.nombre} no lo registramos esta semana`;

const juntar = (s: Secciones) =>
  [s.titular, ...s.destacado, s.metas, s.sentir, s.proxima]
    .filter(Boolean)
    .join('\n\n');

/** Respaldo sin IA: las mismas secciones con lo que se sabe seguro. Máximo 2 sugerencias. */
export function revisionPorReglas(entrada: EntradaRevision): Resultado {
  const totalSens = Object.values(entrada.sensaciones).reduce(
    (a, b) => a + b,
    0,
  );
  const cansado =
    totalSens >= 2 && (entrada.sensaciones.Cansado ?? 0) * 2 >= totalSens;
  const sugerencias: Sugerencia[] = [];
  const agregar = (s: Sugerencia) => {
    if (
      sugerencias.length < 2 &&
      !sugerencias.some(x => x.actividadId === s.actividadId)
    )
      sugerencias.push(s);
  };

  for (const a of entrada.actividades.filter(x => x.metaAnterior)) {
    const meta = a.metaAnterior!;
    if (a.veces >= meta && !cansado && meta < 7) {
      agregar({
        actividadId: a.id,
        veces: meta + 1,
        motivo: 'Lo lograste; un pasito más.',
      });
    } else if (a.veces >= meta) {
      agregar({
        actividadId: a.id,
        veces: meta,
        motivo: 'Mantener lo que ya haces está muy bien.',
      });
    } else {
      agregar({
        actividadId: a.id,
        veces: Math.max(1, a.veces),
        motivo: 'Partir de lo que sí lograste.',
      });
    }
  }
  const hechas = entrada.actividades
    .filter(a => a.veces > 0)
    .sort((a, b) => b.veces - a.veces);
  if (!sugerencias.length && hechas[0]) {
    agregar({
      actividadId: hechas[0].id,
      veces: hechas[0].veces,
      motivo: 'Mantener lo que ya haces.',
    });
  }
  const areasConAlgo = new Set(hechas.map(a => a.area));
  const descuidada = entrada.actividades.find(a => !areasConAlgo.has(a.area));
  if (descuidada && !cansado)
    agregar({
      actividadId: descuidada.id,
      veces: 1,
      motivo: 'Para retomarlo sin presión.',
    });

  const dias = `${entrada.diasConRegistro} ${
    entrada.diasConRegistro === 1 ? 'día' : 'días'
  }`;
  const parcial =
    entrada.diasUsandoApp < 7
      ? `Empezaste a registrar a media semana: ${dias} con algo para ti.`
      : '';
  const [
    titular = parcial || `Registraste algo ${dias} de la semana.`,
    ...resto
  ] = entrada.logros;
  // La nota más larga suele ser la del momento que más importó.
  const conNota = [...entrada.registros]
    .filter(r => r.nota)
    .sort((a, b) => b.nota!.length - a.nota!.length)[0];
  const cita = conNota
    ? `El ${conNota.dia}, en ${conNota.actividad.toLowerCase()}: «${
        conNota.nota!.length > 140
          ? `${conNota.nota!.slice(0, 140).trim()}…`
          : conNota.nota
      }»`
    : '';
  const [masSentida] = Object.entries(entrada.sensaciones).sort(
    (a, b) => b[1] - a[1],
  );
  const nombre = (id: string) =>
    entrada.actividades.find(a => a.id === id)?.nombre ?? '';
  const secciones: Secciones = {
    titular,
    destacado: [
      ...(parcial && titular !== parcial ? [parcial] : []),
      ...resto,
      cita,
    ]
      .filter(Boolean)
      .slice(0, 3),
    metas: entrada.metas.length
      ? `${entrada.metas.map(estadoMeta).join('; ')}.`
      : '',
    sentir: cansado
      ? 'Varios días te sentiste cansado; está bien ir con calma.'
      : masSentida
      ? `Lo que más sentiste: ${masSentida[0].toLowerCase()} (${veces(
          masSentida[1],
        )}).`
      : '',
    proxima: [
      descuidada && !cansado
        ? `${descuidada.area} quedó en pausa; un ratito cuenta.`
        : '',
      sugerencias[0]
        ? `Para la próxima: ${nombre(sugerencias[0].actividadId)}, ${veces(
            sugerencias[0].veces,
          )}. Veamos cómo nos va.`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
  return { analisis: juntar(secciones), sugerencias, secciones };
}

const esSecciones = (s: unknown): s is Secciones =>
  !!s &&
  typeof (s as Secciones).titular === 'string' &&
  Array.isArray((s as Secciones).destacado);

async function pedirIA(entrada: EntradaRevision): Promise<Resultado | null> {
  const config = await leerConfig();
  if (!config) return null;
  // El Worker puede tardar (modelo principal + respaldo): sin esto la app se queda colgada.
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 60_000);
  try {
    const res = await fetch(`${config.url}/revision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entrada),
      signal: control.signal,
    });
    if (!res.ok) return null;
    const r = (await res.json()) as Resultado;
    if (typeof r.analisis !== 'string' || !Array.isArray(r.sugerencias))
      return null;
    return {
      analisis: r.analisis,
      sugerencias: r.sugerencias,
      secciones: esSecciones(r.secciones) ? r.secciones : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(limite);
  }
}

let enCurso = false;

/** Lo que identifica los registros de la semana: cambia al agregar, borrar o mover uno. */
const huellaDe = (datos: Datos, dias: string[]) => {
  const enSemana = datos.registros.filter(r => dias.includes(r.fecha));
  return `${enSemana.length}:${Math.max(0, ...enSemana.map(r => r.creadoEn))}`;
};

/**
 * Crea la revisión de la semana cerrada si falta y hubo registros. Si sigue
 * pendiente y registraste algo de esa semana después (p. ej. el domingo en la
 * noche), la rehace. Nunca lanza.
 */
export async function generarRevisionSiFalta(
  ahora = new Date(),
): Promise<void> {
  if (enCurso || !useDataStore.persist.hasHydrated()) return;
  const semana = semanaARevisar(ahora);
  const datos = useDataStore.getState();
  const dias = diasDeSemana(semana);
  const huella = huellaDe(datos, dias);
  const previa = (datos.revisiones ?? []).find(r => r.semana === semana);
  if (previa && (previa.estado !== 'pendiente' || previa.huella === huella))
    return;
  const entrada = construirEntrada(datos, dias, toIso(ahora));
  if (!entrada.diasConRegistro) return; // semana vacía: nada que revisar, sin reproches

  enCurso = true;
  try {
    const ia = await pedirIA(entrada);
    if (!ia && previa?.fuente === 'ia') return; // sin red no cambiamos la de IA por reglas; se reintenta al volver
    useDataStore.getState().guardarRevision({
      semana,
      ...(ia ?? revisionPorReglas(entrada)),
      fuente: ia ? 'ia' : 'reglas',
      estado: 'pendiente',
      huella,
    });
  } finally {
    enCurso = false;
  }
}

/**
 * "Rehacer": vuelve a pedir a la IA el análisis de una semana ya revisada.
 * Solo cambia el texto; lo que ya elegiste (estado, metas aceptadas) se queda.
 * Si la IA falla devuelve false y no toca nada (no se cambia por reglas).
 */
export async function regenerarRevision(semana: string): Promise<boolean> {
  const dias = diasDeSemana(semana);
  const datos = useDataStore.getState();
  if (!datos.revisiones?.some(r => r.semana === semana)) return false;
  const ia = await pedirIA(construirEntrada(datos, dias));
  // Releer: mientras esperábamos pudiste aceptar o descartar la revisión.
  const actual = useDataStore
    .getState()
    .revisiones?.find(r => r.semana === semana);
  if (!ia || !actual) return false;
  useDataStore.getState().guardarRevision({
    ...actual,
    analisis: ia.analisis,
    secciones: ia.secciones,
    fuente: 'ia',
    ...(actual.estado === 'pendiente'
      ? { sugerencias: ia.sugerencias, huella: huellaDe(datos, dias) }
      : {}),
  });
  return true;
}
