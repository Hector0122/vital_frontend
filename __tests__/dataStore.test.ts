import { fotosEnUso, useDataStore } from '../src/stores/dataStore';
import { armarRespaldo, leerRespaldo } from '../src/services/backup';

test('registrar varias, editar y borrar', () => {
  const s = useDataStore.getState();
  s.agregarRegistros(['a0-0', 'a2-0'], { fecha: '2026-11-13', fotos: ['x.jpg'] });
  let { registros } = useDataStore.getState();
  expect(registros).toHaveLength(2);

  useDataStore.getState().editarRegistro(registros[0].id, { nota: 'bien' });
  expect(useDataStore.getState().registros[0].nota).toBe('bien');

  // la foto compartida sigue en uso mientras quede un registro que la tenga
  useDataStore.getState().borrarRegistro(registros[0].id);
  ({ registros } = useDataStore.getState());
  expect(fotosEnUso(registros).has('x.jpg')).toBe(true);
  useDataStore.getState().borrarRegistro(registros[0].id);
  expect(fotosEnUso(useDataStore.getState().registros).size).toBe(0);
});

test('moverArea reordena sin huecos', () => {
  useDataStore.getState().moverArea('a1', -1);
  const orden = [...useDataStore.getState().areas].sort((a, b) => a.orden - b.orden).map((a) => a.id);
  expect(orden.slice(0, 2)).toEqual(['a1', 'a0']);
  useDataStore.getState().moverArea(orden[0], -1); // ya está arriba: no cambia
  expect(useDataStore.getState().areas.map((a) => a.orden).sort()).toEqual([0, 1, 2, 3, 4]);
});

test('el respaldo ida y vuelta conserva los datos; un archivo ajeno se rechaza', () => {
  const { areas, actividades, registros } = useDataStore.getState();
  const texto = JSON.stringify(armarRespaldo({ areas, actividades, registros }, { 'a.jpg': 'AAA' }));
  const r = leerRespaldo(texto);
  expect(r.datos.areas).toEqual(areas);
  expect(r.fotos['a.jpg']).toBe('AAA');
  expect(() => leerRespaldo('{"hola":1}')).toThrow('no es un respaldo');
  expect(() => leerRespaldo('no json')).toThrow();
});
