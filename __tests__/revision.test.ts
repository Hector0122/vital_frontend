import { datosIniciales, useDataStore, type Registro } from '../src/stores/dataStore';
import { construirEntrada, revisionPorReglas, semanaARevisar } from '../src/services/revision';
import { diasDeSemana } from '../src/utils/fechas';

const reg = (actividadId: string, fecha: string, extra: Partial<Registro> = {}): Registro => ({
  id: Math.random().toString(),
  actividadId,
  fecha,
  creadoEn: 0,
  ...extra,
});
const dias = diasDeSemana('2026-11-09');

test('semana a revisar: domingo desde las 18h cierra la actual; si no, la anterior', () => {
  expect(semanaARevisar(new Date(2026, 10, 15, 19))).toBe('2026-11-09'); // domingo noche
  expect(semanaARevisar(new Date(2026, 10, 15, 10))).toBe('2026-11-02'); // domingo mañana
  expect(semanaARevisar(new Date(2026, 10, 16, 8))).toBe('2026-11-09'); // lunes
});

test('la entrada no lleva notas y cuenta días distintos', () => {
  const datos = datosIniciales();
  datos.registros = [
    reg('a0-0', '2026-11-09', { nota: 'secreto', sensacion: 'Cansado' }),
    reg('a0-0', '2026-11-09', { duracionMin: 30 }),
  ];
  const e = construirEntrada(datos, dias);
  expect(JSON.stringify(e)).not.toContain('secreto');
  expect(e.actividades.find((a) => a.id === 'a0-0')).toMatchObject({ veces: 1, minutos: 30 });
  expect(e.sensaciones).toEqual({ Cansado: 1 });
  expect(e.diasConRegistro).toBe(1);
});

test('reglas: sube de a uno si cumplió, baja a lo logrado si no, y retoma lo descuidado', () => {
  const datos = datosIniciales();
  datos.actividades.find((a) => a.id === 'a0-0')!.metaSemanal = 2; // Ejercicio
  datos.actividades.find((a) => a.id === 'a2-0')!.metaSemanal = 3; // Lectura
  datos.registros = [reg('a0-0', '2026-11-09'), reg('a0-0', '2026-11-11'), reg('a2-0', '2026-11-10')];
  const r = revisionPorReglas(construirEntrada(datos, dias), 'Frase.');
  expect(r.sugerencias).toEqual([
    { actividadId: 'a0-0', veces: 3, motivo: expect.any(String) },
    { actividadId: 'a2-0', veces: 1, motivo: expect.any(String) },
  ]);
  expect(r.analisis).toMatch(/^Frase\./);
});

test('reglas: con cansancio no sube nada', () => {
  const datos = datosIniciales();
  datos.actividades.find((a) => a.id === 'a0-0')!.metaSemanal = 2;
  datos.registros = [
    reg('a0-0', '2026-11-09', { sensacion: 'Cansado' }),
    reg('a0-0', '2026-11-11', { sensacion: 'Cansado' }),
  ];
  const r = revisionPorReglas(construirEntrada(datos, dias), '');
  expect(r.sugerencias).toEqual([{ actividadId: 'a0-0', veces: 2, motivo: expect.any(String) }]);
  expect(r.analisis).toContain('cansado');
});

test('aplicar revisión: las aceptadas son las nuevas metas y las demás se quitan', () => {
  const s = useDataStore.getState();
  s.guardarActividad({ ...s.actividades.find((a) => a.id === 'a1-0')!, metaSemanal: 5 });
  s.guardarRevision({ semana: '2026-11-09', analisis: 'x', sugerencias: [], fuente: 'reglas', estado: 'pendiente' });
  useDataStore.getState().aplicarRevision('2026-11-09', [{ actividadId: 'a0-0', veces: 3 }]);
  const st = useDataStore.getState();
  expect(st.actividades.find((a) => a.id === 'a0-0')!.metaSemanal).toBe(3);
  expect(st.actividades.find((a) => a.id === 'a1-0')!.metaSemanal).toBeUndefined();
  expect(st.revisiones![0].estado).toBe('aplicada');
});
