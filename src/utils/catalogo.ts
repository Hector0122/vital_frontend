import type { Actividad, Area } from '../stores/dataStore';

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
