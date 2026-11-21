import type { Actividad, Area, Registro } from '../stores/dataStore';
import { diasDeSemana, offsetSemanas, toIso } from './fechas';

const NUMEROS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

export const veces = (n: number) => `${NUMEROS[n] ?? n} ${n === 1 ? 'vez' : 'veces'}`;

const lista = (partes: string[]) =>
  partes.length < 2 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;

const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export interface ResumenActividad {
  actividad: Actividad;
  veces: number;
  minutos: number;
}

export interface ResumenArea {
  area: Area;
  veces: number;
  actividades: ResumenActividad[];
}

/** Resumen descriptivo de los registros dentro de `dias`. Sin metas ni porcentajes: solo lo que hubo. */
export function resumenSemana(registros: Registro[], actividades: Actividad[], areas: Area[], dias: string[]) {
  const enSemana = registros.filter((r) => dias.includes(r.fecha));
  const porActividad = new Map<string, ResumenActividad>();
  for (const r of enSemana) {
    const actividad = actividades.find((a) => a.id === r.actividadId);
    if (!actividad) continue;
    const item = porActividad.get(actividad.id) ?? { actividad, veces: 0, minutos: 0 };
    item.veces += 1;
    item.minutos += r.duracionMin ?? 0;
    porActividad.set(actividad.id, item);
  }
  const items = [...porActividad.values()].sort((a, b) => b.veces - a.veces);

  const porArea: ResumenArea[] = [...areas]
    .sort((a, b) => a.orden - b.orden)
    .map((area) => {
      const acts = items.filter((i) => i.actividad.areaId === area.id);
      return { area, veces: acts.reduce((s, i) => s + i.veces, 0), actividades: acts };
    })
    .filter((a) => a.veces > 0);

  const MAX = 4;
  const partes = items.slice(0, MAX).map((i) => `${minuscula(i.actividad.nombre)} ${veces(i.veces)}`);
  if (items.length > MAX) partes.push(`${items.length - MAX} actividad${items.length - MAX > 1 ? 'es' : ''} más`);
  const frase = items.length ? `Registraste ${lista(partes)}.` : 'No hay registros esta semana.';

  const porDia = Object.fromEntries(dias.map((d) => [d, enSemana.filter((r) => r.fecha === d)]));
  return { porDia, porArea, frase, total: enSemana.length };
}

export interface Mensaje {
  tipo: 'logro' | 'aviso'; // aviso = algo bajó; se dice con calma y con invitación, nunca como reproche
  texto: string;
}

const nDias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;
const diasCon = (registros: Registro[], dias: string[], actividadId?: string) =>
  new Set(
    registros
      .filter(r => dias.includes(r.fecha) && (!actividadId || r.actividadId === actividadId))
      .map(r => r.fecha),
  ).size;

/** Compara días con registro: sube = logro, baja = aviso amable. */
function comparar(actual: number, antes: number, periodo: string, enCurso: boolean): Mensaje | null {
  if (actual > antes && antes > 0)
    return { tipo: 'logro', texto: `Te diste tiempo ${nDias(actual - antes)} más que ${periodo}.` };
  if (actual < antes)
    return {
      tipo: 'aviso',
      texto: enCurso
        ? `Llevas ${nDias(actual)} con registro; ${periodo} a estas alturas ibas en ${antes}. Todavía hay tiempo para retomar.`
        : `${actual === 1 ? "Fue" : "Fueron"} ${nDias(actual)} con registro, frente a ${antes} ${periodo}. Lo que viene es buen momento para retomar.`,
    };
  return null;
}

/**
 * Lo que motiva de la semana `dias`: comparación con la anterior (mismos días transcurridos,
 * para no comparar una semana a medias con una completa), metas, constancia y lo retomado.
 */
