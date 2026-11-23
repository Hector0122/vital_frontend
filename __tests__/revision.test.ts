import {
  datosIniciales,
  useDataStore,
  type Registro,
} from '../src/stores/dataStore';
import {
  construirEntrada,
  generarRevisionSiFalta,
  regenerarRevision,
  revisionPorReglas,
  semanaARevisar,
} from '../src/services/revision';
import { diasDeSemana } from '../src/utils/fechas';
import * as nube from '../src/services/nube';

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
const dias = diasDeSemana('2026-11-09');

test('semana a revisar: domingo desde las 18h cierra la actual; si no, la anterior', () => {
  expect(semanaARevisar(new Date(2026, 10, 15, 19))).toBe('2026-11-09'); // domingo noche
  expect(semanaARevisar(new Date(2026, 10, 15, 10))).toBe('2026-11-02'); // domingo mañana
  expect(semanaARevisar(new Date(2026, 10, 16, 8))).toBe('2026-11-09'); // lunes
});

test('la entrada lleva notas (no fotos) y cuenta días distintos', () => {
  const datos = datosIniciales();
  datos.registros = [
    reg('a0-0', '2026-11-09', { nota: 'secreto', sensacion: 'Cansado' }),
    reg('a0-0', '2026-11-09', { duracionMin: 30 }),
  ];
  const e = construirEntrada(datos, dias);
  expect(JSON.stringify(e)).toContain('secreto');
  expect(JSON.stringify(e)).not.toContain('fotos');
  expect(e.actividades.find(a => a.id === 'a0-0')).toMatchObject({
    veces: 1,
    minutos: 30,
  });
  expect(e.sensaciones).toEqual({ Cansado: 1 });
  expect(e.diasConRegistro).toBe(1);
});

test('reglas: sube de a uno si cumplió, baja a lo logrado si no, y retoma lo descuidado', () => {
  const datos = datosIniciales();
  datos.actividades.find(a => a.id === 'a0-0')!.metaSemanal = 2; // Ejercicio
  datos.actividades.find(a => a.id === 'a2-0')!.metaSemanal = 3; // Lectura
  datos.registros = [
    reg('a0-0', '2026-11-09'),
    reg('a0-0', '2026-11-11'),
    reg('a2-0', '2026-11-10'),
  ];
  const r = revisionPorReglas(construirEntrada(datos, dias));
  expect(r.sugerencias).toEqual([
    { actividadId: 'a0-0', veces: 3, motivo: expect.any(String) },
    { actividadId: 'a2-0', veces: 1, motivo: expect.any(String) },
  ]);
  expect(r.secciones!.metas).toBe(
    'Ejercicio se cumplió (2 de 2 días); Lectura quedó en 1 de 3 días.',
  );
});

test('reglas: con cansancio no sube nada', () => {
  const datos = datosIniciales();
  datos.actividades.find(a => a.id === 'a0-0')!.metaSemanal = 2;
  datos.registros = [
    reg('a0-0', '2026-11-09', { sensacion: 'Cansado' }),
    reg('a0-0', '2026-11-11', { sensacion: 'Cansado' }),
  ];
  const r = revisionPorReglas(construirEntrada(datos, dias));
  expect(r.sugerencias).toEqual([
    { actividadId: 'a0-0', veces: 2, motivo: expect.any(String) },
  ]);
  expect(r.analisis).toContain('cansado');
});

test('aplicar revisión: las aceptadas son las nuevas metas y las demás se quitan', () => {
  const s = useDataStore.getState();
  s.guardarActividad({
    ...s.actividades.find(a => a.id === 'a1-0')!,
    metaSemanal: 5,
  });
  s.guardarRevision({
    semana: '2026-11-09',
    analisis: 'x',
    sugerencias: [],
    fuente: 'reglas',
    estado: 'pendiente',
  });
  useDataStore
    .getState()
    .aplicarRevision('2026-11-09', [{ actividadId: 'a0-0', veces: 3 }]);
  const st = useDataStore.getState();
  expect(st.actividades.find(a => a.id === 'a0-0')!.metaSemanal).toBe(3);
  expect(
    st.actividades.find(a => a.id === 'a1-0')!.metaSemanal,
  ).toBeUndefined();
  expect(st.revisiones![0]).toMatchObject({
    estado: 'aplicada',
    aceptadas: [{ actividadId: 'a0-0', veces: 3, nombre: 'Ejercicio' }],
  });
});

