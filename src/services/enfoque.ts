import type { Datos, Sugerencia } from '../stores/dataStore';
import { diasDeSemana } from '../utils/fechas';
import { leerConfig } from './nube';

/** Lo que se manda a la IA (cloud-worker/src/enfoque.ts): nombres, metas y conteos. Nada de notas. */
export interface EntradaEnfoque {
  texto: string;
  diasRestantes: number;
  actividades: {
    id: string;
    nombre: string;
    area: string;
    metaActual?: number;
    vecesEstaSemana: number;
  }[];
}

export interface PropuestaEnfoque {
  mensaje: string;
  metas: Sugerencia[];
  fuente: 'ia' | 'reglas';
}

export function construirEntradaEnfoque(
  { areas, actividades, registros }: Datos,
  texto: string,
  hoy: string,
): EntradaEnfoque {
  const dias = diasDeSemana(hoy);
  const areasActivas = new Map(areas.filter(a => a.activo).map(a => [a.id, a]));
  return {
    texto: texto.trim(),
    diasRestantes: 7 - dias.indexOf(hoy),
    actividades: actividades
      .filter(a => a.activo && areasActivas.has(a.areaId))
      .map(a => ({
        id: a.id,
        nombre: a.nombre,
        area: areasActivas.get(a.areaId)!.nombre,
        vecesEstaSemana: new Set(
          registros
            .filter(r => r.actividadId === a.id && dias.includes(r.fecha))
            .map(r => r.fecha),
        ).size,
        ...(a.metaSemanal ? { metaActual: a.metaSemanal } : {}),
      })),
  };
}

const normal = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Sin IA: busca la actividad por nombre en el texto y le da más espacio; el resto se conserva. */
export function enfoquePorReglas(e: EntradaEnfoque): PropuestaEnfoque {
  const texto = normal(e.texto);
  const palabras = (s: string) =>
    normal(s)
      .split(/[^a-z0-9ñ]+/)
      .filter(w => w.length >= 4);
  const elegida =
    e.actividades.find(a => palabras(a.nombre).some(w => texto.includes(w))) ??
    e.actividades.find(a => palabras(a.area).some(w => texto.includes(w)));
  const actuales: Sugerencia[] = e.actividades
    .filter(a => a.metaActual && a.id !== elegida?.id)
    .map(a => ({
      actividadId: a.id,
      veces: a.metaActual!,
      motivo: 'Se queda como estaba.',
    }));
  if (!elegida) {
    return {
      mensaje:
        'No encontré esa actividad entre las tuyas. Puedes crearla en Ajustes → Áreas y actividades.',
      metas: actuales.slice(0, 3),
      fuente: 'reglas',
    };
  }
  const tope = elegida.vecesEstaSemana + e.diasRestantes;
  const veces = Math.min(tope, 7, Math.max((elegida.metaActual ?? 1) + 1, 2));
  return {
    mensaje: `Le doy más espacio a ${elegida.nombre} esta semana.`,
    metas: [
      { actividadId: elegida.id, veces, motivo: 'Tu enfoque de la semana.' },
      ...actuales,
    ].slice(0, 3),
    fuente: 'reglas',
  };
}

/** Pide la propuesta al Worker (Groq); sin conexión o si falla, usa las reglas. Nunca lanza. */
export async function proponerEnfoque(
  entrada: EntradaEnfoque,
): Promise<PropuestaEnfoque> {
  const config = await leerConfig();
  if (config) {
    try {
      const res = await fetch(`${config.url}/enfoque`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entrada),
      });
      if (res.ok) {
        const r = (await res.json()) as Omit<PropuestaEnfoque, 'fuente'>;
        if (typeof r.mensaje === 'string' && Array.isArray(r.metas))
          return { ...r, fuente: 'ia' };
      }
    } catch {}
  }
  return enfoquePorReglas(entrada);
}
