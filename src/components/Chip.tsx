import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, iconSize, radius, spacing, type } from '../theme';

interface Props {
  label: string;
  icono?: string;
  color?: string; // acento del área
  seleccionado?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

/** Ficha tocable: actividades, sensación, duración. */
export function Chip({ label, icono, color = colors.primary, seleccionado, onPress, onLongPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!seleccionado }}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.chip, seleccionado && { borderColor: color, backgroundColor: `${color}33` }]}
    >
      {icono && <Icon name={icono} size={iconSize.sm} color={seleccionado ? color : colors.muted} />}
      <Text style={[styles.text, seleccionado && { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  text: { ...type.bodySm, color: colors.muted },
});
