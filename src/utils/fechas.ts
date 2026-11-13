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
