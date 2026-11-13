import { useDataStore, type Datos, type Revision, type Sugerencia } from '../stores/dataStore';
import { diasDeSemana, toIso } from '../utils/fechas';
import { resumenSemana, veces } from '../utils/resumen';
import { leerConfig } from './nube';

/** Lo que se manda a la IA (cloud-worker/src/revision.ts): conteos y sensaciones, nunca notas ni fotos. */
export interface EntradaRevision {
  actividades: { id: string; nombre: string; area: string; veces: number; minutos: number; metaAnterior?: number }[];
  sensaciones: Record<string, number>;
  diasConRegistro: number;
}

/**
 * Lunes de la semana a revisar: el domingo desde las 18:00 ya se puede cerrar
 * la semana en curso; antes de eso, la anterior.
 */
export function semanaARevisar(ahora: Date): string {
  const offset = ahora.getDay() === 0 && ahora.getHours() >= 18 ? 0 : -1;
  return diasDeSemana(toIso(ahora), offset)[0];
}

export function construirEntrada({ areas, actividades, registros }: Datos, dias: string[]): EntradaRevision {
  const enSemana = registros.filter((r) => dias.includes(r.fecha));
  const areasActivas = new Map(areas.filter((a) => a.activo).map((a) => [a.id, a]));
  const sensaciones: Record<string, number> = {};
  for (const r of enSemana) if (r.sensacion) sensaciones[r.sensacion] = (sensaciones[r.sensacion] ?? 0) + 1;
  return {
    actividades: actividades
      .filter((a) => a.activo && areasActivas.has(a.areaId))
      .map((a) => {
        const propios = enSemana.filter((r) => r.actividadId === a.id);
        return {
          id: a.id,
          nombre: a.nombre,
          area: areasActivas.get(a.areaId)!.nombre,
          veces: new Set(propios.map((r) => r.fecha)).size, // días distintos, igual que el widget
          minutos: propios.reduce((s, r) => s + (r.duracionMin ?? 0), 0),
          ...(a.metaSemanal ? { metaAnterior: a.metaSemanal } : {}),
        };
      }),
    sensaciones,
    diasConRegistro: new Set(enSemana.map((r) => r.fecha)).size,
  };
}

/** Respaldo sin IA: de a poco, sin presión. Máximo 2 sugerencias. */
export function revisionPorReglas(entrada: EntradaRevision, frase: string): Pick<Revision, 'analisis' | 'sugerencias'> {
  const totalSens = Object.values(entrada.sensaciones).reduce((a, b) => a + b, 0);
  const cansado = totalSens >= 2 && (entrada.sensaciones.Cansado ?? 0) * 2 >= totalSens;
  const sugerencias: Sugerencia[] = [];
  const agregar = (s: Sugerencia) => {
    if (sugerencias.length < 2 && !sugerencias.some((x) => x.actividadId === s.actividadId)) sugerencias.push(s);
  };

  for (const a of entrada.actividades.filter((x) => x.metaAnterior)) {
    const meta = a.metaAnterior!;
    if (a.veces >= meta && !cansado && meta < 7) {
      agregar({ actividadId: a.id, veces: meta + 1, motivo: 'Lo lograste; un pasito más.' });
    } else if (a.veces >= meta) {
      agregar({ actividadId: a.id, veces: meta, motivo: 'Mantener lo que ya haces está muy bien.' });
    } else {
      agregar({ actividadId: a.id, veces: Math.max(1, a.veces), motivo: 'Partir de lo que sí lograste.' });
    }
  }
  const hechas = entrada.actividades.filter((a) => a.veces > 0).sort((a, b) => b.veces - a.veces);
  if (!sugerencias.length && hechas[0]) {
    agregar({ actividadId: hechas[0].id, veces: hechas[0].veces, motivo: 'Mantener lo que ya haces.' });
  }
  const areasConAlgo = new Set(hechas.map((a) => a.area));
  const descuidada = entrada.actividades.find((a) => !areasConAlgo.has(a.area));
  if (descuidada && !cansado) agregar({ actividadId: descuidada.id, veces: 1, motivo: 'Para retomarlo sin presión.' });

  const extras = [
    descuidada && `${descuidada.area} quedó en pausa esta semana.`,
    cansado && 'Varios días te sentiste cansado; está bien ir con calma.',
    entrada.diasConRegistro && `Registraste algo ${veces(entrada.diasConRegistro).replace('vez', 'día').replace('veces', 'días')}.`,
  ].filter(Boolean);
  return { analisis: [frase, ...extras].join(' '), sugerencias };
}

async function pedirIA(entrada: EntradaRevision): Promise<Pick<Revision, 'analisis' | 'sugerencias'> | null> {
  const config = await leerConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.url}/revision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(entrada),
    });
    if (!res.ok) return null;
    const r = (await res.json()) as Pick<Revision, 'analisis' | 'sugerencias'>;
    return typeof r.analisis === 'string' && Array.isArray(r.sugerencias) ? r : null;
  } catch {
    return null;
  }
}

let enCurso = false;

/** Crea la revisión de la semana cerrada si falta y hubo registros. Nunca lanza. */
export async function generarRevisionSiFalta(ahora = new Date()): Promise<void> {
  if (enCurso || !useDataStore.persist.hasHydrated()) return;
  const semana = semanaARevisar(ahora);
  const datos = useDataStore.getState();
  if ((datos.revisiones ?? []).some((r) => r.semana === semana)) return;
  const dias = diasDeSemana(semana);
  const entrada = construirEntrada(datos, dias);
  if (!entrada.diasConRegistro) return; // semana vacía: nada que revisar, sin reproches

  enCurso = true;
  try {
    const ia = await pedirIA(entrada);
    const base = ia ?? revisionPorReglas(entrada, resumenSemana(datos.registros, datos.actividades, datos.areas, dias).frase);
    useDataStore.getState().guardarRevision({ semana, ...base, fuente: ia ? 'ia' : 'reglas', estado: 'pendiente' });
  } finally {
    enCurso = false;
  }
}
