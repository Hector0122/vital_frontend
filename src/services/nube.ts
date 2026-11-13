import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import RNFS from 'react-native-fs';
import { fotosEnUso, useDataStore, type Datos } from '../stores/dataStore';
import { armarRespaldo, leerRespaldo } from './backup';
import { DIR_FOTOS } from './fotos';

/**
 * Copia de las fotos en R2 a través de cloud-worker/. Opcional: sin configurar,
 * la app funciona igual. La URL y el token viven en el Keychain, nunca en el código.
 */
const SERVICE = 'vital-nube';

export interface ConfigNube {
  url: string;
  token: string;
}

/** Sin configurar o sin Keychain disponible = sin nube; nunca debe tumbar la app. */
export async function leerConfig(): Promise<ConfigNube | null> {
  try {
    const c = await Keychain.getGenericPassword({ service: SERVICE });
    return c ? { url: c.username, token: c.password } : null;
  } catch {
    return null;
  }
}

/** Valida contra el Worker antes de guardar: un token equivocado da 401, uno bueno 404 (foto inexistente). */
export async function conectar(urlCruda: string, token: string): Promise<void> {
  const url = urlCruda.trim().replace(/\/+$/, '');
  if (!/^https:\/\/\S+$/.test(url))
    throw new Error('La URL debe empezar con https://');
  let res: Response;
  try {
    res = await fetch(`${url}/fotos/prueba-conexion.jpg`, {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
  } catch {
    throw new Error(
      'No se pudo contactar al Worker. Revisa la URL y tu conexión.',
    );
  }
  if (res.status === 401) throw new Error('El token no es correcto.');
  if (res.status !== 404)
    throw new Error(`Respuesta inesperada del Worker (${res.status}).`);
  await Keychain.setGenericPassword(url, token.trim(), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function desconectar(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
  useNubeStore.setState({ subidas: [], ultimoRespaldo: undefined });
}

/** Qué fotos ya están en la nube y cuándo fue el último respaldo de datos. */
export const useNubeStore = create<{
  subidas: string[];
  ultimoRespaldo?: number;
}>()(
  persist(() => ({ subidas: [] as string[] }), {
    name: 'vital-nube',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

const listo = () =>
  useDataStore.persist.hasHydrated() && useNubeStore.persist.hasHydrated();

/** Pendientes = fotos en uso que aún no se suben, y subidas que ya nadie usa (se borran de la nube). */
export function pendientes(enUso: Set<string>, subidas: string[]) {
  const yaSubidas = new Set(subidas);
  return {
    subir: [...enUso].filter(f => !yaSubidas.has(f)),
    borrar: subidas.filter(f => !enUso.has(f)),
  };
}

/** Corre `fn` en cuanto ambos stores terminaron de cargar desde el disco. */
export function alHidratar(fn: () => void): void {
  if (listo()) return fn();
  const cada = () => listo() && fn();
  useDataStore.persist.onFinishHydration(cada);
  useNubeStore.persist.onFinishHydration(cada);
}

let enCurso: Promise<number> | null = null;

/**
 * Sube lo pendiente y borra de la nube lo que ya no se usa. Devuelve cuántas
 * fotos quedan pendientes. Falla en silencio por foto: se reintenta la próxima vez.
 */
export function sincronizar(): Promise<number> {
  enCurso ??= (async () => {
    // Sin hidratar, `registros` está vacío y parecería que todas las fotos sobran.
    if (!listo()) return 0;
    const config = await leerConfig();
    if (!config) return 0;
    const auth = { Authorization: `Bearer ${config.token}` };
    const { subir, borrar } = pendientes(
      fotosEnUso(useDataStore.getState().registros),
      useNubeStore.getState().subidas,
    );
    let fallidas = 0;

    for (const nombre of subir) {
      try {
        const blob = await (
          await fetch(`file://${DIR_FOTOS}/${nombre}`)
        ).blob();
        const res = await fetch(`${config.url}/fotos/${nombre}`, {
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (!res.ok) throw new Error(String(res.status));
        useNubeStore.setState(s => ({ subidas: [...s.subidas, nombre] }));
      } catch {
        fallidas++;
      }
    }
    for (const nombre of borrar) {
      try {
        const res = await fetch(`${config.url}/fotos/${nombre}`, {
          method: 'DELETE',
          headers: auth,
        });
        if (!res.ok) throw new Error(String(res.status));
        useNubeStore.setState(s => ({
          subidas: s.subidas.filter(f => f !== nombre),
        }));
      } catch {
        fallidas++;
      }
    }
    return fallidas;
  })().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

const SEMANA_MS = 7 * 24 * 3600 * 1000;

/**
 * Sube los datos (sin fotos: esas ya van por `sincronizar`) una vez por semana,
 * o ya mismo con `forzar`. Devuelve true si subió. Nunca lanza salvo con `forzar`.
 */
export async function respaldarEnNube(forzar = false): Promise<boolean> {
  if (!listo()) return false;
  const { ultimoRespaldo } = useNubeStore.getState();
  if (!forzar && ultimoRespaldo && Date.now() - ultimoRespaldo < SEMANA_MS)
    return false;
  const config = await leerConfig();
  if (!config) {
    if (forzar) throw new Error('Conecta tu Worker primero.');
    return false;
  }
  try {
    const { areas, actividades, registros, revisiones, enfoques } =
      useDataStore.getState();
    const res = await fetch(`${config.url}/respaldo`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        armarRespaldo(
          { areas, actividades, registros, revisiones, enfoques },
          {},
        ),
      ),
    });
    if (!res.ok) throw new Error(`El Worker respondió ${res.status}`);
    useNubeStore.setState({ ultimoRespaldo: Date.now() });
    return true;
  } catch (e) {
    if (forzar) throw e;
    return false;
  }
}

/** Baja el último respaldo y las fotos que falten. Devuelve los datos a cargar y cuántas fotos fallaron. */
export async function restaurarDeNube(): Promise<{
  datos: Datos;
  fallidas: number;
}> {
  const config = await leerConfig();
  if (!config) throw new Error('Conecta tu Worker primero.');
  const auth = { Authorization: `Bearer ${config.token}` };
  const res = await fetch(`${config.url}/respaldo`, { headers: auth });
  if (res.status === 404)
    throw new Error('Todavía no hay respaldo en la nube.');
  if (!res.ok) throw new Error(`El Worker respondió ${res.status}`);
  const { datos } = leerRespaldo(await res.text());

  await RNFS.mkdir(DIR_FOTOS);
  const enUso = [...fotosEnUso(datos.registros)];
  let fallidas = 0;
  for (const nombre of enUso) {
    const destino = `${DIR_FOTOS}/${nombre}`;
    if (await RNFS.exists(destino)) continue;
    const { statusCode } = await RNFS.downloadFile({
      fromUrl: `${config.url}/fotos/${nombre}`,
      toFile: destino,
      headers: auth,
    }).promise;
    if (statusCode !== 200) {
      fallidas++;
      await RNFS.unlink(destino).catch(() => {});
    }
  }
  // Las fotos de este respaldo ya están en la nube: no hay que volver a subirlas.
  useNubeStore.setState({ subidas: enUso, ultimoRespaldo: Date.now() });
  return { datos, fallidas };
}
