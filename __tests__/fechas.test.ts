import {
  celdasDelMes,
  diasDeSemana,
  offsetSemanas,
  parseIso,
  toIso,
} from '../src/utils/fechas';

test('toIso usa la fecha local, no UTC', () => {
  expect(toIso(new Date(2026, 10, 13, 23, 59))).toBe('2026-11-13');
  expect(toIso(parseIso('2026-01-05'))).toBe('2026-01-05');
});

test('diasDeSemana va de lunes a domingo', () => {
  // 2026-11-13 es viernes
  expect(diasDeSemana('2026-11-13')).toEqual([
    '2026-11-09',
    '2026-11-10',
    '2026-11-11',
    '2026-11-12',
    '2026-11-13',
    '2026-11-14',
    '2026-11-15',
  ]);
  expect(diasDeSemana('2026-11-15')[0]).toBe('2026-11-09'); // domingo pertenece a la misma semana
  expect(diasDeSemana('2026-11-13', -1)[0]).toBe('2026-11-02');
  expect(diasDeSemana('2026-12-31')).toContain('2027-01-03'); // cruza de año
});

test('celdasDelMes alinea el día 1 con su día de la semana', () => {
  const nov = celdasDelMes(2026, 10); // noviembre 2026 empieza en domingo
  expect(nov.slice(0, 7)).toEqual([
    null,
    null,
    null,
    null,
    null,
    null,
    '2026-11-01',
  ]);
  expect(nov.filter(Boolean)).toHaveLength(30);
});

test('offsetSemanas cuenta semanas hacia atrás, también cruzando el horario de verano', () => {
  expect(offsetSemanas('2026-11-13', '2026-11-13')).toBe(0);
  expect(offsetSemanas('2026-11-01', '2026-11-13')).toBe(-2);
  expect(offsetSemanas('2026-03-01', '2026-04-15')).toBe(-7);
});
