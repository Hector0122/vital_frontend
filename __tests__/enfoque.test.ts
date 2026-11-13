import { datosIniciales, type Registro } from '../src/stores/dataStore';
import {
  construirEntradaEnfoque,
  enfoquePorReglas,
} from '../src/services/enfoque';

const reg = (actividadId: string, fecha: string): Registro => ({
  id: Math.random().toString(),
  actividadId,
  fecha,
  creadoEn: 0,
});

test('entrada: días restantes y veces de esta semana, sin notas', () => {
  const datos = datosIniciales();
  datos.registros = [{ ...reg('a1-1', '2026-11-10'), nota: 'privado' }];
  const e = construirEntradaEnfoque(datos, ' quiero dibujar ', '2026-11-13'); // viernes
  expect(e.texto).toBe('quiero dibujar');
  expect(e.diasRestantes).toBe(3);
  expect(e.actividades.find(a => a.id === 'a1-1')!.vecesEstaSemana).toBe(1);
  expect(JSON.stringify(e)).not.toContain('privado');
});

test('reglas: encuentra la actividad aunque cambie el acento y respeta lo que cabe en la semana', () => {
  const datos = datosIniciales();
  datos.actividades.find(a => a.id === 'a0-0')!.metaSemanal = 3;
  const e = construirEntradaEnfoque(
    datos,
    'Esta semana quiero más DIBUJO',
    '2026-11-15',
  ); // domingo: queda 1 día
  const p = enfoquePorReglas(e);
  expect(p.metas[0]).toMatchObject({ actividadId: 'a1-1', veces: 1 });
  expect(p.metas[1]).toMatchObject({ actividadId: 'a0-0', veces: 3 });
});

test('reglas: si no encuentra nada, conserva las metas y lo dice', () => {
  const datos = datosIniciales();
  datos.actividades.find(a => a.id === 'a0-0')!.metaSemanal = 2;
  const p = enfoquePorReglas(
    construirEntradaEnfoque(datos, 'paracaidismo', '2026-11-10'),
  );
  expect(p.mensaje).toMatch(/No encontré/);
  expect(p.metas).toEqual([
    { actividadId: 'a0-0', veces: 2, motivo: expect.any(String) },
  ]);
});
