import * as Keychain from 'react-native-keychain';
import { respaldarEnNube, useNubeStore } from '../src/services/nube';

const fetchMock = jest.fn(async (_url: string, _init?: RequestInit) => ({
  ok: true,
  status: 201,
}));

beforeEach(async () => {
  (globalThis as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
  fetchMock.mockClear();
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
    username: 'https://w.dev',
    password: 't',
  });
  await useNubeStore.persist.rehydrate();
});

test('respalda si nunca se ha hecho, sin fotos y con el token', async () => {
  useNubeStore.setState({ ultimoRespaldo: undefined });
  expect(await respaldarEnNube()).toBe(true);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://w.dev/respaldo');
  expect((init!.headers as Record<string, string>).Authorization).toBe(
    'Bearer t',
  );
  expect(JSON.parse(init!.body as string)).toMatchObject({
    app: 'vital',
    fotos: {},
  });
  expect(useNubeStore.getState().ultimoRespaldo).toBeGreaterThan(0);
});

test('no vuelve a respaldar dentro de la misma semana, salvo forzado', async () => {
  useNubeStore.setState({ ultimoRespaldo: Date.now() - 2 * 86_400_000 });
  expect(await respaldarEnNube()).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await respaldarEnNube(true)).toBe(true);
});

test('sin Worker conectado: en automático no hace nada; forzado avisa', async () => {
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);
  useNubeStore.setState({ ultimoRespaldo: undefined });
  expect(await respaldarEnNube()).toBe(false);
  await expect(respaldarEnNube(true)).rejects.toThrow('Conecta tu Worker');
});