export function balanceSemana(registros: Registro[], actividades: Actividad[], dias: string[], hoyIso: string) {
  const n = dias.filter(d => d <= hoyIso).length;
  const enCurso = n < 7;
  const actual = dias.slice(0, n);
  const semanaAtras = (k: number) => diasDeSemana(dias[0], -k);
  const logros: Mensaje[] = [];
  const avisos: Mensaje[] = [];

  // Metas: días distintos, igual que el widget y la revisión.
  const metas: Record<string, { dias: number; meta: number }> = {};
  for (const a of actividades)
    if (a.activo && a.metaSemanal) metas[a.id] = { dias: diasCon(registros, dias, a.id), meta: a.metaSemanal };
  const conMeta = Object.values(metas);
  const cumplidas = conMeta.filter(m => m.dias >= m.meta).length;
  if (cumplidas)
    logros.push({
      tipo: 'logro',
      texto:
        cumplidas === conMeta.length
          ? `Cumpliste ${cumplidas === 1 ? 'tu meta' : `tus ${cumplidas} metas`} de la semana.`
          : `Cumpliste ${cumplidas} de ${conMeta.length} metas.`,
    });

  const diasAct = diasCon(registros, actual);
  const previas = [1, 2, 3, 4].map(k => diasCon(registros, semanaAtras(k)));
  if (diasAct >= 2 && previas.every(p => diasAct > p))
    logros.push({ tipo: 'logro', texto: 'Tu semana más constante del último mes.' });
  else if (n) {
    const c = comparar(diasAct, diasCon(registros, semanaAtras(1).slice(0, n)), 'la semana pasada', enCurso);
    if (c) (c.tipo === 'logro' ? logros : avisos).push(c);
  }

  // Constancia en semanas, no en días: un día malo no rompe nada.
  let racha = diasAct ? 1 : 0;
  if (diasAct || enCurso) for (let k = 1; diasCon(registros, semanaAtras(k)) > 0; k++) racha++;
  if (racha >= 2) logros.push({ tipo: 'logro', texto: `Llevas ${racha} semanas seguidas cuidándote.` });

  for (const a of actividades) {
    if (!diasCon(registros, actual, a.id)) {
      const antes = diasCon(registros, semanaAtras(1), a.id);
      if (antes >= 2 && !avisos.length)
        avisos.push({
          tipo: 'aviso',
          texto: `${a.nombre} quedó en pausa (la semana pasada fueron ${nDias(antes)}); ${
            enCurso ? 'aún puedes darle un ratito.' : 'un ratito la próxima cuenta.'
          }`,
        });
      continue;
    }
    const ultima = registros
      .filter(r => r.actividadId === a.id && r.fecha < dias[0])
      .reduce<string | undefined>((m, r) => (!m || r.fecha > m ? r.fecha : m), undefined);
    const semanas = ultima ? -offsetSemanas(ultima, dias[0]) : 0;
    if (semanas >= 3) logros.push({ tipo: 'logro', texto: `Volviste a ${minuscula(a.nombre)} después de ${semanas} semanas.` });
  }

  return { mensajes: [...logros.slice(0, 3), ...avisos.slice(0, 1)], metas, racha, diasConRegistro: diasAct };
}

/** Lo mismo para un mes: comparación con el anterior (mismos días), lo más constante y lo nuevo. */
export function balanceMes(registros: Registro[], actividades: Actividad[], anio: number, mes: number, hoyIso: string) {
  const delMes = (a: number, m: number, hasta: number) =>
    Array.from({ length: hasta }, (_, i) => toIso(new Date(a, m, i + 1)));
  const total = new Date(anio, mes + 1, 0).getDate();
  const dias = delMes(anio, mes, total).filter(d => d <= hoyIso);
  const enCurso = dias.length < total;
  const previo = new Date(anio, mes - 1, 1);
  const totalPrevio = new Date(anio, mes, 0).getDate();
  const diasPrevio = delMes(previo.getFullYear(), previo.getMonth(), Math.min(dias.length, totalPrevio));
  const logros: Mensaje[] = [];
  const avisos: Mensaje[] = [];

  const constantes = actividades
    .map(a => ({ a, n: diasCon(registros, dias, a.id) }))
    .filter(x => x.n >= 2)
    .sort((x, y) => y.n - x.n);
  if (constantes[0])
    logros.push({ tipo: 'logro', texto: `Lo más constante: ${minuscula(constantes[0].a.nombre)}, ${nDias(constantes[0].n)}.` });

  const c = comparar(diasCon(registros, dias), diasCon(registros, diasPrevio), 'el mes pasado', enCurso);
  if (c) (c.tipo === 'logro' ? logros : avisos).push(c);

  const nuevas = actividades.filter(
    a => diasCon(registros, dias, a.id) && !registros.some(r => r.actividadId === a.id && r.fecha < dias[0]),
  );
  if (nuevas.length && registros.some(r => r.fecha < dias[0])) // si todo es nuevo (primer mes), no cuenta
    logros.push({ tipo: 'logro', texto: `Probaste algo nuevo: ${lista(nuevas.slice(0, 3).map(a => minuscula(a.nombre)))}.` });

  return { mensajes: [...logros, ...avisos.slice(0, 1)] };
}
