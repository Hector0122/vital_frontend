import type { Actividad, Area, Registro } from '../stores/dataStore';

export const SENSACIONES: [string, string][] = [
  ['Tranquilo', 'weather-sunset'],
  ['Con energía', 'lightning-bolt-outline'],
  ['Contento', 'emoticon-happy-outline'],
  ['Cansado', 'battery-low'],
  ['Neutral', 'circle-outline'],
];

export const DURACIONES = [15, 30, 60, 90];

export const formatDuracion = (min: number) =>
  min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}`;

/** Áreas activas en orden, cada una con sus actividades activas. */
export function areasConActividades(areas: Area[], actividades: Actividad[]) {
  return [...areas]
    .filter((a) => a.activo)
    .sort((a, b) => a.orden - b.orden)
    .map((area) => ({ area, actividades: actividades.filter((x) => x.areaId === area.id && x.activo) }));
}

/** Actividades activas más registradas, de más a menos. Vacío si aún no hay registros. */
export function frecuentes(registros: Registro[], actividades: Actividad[], n = 6): Actividad[] {
  const cuenta = new Map<string, number>();
  for (const r of registros) cuenta.set(r.actividadId, (cuenta.get(r.actividadId) ?? 0) + 1);
  return actividades
    .filter((a) => a.activo && cuenta.has(a.id))
    .sort((a, b) => cuenta.get(b.id)! - cuenta.get(a.id)!)
    .slice(0, n);
}
