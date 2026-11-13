import { datosIniciales, type Registro } from '../src/stores/dataStore';
import { diasDeSemana } from '../src/utils/fechas';
import { resumenSemana, veces } from '../src/utils/resumen';
import { frecuentes } from '../src/utils/catalogo';

const { areas, actividades } = datosIniciales();
const dias = diasDeSemana('2026-11-13');
const reg = (actividadId: string, fecha: string, duracionMin?: number): Registro => ({
  id: Math.random().toString(),
  actividadId,
  fecha,
  duracionMin,
  creadoEn: 0,
});

test('plurales en palabras', () => {
  expect(veces(1)).toBe('una vez');
  expect(veces(2)).toBe('dos veces');
  expect(veces(12)).toBe('12 veces');
});

test('frase descriptiva con lo que hubo, ordenada por frecuencia', () => {
  const r = resumenSemana(
    [reg('a2-0', '2026-11-10'), reg('a0-0', '2026-11-09', 30), reg('a0-0', '2026-11-12', 45), reg('a0-0', '2026-11-01')],
    actividades,
    areas,
    dias,
  );
  expect(r.frase).toBe('Registraste ejercicio dos veces y lectura una vez.');
  expect(r.total).toBe(3); // el del día 1 es de otra semana
  expect(r.porArea.map((a) => a.area.nombre)).toEqual(['Bienestar', 'Crecimiento']);
  expect(r.porArea[0].actividades[0].minutos).toBe(75);
  expect(r.porDia['2026-11-11']).toEqual([]);
});

test('semana vacía no habla de fallos', () => {
  expect(resumenSemana([], actividades, areas, dias).frase).toBe('No hay registros esta semana.');
});

test('más de 4 actividades se resumen', () => {
  const ids = ['a0-0', 'a0-1', 'a1-0', 'a2-0', 'a3-0', 'a4-0'];
  const r = resumenSemana(ids.map((id) => reg(id, '2026-11-13')), actividades, areas, dias);
  expect(r.frase).toMatch(/ y 2 actividades más\.$/);
});

test('frecuentes: las más registradas primero, sin inactivas ni nunca usadas', () => {
  const acts = datosIniciales().actividades;
  acts.find((a) => a.id === 'a1-0')!.activo = false;
  const regs = [reg('a2-0', '2026-11-10'), reg('a0-0', '2026-11-09'), reg('a0-0', '2026-11-12'), reg('a1-0', '2026-11-12')];
  expect(frecuentes(regs, acts).map((a) => a.id)).toEqual(['a0-0', 'a2-0']);
  expect(frecuentes([], acts)).toEqual([]);
});
