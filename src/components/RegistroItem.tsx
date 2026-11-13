import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import type { Actividad, Area, Registro } from '../stores/dataStore';
import { colors, iconSize, spacing, type } from '../theme';
import { formatDuracion } from '../utils/catalogo';
import { formatFecha } from '../utils/fechas';

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

interface Props {
  registro: Registro;
  actividad?: Actividad;
  area?: Area;
  onPress: () => void;
  sinFecha?: boolean; // cuando la lista ya agrupa por día
}

export function RegistroItem({
  registro,
  actividad,
  area,
  onPress,
  sinFecha,
}: Props) {
  const detalle = [
    !sinFecha &&
      capitalizar(
        formatFecha(registro.fecha, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
      ),
    registro.duracionMin && formatDuracion(registro.duracionMin),
    registro.sensacion,
    registro.fotos?.length &&
      `${registro.fotos.length} foto${registro.fotos.length > 1 ? 's' : ''}`,
  ].filter(Boolean);

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Editar registro"
    >
      <Icon
        name={actividad?.icono ?? 'circle-outline'}
        size={iconSize.md}
        color={area?.color ?? colors.muted}
      />
      <View style={styles.flex}>
        <Text style={styles.nombre}>{actividad?.nombre ?? 'Actividad'}</Text>
        {detalle.length ? (
          <Text style={styles.detalle}>{detalle.join(' · ')}</Text>
        ) : null}
        {registro.nota ? (
          <Text style={styles.nota} numberOfLines={2}>
            {registro.nota}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
    minHeight: 48,
  },
  flex: { flex: 1 },
  nombre: { ...type.body, color: colors.text },
  detalle: { ...type.caption, color: colors.muted },
  nota: { ...type.bodySm, color: colors.muted, marginTop: 2 },
});
