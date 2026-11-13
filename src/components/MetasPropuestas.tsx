import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDataStore, type Sugerencia } from '../stores/dataStore';
import { colors, iconSize, spacing, type } from '../theme';
import { Button } from './Button';

interface Props {
  sugerencias: Sugerencia[];
  onUsar: (metas: { actividadId: string; veces: number }[]) => void;
  onCancelar: () => void;
  textoCancelar?: string;
}

/** Metas propuestas (revisión o enfoque): cada una se acepta o no y se ajusta con −/+. */
export function MetasPropuestas({
  sugerencias,
  onUsar,
  onCancelar,
  textoCancelar = 'Ahora no',
}: Props) {
  const actividades = useDataStore(s => s.actividades);
  const [metas, setMetas] = useState(() =>
    sugerencias.map(s => ({ ...s, aceptada: true })),
  );
  const aceptadas = metas.filter(m => m.aceptada);
  const cambiar = (i: number, cambios: Partial<(typeof metas)[number]>) =>
    setMetas(ms => ms.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

  return (
    <>
      {metas.map((m, i) => {
        const nombre =
          actividades.find(a => a.id === m.actividadId)?.nombre ?? 'Actividad';
        return (
          <View
            key={m.actividadId}
            style={[styles.meta, !m.aceptada && styles.metaOff]}
          >
            <Pressable
              onPress={() => cambiar(i, { aceptada: !m.aceptada })}
              style={styles.check}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: m.aceptada }}
              accessibilityLabel={nombre}
            >
              <Icon
                name={
                  m.aceptada
                    ? 'checkbox-marked-circle'
                    : 'checkbox-blank-circle-outline'
                }
                size={iconSize.md}
                color={m.aceptada ? colors.primary : colors.muted}
              />
            </Pressable>
            <View style={styles.flex}>
              <Text style={styles.nombre}>{nombre}</Text>
              {m.motivo ? <Text style={styles.motivo}>{m.motivo}</Text> : null}
            </View>
            <Pressable
              onPress={() => cambiar(i, { veces: Math.max(1, m.veces - 1) })}
              style={styles.paso}
              accessibilityLabel="Menos"
              hitSlop={6}
            >
              <Icon name="minus" size={iconSize.sm} color={colors.muted} />
            </Pressable>
            <Text style={styles.veces}>{m.veces}×</Text>
            <Pressable
              onPress={() => cambiar(i, { veces: Math.min(7, m.veces + 1) })}
              style={styles.paso}
              accessibilityLabel="Más"
              hitSlop={6}
            >
              <Icon name="plus" size={iconSize.sm} color={colors.muted} />
            </Pressable>
          </View>
        );
      })}
      <Button
        title={
          aceptadas.length
            ? `Usar ${aceptadas.length === 1 ? 'esta meta' : 'estas metas'}`
            : 'Seguir sin metas'
        }
        onPress={() =>
          onUsar(
            aceptadas.map(({ actividadId, veces }) => ({ actividadId, veces })),
          )
        }
      />
      <Button title={textoCancelar} variant="ghost" onPress={onCancelar} />
    </>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
  },
  metaOff: { opacity: 0.5 },
  check: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  nombre: { ...type.body, color: colors.text, fontWeight: '600' },
  motivo: { ...type.caption, color: colors.muted },
  paso: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  veces: {
    ...type.body,
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
});