test('revisión pendiente: se rehace si registras algo más de esa semana', async () => {
  useDataStore.setState({ ...datosIniciales(), revisiones: [] });
  useDataStore.getState().agregarRegistros(['a0-0'], { fecha: '2026-11-10' });
  const lunes = new Date(2026, 10, 16, 9); // revisa la semana del 9
  await generarRevisionSiFalta(lunes);
  const primera = useDataStore.getState().revisiones![0];

  await generarRevisionSiFalta(lunes); // sin cambios: no se rehace
  expect(useDataStore.getState().revisiones![0]).toBe(primera);

  useDataStore.getState().agregarRegistros(['a2-0'], { fecha: '2026-11-15' }); // domingo en la noche
  await generarRevisionSiFalta(lunes);
  expect(useDataStore.getState().revisiones![0].huella).not.toBe(
    primera.huella,
  );

  useDataStore.getState().aplicarRevision('2026-11-09', []);
  useDataStore.getState().agregarRegistros(['a0-0'], { fecha: '2026-11-14' });
  await generarRevisionSiFalta(lunes); // ya aplicada: no se toca
  expect(useDataStore.getState().revisiones![0].estado).toBe('aplicada');
});

test('rehacer: cambia solo el texto, conserva lo elegido y usa las metas de esa semana', async () => {
  useDataStore.setState({
    ...datosIniciales(),
    registros: [reg('a0-0', '2026-11-10')],
    revisiones: [
      {
        semana: '2026-11-02', // al cerrarla elegiste Ejercicio 2× para la del 9
        analisis: 'a',
        sugerencias: [],
        fuente: 'reglas',
        estado: 'aplicada',
        aceptadas: [{ actividadId: 'a0-0', veces: 2 }],
      },
      {
        semana: '2026-11-09',
        analisis: 'Lista vieja.',
        sugerencias: [],
        fuente: 'reglas',
        estado: 'aplicada',
        aceptadas: [{ actividadId: 'a2-0', veces: 1, nombre: 'Lectura' }],
      },
    ],
  });
  jest
    .spyOn(nube, 'leerConfig')
    .mockResolvedValue({ url: 'https://w', token: 't' } as any);
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ analisis: 'Texto nuevo.', sugerencias: [] }),
  });
  globalThis.fetch = fetchMock as any;

  expect(await regenerarRevision('2026-11-09')).toBe(true);
  const r = useDataStore
    .getState()
    .revisiones!.find(x => x.semana === '2026-11-09')!;
  expect(r).toMatchObject({
    analisis: 'Texto nuevo.',
    fuente: 'ia',
    estado: 'aplicada',
    aceptadas: [{ actividadId: 'a2-0', veces: 1, nombre: 'Lectura' }],
  });
  const entrada = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(
    entrada.actividades.find((a: any) => a.id === 'a0-0').metaAnterior,
  ).toBe(2);

  fetchMock.mockResolvedValue({ ok: false });
  expect(await regenerarRevision('2026-11-09')).toBe(false); // la IA falla: no se toca
  expect(
    useDataStore.getState().revisiones!.find(x => x.semana === '2026-11-09')!
      .analisis,
  ).toBe('Texto nuevo.');
  jest.restoreAllMocks();
});

test('la entrada lleva cada registro con su nota, metas reales y semana parcial', () => {
  const datos = datosIniciales();
  datos.actividades.find(a => a.id === 'a0-0')!.metaSemanal = 2;
  datos.registros = [
    reg('a0-0', '2026-11-13', {
      nota: '  Corrí con mi hijo  ',
      duracionMin: 40,
      sensacion: 'Contento',
    }),
    reg('a2-0', '2026-11-14'),
  ];
  const e = construirEntrada(datos, dias, '2026-11-16');
  expect(e.registros).toEqual([
    {
      fecha: '2026-11-13',
      dia: 'viernes',
      actividadId: 'a0-0',
      actividad: 'Ejercicio',
      area: 'Bienestar',
      minutos: 40,
      sensacion: 'Contento',
      nota: 'Corrí con mi hijo',
    },
    {
      fecha: '2026-11-14',
      dia: 'sábado',
      actividadId: 'a2-0',
      actividad: 'Lectura',
      area: 'Crecimiento',
    },
  ]);
  expect(e.metas).toEqual([
    { actividadId: 'a0-0', nombre: 'Ejercicio', meta: 2, dias: 1 },
  ]);
  expect(e.diasUsandoApp).toBe(3); // empezó el viernes
});

test('sin IA: secciones con titular, nota destacada y sin lista de actividades', () => {
  const datos = datosIniciales();
  datos.registros = [
    reg('a0-0', '2026-11-13', {
      nota: 'Terminé el nivel 1 a mano',
      sensacion: 'Contento',
    }),
    reg('a2-0', '2026-11-14', { sensacion: 'Contento' }),
  ];
  const r = revisionPorReglas(construirEntrada(datos, dias, '2026-11-16'));
  expect(r.secciones!.titular).toBe(
    'Empezaste a registrar a media semana: 2 días con algo para ti.',
  );
  expect(r.secciones!.destacado).toContain(
    'El viernes, en ejercicio: «Terminé el nivel 1 a mano»',
  );
  expect(r.secciones!.sentir).toBe(
    'Lo que más sentiste: contento (dos veces).',
  );
  expect(r.analisis).not.toMatch(/Registraste .* veces/);
});
