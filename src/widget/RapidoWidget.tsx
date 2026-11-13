/* eslint-disable react-native/no-inline-styles -- react-native-android-widget no usa StyleSheet: los estilos se serializan a RemoteViews */
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { brands, hexToRgba, neutrals, semantic } from '../theme/tokens';
import type { BotonRapido } from './modelo';
import { CLICK_MARCAR } from './MetasWidget';

type Hex = `#${string}`;
const VERDE = semantic.success.dark as Hex;
const TEAL = brands.vital.primary as Hex;

function Boton({ b, hoy }: { b: BotonRapido; hoy: string }) {
  const click = b.conDetalle ? 'OPEN_APP' : CLICK_MARCAR;
  return (
    <FlexWidget
      clickAction={click}
      clickActionData={click === CLICK_MARCAR ? { actividadId: b.actividadId, fecha: hoy } : undefined}
      style={{
        flex: 1,
        height: 48,
        marginHorizontal: 3,
        borderRadius: 14,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: (b.hechoHoy ? hexToRgba(VERDE, 0.16) : neutrals[850]) as Hex,
        borderWidth: 1,
        borderColor: (b.hechoHoy ? VERDE : neutrals[700]) as Hex,
      }}
    >
      <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.color as Hex, marginRight: 6 }} />
      <FlexWidget style={{ flex: 1 }}>
        <TextWidget text={b.nombre} maxLines={1} truncate="END" style={{ fontSize: 13, color: neutrals[50] as Hex }} />
      </FlexWidget>
      {b.hechoHoy ? <TextWidget text="✓" style={{ fontSize: 16, fontWeight: 'bold', color: VERDE }} /> : null}
    </FlexWidget>
  );
}

/** Tus frecuentes; un toque = registrado hoy. */
export function RapidoWidget({ botones, hoy }: { botones: BotonRapido[]; hoy: string }) {
  const filas = [botones.slice(0, 3), botones.slice(3, 6)].filter((f) => f.length);
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: 12,
        borderRadius: 24,
        backgroundGradient: { from: neutrals[850] as Hex, to: neutrals[950] as Hex, orientation: 'TOP_BOTTOM' },
      }}
    >
      <FlexWidget clickAction="OPEN_APP" style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 8 }}>
        <TextWidget text="Hoy hice…" style={{ fontSize: 14, color: TEAL, fontFamily: 'ArchivoBlack-Regular' }} />
      </FlexWidget>
      {filas.map((fila, i) => (
        <FlexWidget key={i} style={{ width: 'match_parent', flexDirection: 'row', marginBottom: 6 }}>
          {fila.map((b) => (
            <Boton key={b.actividadId} b={b} hoy={hoy} />
          ))}
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
