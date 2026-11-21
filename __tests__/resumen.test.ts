import { datosIniciales, type Registro } from '../src/stores/dataStore';
import { diasDeSemana } from '../src/utils/fechas';
import { balanceMes, balanceSemana, resumenSemana, veces } from '../src/utils/resumen';
import { frecuentes } from '../src/utils/catalogo';

const { areas, actividades } = datosIniciales();
const dias = diasDeSemana('2026-11-13');
const reg = (
  actividadId: string,
  fecha: string,
  duracionMin?: number,
): Registro => ({
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
    [
      reg('a2-0', '2026-11-10'),
      reg('a0-0', '2026-11-09', 30),
      reg('a0-0', '2026-11-12', 45),
      reg('a0-0', '2026-11-01'),
    ],
    actividades,
    areas,
    dias,
  );
  expect(r.frase).toBe('Registraste ejercicio dos veces y lectura una vez.');
  expect(r.total).toBe(3); // el del día 1 es de otra semana
  expect(r.porArea.map(a => a.area.nombre)).toEqual([
    'Bienestar',
    'Crecimiento',
  ]);
  expect(r.porArea[0].actividades[0].minutos).toBe(75);
  expect(r.porDia['2026-11-11']).toEqual([]);
});

test('semana vacía no habla de fallos', () => {
  expect(resumenSemana([], actividades, areas, dias).frase).toBe(
    'No hay registros esta semana.',
  );
});

test('más de 4 actividades se resumen', () => {
  const ids = ['a0-0', 'a0-1', 'a1-0', 'a2-0', 'a3-0', 'a4-0'];
  const r = resumenSemana(
    ids.map(id => reg(id, '2026-11-13')),
    actividades,
    areas,
    dias,
  );
  expect(r.frase).toMatch(/ y 2 actividades más\.$/);
});

test('frecuentes: las más registradas primero, sin inactivas ni nunca usadas', () => {
  const acts = datosIniciales().actividades;
  acts.find(a => a.id === 'a1-0')!.activo = false;
  const regs = [
    reg('a2-0', '2026-11-10'),
    reg('a0-0', '2026-11-09'),
    reg('a0-0', '2026-11-12'),
    reg('a1-0', '2026-11-12'),
  ];
  expect(frecuentes(regs, acts).map(a => a.id)).toEqual(['a0-0', 'a2-0']);
  expect(frecuentes([], acts)).toEqual([]);
});

describe('balanceSemana', () => {
  // dias = semana del 9 al 15 nov 2026; la anterior, 2 al 8.
  test('celebra metas, racha y lo retomado', () => {
    const acts = datosIniciales().actividades;
    acts.find(a => a.id === 'a0-0')!.metaSemanal = 2;
    const r = balanceSemana(
      [
        reg('a2-0', '2026-10-01'), // lectura hace semanas
        reg('a0-0', '2026-11-02'),
        reg('a0-0', '2026-11-09'),
        reg('a0-0', '2026-11-11'),
        reg('a2-0', '2026-11-12'),
      ],
      acts,
      dias,
      '2026-11-15',
    );
    expect(r.metas['a0-0']).toEqual({ dias: 2, meta: 2 });
    expect(r.racha).toBe(2);
    expect(r.mensajes.map(m => m.texto)).toEqual([
      'Cumpliste tu meta de la semana.',
      'Tu semana más constante del último mes.',
      'Llevas 2 semanas seguidas cuidándote.',
    ]);
  });

  test('si bajó, lo dice con calma y una sola vez', () => {
    const r = balanceSemana(
      [
        reg('a0-0', '2026-11-03'),
        reg('a0-0', '2026-11-05'),
        reg('a0-0', '2026-11-07'),
        reg('a2-0', '2026-11-10'),
      ],
      actividades,
      dias,
      '2026-11-15',
    );
    const avisos = r.mensajes.filter(m => m.tipo === 'aviso');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].texto).toBe(
      'Fue 1 día con registro, frente a 3 la semana pasada. Lo que viene es buen momento para retomar.',
    );
    expect(avisos[0].texto).not.toMatch(/fallaste|deberías|no cumpliste/i);
  });

  test('semana en curso: compara solo los días transcurridos', () => {
    const r = balanceSemana(
      [reg('a0-0', '2026-11-03'), reg('a0-0', '2026-11-06'), reg('a0-0', '2026-11-10')],
      actividades,
      dias,
      '2026-11-11', // miércoles: contra lun–mié de la anterior (1 día) → sin aviso
    );
    expect(r.mensajes.some(m => m.tipo === 'aviso')).toBe(false);
  });
});

test('balanceMes: lo más constante, comparación y lo nuevo', () => {
  const r = balanceMes(
    [
      reg('a0-0', '2026-10-03'),
      reg('a0-0', '2026-11-02'),
      reg('a0-0', '2026-11-04'),
      reg('a2-0', '2026-11-05'),
    ],
    actividades,
    2026,
    10,
    '2026-11-30',
  );
  expect(r.mensajes.map(m => m.texto)).toEqual([
    'Lo más constante: ejercicio, 2 días.',
    'Te diste tiempo 2 días más que el mes pasado.',
    'Probaste algo nuevo: lectura.',
  ]);
});
