/** Fechas locales como 'YYYY-MM-DD' — nunca toISOString(), que usa UTC y cambia de día de noche. */

export function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const hoy = () => toIso(new Date());

/** Los 7 días (lunes a domingo) de la semana que contiene `fecha`, desplazada `offset` semanas. */
export function diasDeSemana(fecha: string, offset = 0): string[] {
  const d = parseIso(fecha);
  const lunes = d.getDate() - ((d.getDay() + 6) % 7) + offset * 7;
  return Array.from({ length: 7 }, (_, i) => toIso(new Date(d.getFullYear(), d.getMonth(), lunes + i)));
}

export function formatFecha(fecha: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }): string {
  if (fecha === hoy()) return 'Hoy';
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  if (fecha === toIso(ayer)) return 'Ayer';
  return parseIso(fecha).toLocaleDateString('es-MX', opts);
}

/** Celdas de un mes para una cuadrícula lunes–domingo: null = hueco antes del día 1. */
export function celdasDelMes(anio: number, mes: number): (string | null)[] {
  const primero = new Date(anio, mes, 1);
  const huecos = (primero.getDay() + 6) % 7;
  const total = new Date(anio, mes + 1, 0).getDate();
  return [
    ...Array<null>(huecos).fill(null),
    ...Array.from({ length: total }, (_, i) => toIso(new Date(anio, mes, i + 1))),
  ];
}

/** Cuántas semanas hay entre la semana de `fecha` y la de `hoy` (negativo = pasado). */
export function offsetSemanas(fecha: string, hoyIso: string): number {
  const a = parseIso(diasDeSemana(fecha)[0]).getTime();
  const b = parseIso(diasDeSemana(hoyIso)[0]).getTime();
  return Math.round((a - b) / (7 * 24 * 3600 * 1000));
}
