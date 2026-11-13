import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { areaHues } from '../theme/colors';

// shortcut: todo vive en un JSON de AsyncStorage; migrar a SQLite si los registros pasan de ~10k.

export interface Area {
  id: string;
  nombre: string;
  icono: string; // nombre MDI
  color: string;
  orden: number;
  activo: boolean;
}

export interface Actividad {
  id: string;
  areaId: string;
  nombre: string;
  icono: string;
  activo: boolean;
  metaSemanal?: number; // intención flexible ("3 veces por semana"); con meta aparece en el widget
}

export interface Registro {
  id: string;
  actividadId: string;
  fecha: string; // 'YYYY-MM-DD' local
  duracionMin?: number;
  nota?: string;
  sensacion?: string;
  fotos?: string[]; // nombres de archivo dentro de la carpeta de fotos (services/fotos.ts)
  creadoEn: number;
}

export interface Datos {
  areas: Area[];
  actividades: Actividad[];
  registros: Registro[];
}

export type CamposRegistro = Pick<Registro, 'fecha' | 'duracionMin' | 'nota' | 'sensacion' | 'fotos'>;

interface DataState extends Datos {
  agregarRegistros: (actividadIds: string[], campos: CamposRegistro) => void;
  editarRegistro: (id: string, cambios: Partial<Omit<Registro, 'id' | 'creadoEn'>>) => void;
  borrarRegistro: (id: string) => void;
  guardarArea: (area: Omit<Area, 'id' | 'orden'> & { id?: string }) => void;
  guardarActividad: (actividad: Omit<Actividad, 'id'> & { id?: string }) => void;
  moverArea: (id: string, delta: -1 | 1) => void;
  reemplazarTodo: (datos: Datos) => void;
  alternarDia: (actividadId: string, fecha: string) => void;
}

export const nuevoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Registro sin duración, nota, sensación ni fotos: se puede quitar sin perder nada. */
export const esSimple = (r: Registro) => !r.duracionMin && !r.nota && !r.sensacion && !r.fotos?.length;

const SEED: [string, string, [string, string][]][] = [
  ['Bienestar', 'leaf', [['Ejercicio', 'run'], ['Caminata', 'walk'], ['Comer con calma', 'food-apple-outline']]],
  ['Creatividad', 'palette-outline', [['Bajo / música', 'guitar-electric'], ['Dibujo', 'draw'], ['Proyecto personal', 'lightbulb-outline']]],
  ['Crecimiento', 'sprout-outline', [['Lectura', 'book-open-variant'], ['Aprender algo', 'school-outline']]],
  ['Vida personal', 'account-group-outline', [['Tiempo con mis hijos', 'human-male-child'], ['Familia', 'home-heart'], ['Salir de casa', 'map-marker-outline']]],
  ['Descanso', 'weather-night', [['Descansé', 'sofa-outline'], ['Ocio elegido', 'gamepad-variant-outline'], ['Desconectar', 'power-sleep']]],
];

export function datosIniciales(): Datos {
  const areas: Area[] = [];
  const actividades: Actividad[] = [];
  SEED.forEach(([nombre, icono, acts], i) => {
    const areaId = `a${i}`;
    areas.push({ id: areaId, nombre, icono, color: areaHues[i % areaHues.length], orden: i, activo: true });
    acts.forEach(([n, ic], j) => actividades.push({ id: `a${i}-${j}`, areaId, nombre: n, icono: ic, activo: true }));
  });
  return { areas, actividades, registros: [] };
}

const STORAGE_KEY = 'vital-datos';
const VERSION = 1;

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      ...datosIniciales(),
      agregarRegistros: (actividadIds, campos) =>
        set((s) => ({
          registros: [
            ...s.registros,
            ...actividadIds.map((actividadId) => ({ id: nuevoId(), actividadId, ...campos, creadoEn: Date.now() })),
          ],
        })),
      editarRegistro: (id, cambios) =>
        set((s) => ({ registros: s.registros.map((r) => (r.id === id ? { ...r, ...cambios } : r)) })),
      borrarRegistro: (id) => set((s) => ({ registros: s.registros.filter((r) => r.id !== id) })),
      guardarArea: ({ id, ...campos }) =>
        set((s) =>
          id
            ? { areas: s.areas.map((a) => (a.id === id ? { ...a, ...campos } : a)) }
            : { areas: [...s.areas, { id: nuevoId(), orden: s.areas.length, ...campos }] },
        ),
      guardarActividad: ({ id, ...campos }) =>
        set((s) =>
          id
            ? { actividades: s.actividades.map((a) => (a.id === id ? { ...a, ...campos } : a)) }
            : { actividades: [...s.actividades, { id: nuevoId(), ...campos }] },
        ),
      moverArea: (id, delta) =>
        set((s) => {
          const lista = [...s.areas].sort((a, b) => a.orden - b.orden);
          const i = lista.findIndex((a) => a.id === id);
          const j = i + delta;
          if (i < 0 || j < 0 || j >= lista.length) return {};
          [lista[i], lista[j]] = [lista[j], lista[i]];
          return { areas: lista.map((a, orden) => ({ ...a, orden })) };
        }),
      reemplazarTodo: (datos) => set(datos),
      // Desde el widget: marca el día, o lo desmarca solo si el registro no tiene nada que perder.
      alternarDia: (actividadId, fecha) =>
        set((s) => {
          const delDia = s.registros.filter((r) => r.actividadId === actividadId && r.fecha === fecha);
          if (!delDia.length) {
            return { registros: [...s.registros, { id: nuevoId(), actividadId, fecha, creadoEn: Date.now() }] };
          }
          const simple = delDia.find(esSimple);
          return simple ? { registros: s.registros.filter((r) => r !== simple) } : {};
        }),
    }),
    {
      name: STORAGE_KEY,
      version: VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ areas, actividades, registros }) => ({ areas, actividades, registros }),
    },
  ),
);

/** Nombres de foto que siguen referenciados (una foto puede compartirse entre registros creados juntos). */
export const fotosEnUso = (registros: Registro[]) => new Set(registros.flatMap((r) => r.fotos ?? []));

/**
 * Escribe ya el estado al disco. persist guarda sin esperar; el widget corre en
 * una tarea en segundo plano que Android puede cerrar apenas termina.
 */
export async function guardarAhora(): Promise<void> {
  const { areas, actividades, registros } = useDataStore.getState();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { areas, actividades, registros }, version: VERSION }));
}
