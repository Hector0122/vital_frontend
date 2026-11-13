import type { Actividad, Area, Registro } from '../stores/dataStore';

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
