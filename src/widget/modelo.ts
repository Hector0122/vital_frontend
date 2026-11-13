import { esSimple, type Datos } from '../stores/dataStore';
import { diasDeSemana, parseIso } from '../utils/fechas';
import { frecuentes } from '../utils/catalogo';

export const MAX_METAS = 4; // shortcut: el widget no hace scroll; con más metas, cambiar a ListWidget

export interface DiaWidget {
  fecha: string;
  numero: number;
  hecho: boolean;
  esHoy: boolean;
  futuro: boolean;
  /** Tiene registros con detalles: tocarlo abre la app en vez de desmarcar. */
  conDetalle: boolean;
}

export interface MetaWidget {
  actividadId: string;
  nombre: string;
  color: string;
  meta: number;
  hechos: number; // días distintos con registro esta semana
  dias: DiaWidget[];
}

/** Lo que dibuja el widget: actividades activas con meta semanal, en el orden de sus áreas. */
export function modeloWidget({ areas, actividades, registros }: Datos, hoy: string): MetaWidget[] {
  const dias = diasDeSemana(hoy);
  const ordenArea = new Map(areas.filter((a) => a.activo).map((a) => [a.id, a]));
  return actividades
    .filter((a) => a.activo && a.metaSemanal && ordenArea.has(a.areaId))
    .sort((a, b) => ordenArea.get(a.areaId)!.orden - ordenArea.get(b.areaId)!.orden)
    .slice(0, MAX_METAS)
    .map((act) => {
      const propios = registros.filter((r) => r.actividadId === act.id);
      const ds = dias.map((fecha) => {
        const delDia = propios.filter((r) => r.fecha === fecha);
        return {
          fecha,
          numero: parseIso(fecha).getDate(),
          hecho: delDia.length > 0,
          esHoy: fecha === hoy,
          futuro: fecha > hoy,
          conDetalle: delDia.length > 0 && !delDia.some(esSimple),
        };
      });
      return {
        actividadId: act.id,
        nombre: act.nombre,
        color: ordenArea.get(act.areaId)!.color,
        meta: act.metaSemanal!,
        hechos: ds.filter((d) => d.hecho).length,
        dias: ds,
      };
    });
}

export interface BotonRapido {
  actividadId: string;
  nombre: string;
  color: string;
  hechoHoy: boolean;
  conDetalle: boolean;
}

/** Widget de registro rápido: tus frecuentes; si aún hay pocas, se completa con las activas en orden. */
export function modeloRapido({ areas, actividades, registros }: Datos, hoy: string, n = 6): BotonRapido[] {
  const areasActivas = new Map(areas.filter((a) => a.activo).map((a) => [a.id, a]));
  const visibles = actividades.filter((a) => a.activo && areasActivas.has(a.areaId));
  const elegidas = frecuentes(registros, visibles, n);
  const enOrden = [...visibles].sort((a, b) => areasActivas.get(a.areaId)!.orden - areasActivas.get(b.areaId)!.orden);
  for (const a of enOrden) {
    if (elegidas.length >= n) break;
    if (!elegidas.includes(a)) elegidas.push(a);
  }
  return elegidas.map((a) => {
    const deHoy = registros.filter((r) => r.actividadId === a.id && r.fecha === hoy);
    return {
      actividadId: a.id,
      nombre: a.nombre,
      color: areasActivas.get(a.areaId)!.color,
      hechoHoy: deHoy.length > 0,
      conDetalle: deHoy.length > 0 && !deHoy.some(esSimple),
    };
  });
}
