import RNFS from 'react-native-fs';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { nuevoId } from '../stores/dataStore';

/** Las fotos se copian a la carpeta privada de la app; el registro guarda solo el nombre de archivo. */
export const DIR_FOTOS = `${RNFS.DocumentDirectoryPath}/fotos`;

export const fotoUri = (nombre: string) => `file://${DIR_FOTOS}/${nombre}`;

/** Devuelve el nombre de la foto guardada, o null si se canceló. */
export async function elegirFoto(desdeCamara: boolean): Promise<string | null> {
  const launcher = desdeCamara ? launchCamera : launchImageLibrary;
  // Reducida: es un recuerdo, no un archivo de fotografía; mantiene ligero el respaldo.
  const res = await launcher({ mediaType: 'photo', maxWidth: 1600, maxHeight: 1600, quality: 0.7 });
  const uri = res.assets?.[0]?.uri;
  if (res.didCancel || res.errorCode || !uri) return null;
  await RNFS.mkdir(DIR_FOTOS);
  const nombre = `${nuevoId()}.jpg`;
  await RNFS.copyFile(uri, `${DIR_FOTOS}/${nombre}`);
  return nombre;
}

/** Borra los archivos que ya no usa ningún registro. Falla en silencio: un archivo huérfano no rompe nada. */
export async function borrarFotosHuerfanas(enUso: Set<string>): Promise<void> {
  try {
    if (!(await RNFS.exists(DIR_FOTOS))) return;
    const archivos = await RNFS.readDir(DIR_FOTOS);
    await Promise.all(archivos.filter((f) => !enUso.has(f.name)).map((f) => RNFS.unlink(f.path)));
  } catch {}
}
