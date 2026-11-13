import {
  errorCodes,
  isErrorWithCode,
  pick,
  saveDocuments,
  types,
} from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import type { Datos } from '../stores/dataStore';
import { hoy } from '../utils/fechas';
import { DIR_FOTOS } from './fotos';

/**
 * Respaldo = un solo .json con los datos y las fotos en base64.
 * shortcut: todo en memoria; si las fotos pasan de ~100MB, cambiar a un .zip por streaming.
 */
export interface Respaldo {
  app: 'vital';
  version: 1;
  exportadoEn: string;
  datos: Datos;
  fotos: Record<string, string>; // nombre -> base64
}

export function armarRespaldo(
  datos: Datos,
  fotos: Record<string, string>,
): Respaldo {
  return {
    app: 'vital',
    version: 1,
    exportadoEn: new Date().toISOString(),
    datos,
    fotos,
  };
}

/** Valida lo mínimo antes de reemplazar los datos: un archivo equivocado no debe borrar nada. */
export function leerRespaldo(texto: string): Respaldo {
  const r = JSON.parse(texto);
  const d = r?.datos;
  if (
    r?.app !== 'vital' ||
    r.version !== 1 ||
    !Array.isArray(d?.areas) ||
    !Array.isArray(d?.actividades) ||
    !Array.isArray(d?.registros)
  ) {
    throw new Error('El archivo no es un respaldo de Vital.');
  }
  return { ...r, fotos: r.fotos ?? {} };
}

const cancelado = (e: unknown) =>
  isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED;

/** Abre "Guardar como". Devuelve false si el usuario canceló. */
export async function exportarRespaldo(datos: Datos): Promise<boolean> {
  const fotos: Record<string, string> = {};
  for (const nombre of new Set(datos.registros.flatMap(r => r.fotos ?? []))) {
    const ruta = `${DIR_FOTOS}/${nombre}`;
    if (await RNFS.exists(ruta))
      fotos[nombre] = await RNFS.readFile(ruta, 'base64');
  }
  const nombreArchivo = `vital-respaldo-${hoy()}.json`;
  const tmp = `${RNFS.CachesDirectoryPath}/${nombreArchivo}`;
  await RNFS.writeFile(
    tmp,
    JSON.stringify(armarRespaldo(datos, fotos)),
    'utf8',
  );
  try {
    const [res] = await saveDocuments({
      sourceUris: [`file://${tmp}`],
      mimeType: 'application/json',
      fileName: nombreArchivo,
    });
    if (res.error) throw new Error(res.error);
    return true;
  } catch (e) {
    if (cancelado(e)) return false;
    throw e;
  } finally {
    RNFS.unlink(tmp).catch(() => {});
  }
}

/** Abre el selector, valida el archivo y escribe sus fotos. Devuelve los datos a cargar, o null si se canceló. */
export async function importarRespaldo(): Promise<Datos | null> {
  let uri: string;
  try {
    [{ uri }] = await pick({
      type: [types.json, types.plainText, types.allFiles],
    });
  } catch (e) {
    if (cancelado(e)) return null;
    throw e;
  }
  const respaldo = leerRespaldo(await RNFS.readFile(uri, 'utf8'));
  await RNFS.mkdir(DIR_FOTOS);
  for (const [nombre, base64] of Object.entries(respaldo.fotos)) {
    if (/^[\w-]+\.jpg$/.test(nombre))
      await RNFS.writeFile(`${DIR_FOTOS}/${nombre}`, base64, 'base64');
  }
  return respaldo.datos;
}
