import {
  datosIniciales,
  useDataStore,
  type Registro,
} from '../src/stores/dataStore';
import { modeloRapido, modeloWidget } from '../src/widget/modelo';

const reg = (
  actividadId: string,
  fecha: string,
  extra: Partial<Registro> = {},
): Registro => ({
  id: Math.random().toString(),
  actividadId,
  fecha,
  creadoEn: 0,
  ...extra,
});

test('solo actividades con meta, con días hechos, hoy y futuros', () => {
  const datos = datosIniciales();
  datos.actividades.find(a => a.id === 'a0-0')!.metaSemanal = 3;
  datos.registros = [
    reg('a0-0', '2026-11-09'),
    reg('a0-0', '2026-11-09'),
    reg('a0-0', '2026-11-11', { nota: 'x' }),
  ];
  const [meta, ...resto] = modeloWidget(datos, '2026-11-13');
  expect(resto).toEqual([]);
  expect(meta.nombre).toBe('Ejercicio');
  expect(meta.hechos).toBe(2); // dos registros el lunes cuentan como un día
  expect(meta.dias.map(d => d.hecho)).toEqual([
    true,
    false,
    true,
    false,
    false,
    false,
    false,
  ]);
  expect(meta.dias[4]).toMatchObject({
    esHoy: true,
    futuro: false,
    numero: 13,
  });
  expect(meta.dias[5].futuro).toBe(true);
  expect(meta.dias[2].conDetalle).toBe(true);
  expect(meta.dias[0].conDetalle).toBe(false);
});

test('alternarDia marca y desmarca, pero nunca borra un registro con detalles', () => {
  const { alternarDia } = useDataStore.getState();
  const delDia = () =>
    useDataStore
      .getState()
      .registros.filter(
        r => r.actividadId === 'a2-0' && r.fecha === '2026-11-10',
      );

  alternarDia('a2-0', '2026-11-10');
  expect(delDia()).toHaveLength(1);
  alternarDia('a2-0', '2026-11-10');
  expect(delDia()).toHaveLength(0);

  useDataStore
    .getState()
    .agregarRegistros(['a2-0'], { fecha: '2026-11-10', nota: 'capítulo 3' });
  alternarDia('a2-0', '2026-11-10');
  expect(delDia()).toHaveLength(1);
  expect(delDia()[0].nota).toBe('capítulo 3');
});

test('registro rápido: frecuentes primero, completa hasta 6 y marca lo de hoy', () => {
  const datos = datosIniciales();
  datos.registros = [
    reg('a2-0', '2026-11-10'),
    reg('a2-0', '2026-11-11'),
    reg('a1-1', '2026-11-13'),
  ];
  const botones = modeloRapido(datos, '2026-11-13');
  expect(botones).toHaveLength(6);
  expect(botones.slice(0, 2).map(b => b.actividadId)).toEqual(['a2-0', 'a1-1']);
  expect(botones.find(b => b.actividadId === 'a1-1')!.hechoHoy).toBe(true);
  expect(botones.find(b => b.actividadId === 'a2-0')!.hechoHoy).toBe(false);
});
