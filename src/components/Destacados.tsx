import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, iconSize, radius, spacing, type } from '../theme';
import type { Mensaje } from '../utils/resumen';

/** Lo que motiva del periodo: el primer logro como titular, el resto en filas; el aviso, sereno. */
export function Destacados({ mensajes, detalle }: { mensajes: Mensaje[]; detalle?: string }) {
  if (!mensajes.length) // sin nada que comparar: lo que hubo es el titular
    return <View style={styles.card}>{detalle ? <Text style={styles.titular}>{detalle}</Text> : null}</View>;
  const [titular, ...resto] = mensajes[0].tipo === 'logro' ? mensajes : [undefined, ...mensajes];
  return (
    <View style={styles.card}>
      {titular && <Text style={styles.titular}>{titular.texto}</Text>}
      {resto.map(m => (
        <View key={m!.texto} style={styles.fila}>
          <Icon
            name={m!.tipo === 'logro' ? 'star-four-points-outline' : 'weather-partly-cloudy'}
            size={iconSize.sm}
            color={m!.tipo === 'logro' ? colors.primary : colors.muted}
          />
          <Text style={[styles.texto, m!.tipo === 'aviso' && styles.aviso]}>{m!.texto}</Text>
        </View>
      ))}
      {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
    gap: spacing.xs,
  },
  titular: { ...type.body, fontSize: 19, lineHeight: 26, fontWeight: '600', color: colors.text },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  texto: { ...type.bodySm, color: colors.text, flex: 1 },
  aviso: { color: colors.muted },
  detalle: { ...type.bodySm, color: colors.muted, marginTop: spacing.xs },
});
