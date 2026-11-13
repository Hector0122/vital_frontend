/* eslint-disable react-native/no-inline-styles -- react-native-android-widget no usa StyleSheet: los estilos se serializan a RemoteViews */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { brands, hexToRgba, neutrals, semantic } from '../theme/tokens';
import { parseIso } from '../utils/fechas';
import type { MetaWidget } from './modelo';

type Hex = `#${string}`;
const VERDE = semantic.success.dark as Hex;
const TEAL = brands.vital.primary as Hex;
const TEXTO = neutrals[50] as Hex;
const TENUE = neutrals[500] as Hex;
const CELDA = neutrals[850] as Hex;
const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export const CLICK_MARCAR = 'MARCAR';

function Celda({ meta, i }: { meta: MetaWidget; i: number }) {
  const d = meta.dias[i];
  // Futuro: no se toca. Con detalles: abre la app (desmarcar perdería la nota/fotos).
  const click = d.futuro ? undefined : d.conDetalle ? 'OPEN_APP' : CLICK_MARCAR;
  return (
    <FlexWidget
      clickAction={click}
      clickActionData={click === CLICK_MARCAR ? { actividadId: meta.actividadId, fecha: d.fecha } : undefined}
      style={{
        flex: 1,
        height: 46,
        marginHorizontal: 2,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: (d.hecho ? hexToRgba(VERDE, 0.16) : CELDA) as Hex,
        borderWidth: d.esHoy ? 2 : 0,
        borderColor: TEAL,
      }}
    >
      <TextWidget
        text={String(d.numero)}
        style={{ fontSize: 10, color: d.esHoy ? TEAL : TENUE, fontWeight: d.esHoy ? 'bold' : 'normal' }}
      />
      <TextWidget
        text={d.hecho ? '✓' : ' '}
        style={{ fontSize: 20, color: VERDE, fontWeight: 'bold' }}
      />
    </FlexWidget>
  );
}

function Fila({ meta }: { meta: MetaWidget }) {
  const cumplida = meta.hechos >= meta.meta;
  return (
    <FlexWidget style={{ width: 'match_parent', marginTop: 10 }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: meta.color as Hex, marginRight: 8 }} />
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={meta.nombre} maxLines={1} truncate="END" style={{ fontSize: 15, fontWeight: 'bold', color: TEXTO }} />
        </FlexWidget>
        <TextWidget
          text={cumplida ? `✓ ${meta.hechos}/${meta.meta}` : `${meta.hechos}/${meta.meta}`}
          style={{ fontSize: 13, fontWeight: 'bold', color: cumplida ? VERDE : TENUE }}
        />
      </FlexWidget>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row' }}>
        {meta.dias.map((d, i) => (
          <Celda key={d.fecha} meta={meta} i={i} />
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}

export function MetasWidget({ metas, hoy }: { metas: MetaWidget[]; hoy: string }) {
  const fecha = parseIso(hoy).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: 14,
        borderRadius: 24,
        backgroundGradient: { from: neutrals[850] as Hex, to: neutrals[950] as Hex, orientation: 'TOP_BOTTOM' },
      }}
    >
      <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text="Vital" style={{ fontSize: 18, color: TEAL, fontFamily: 'ArchivoBlack-Regular' }} />
        </FlexWidget>
        <TextWidget text={fecha} style={{ fontSize: 12, color: TENUE, fontFamily: 'IBMPlexMono-Medium' }} />
      </FlexWidget>

      {metas.length ? (
        <>
          <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', marginTop: 8 }}>
            {INICIALES.map((l, i) => (
              <FlexWidget key={i} style={{ flex: 1, alignItems: 'center' }}>
                <TextWidget text={l} style={{ fontSize: 11, color: TENUE, fontFamily: 'IBMPlexMono-Medium' }} />
              </FlexWidget>
            ))}
          </FlexWidget>
          {metas.map((m) => (
            <Fila key={m.actividadId} meta={m} />
          ))}
        </>
      ) : (
        <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', marginTop: 12 }}>
          <TextWidget
            text="Ponle una meta semanal a una actividad para verla aquí."
            style={{ fontSize: 14, color: TEXTO }}
          />
          <TextWidget
            text="Ajustes → Áreas y actividades"
            style={{ fontSize: 12, color: TENUE, marginTop: 4, fontFamily: 'IBMPlexMono-Medium' }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
