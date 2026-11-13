import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { formatFecha, parseIso, toIso } from '../utils/fechas';

/** Campo de fecha (versión Android de varo_frontend/src/components/DateField.tsx). */
export function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Pressable style={styles.field} onPress={() => setAbierto(true)} accessibilityRole="button" accessibilityLabel="Cambiar fecha">
        <Text style={styles.text}>{formatFecha(value)}</Text>
        <Icon name="calendar" size={iconSize.sm} color={colors.muted} />
      </Pressable>
      {abierto && (
        <DateTimePicker
          value={parseIso(value)}
          mode="date"
          maximumDate={new Date()}
          onChange={(event, fecha) => {
            setAbierto(false);
            if (event.type === 'set' && fecha) onChange(toIso(fecha));
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  text: { ...type.body, color: colors.text, textTransform: 'capitalize' },
});
