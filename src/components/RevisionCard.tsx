import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDataStore, type Revision } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { diasDeSemana, parseIso } from '../utils/fechas';
import { Button } from './Button';

const corta = (f: string) => parseIso(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

/** Revisión de la semana cerrada: análisis + metas ligeras que se aceptan, ajustan o ignoran. */
export function RevisionCard({ revision }: { revision: Revision }) {
  const { actividades, aplicarRevision, descartarRevision } = useDataStore();
  const [metas, setMetas] = useState(() =>
    revision.sugerencias.map((s) => ({ ...s, aceptada: true })),
  );
  const dias = diasDeSemana(revision.semana);
  const aceptadas = metas.filter((m) => m.aceptada);

  const cambiar = (i: number, cambios: Partial<(typeof metas)[number]>) =>
    setMetas((ms) => ms.map((m, j) => (j === i ? { ...m, ...cambios } : m)));

  const aplicar = () => {
    aplicarRevision(revision.semana, aceptadas.map(({ actividadId, veces }) => ({ actividadId, veces })));
    Toast.show({ type: 'success', text1: aceptadas.length ? 'Metas de la semana listas' : 'Listo' });
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="weather-sunset" size={iconSize.md} color={colors.primary} />
        <Text style={styles.titulo}>
          Tu semana · {corta(dias[0])} – {corta(dias[6])}
        </Text>
      </View>
      <Text style={styles.analisis}>{revision.analisis}</Text>

      {metas.length ? (
        <>
          <Text style={styles.label}>Para esta semana, si te late</Text>
          {metas.map((m, i) => {
            const nombre = actividades.find((a) => a.id === m.actividadId)?.nombre ?? 'Actividad';
            return (
              <View key={m.actividadId} style={[styles.meta, !m.aceptada && styles.metaOff]}>
                <Pressable
                  onPress={() => cambiar(i, { aceptada: !m.aceptada })}
                  style={styles.check}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: m.aceptada }}
                  accessibilityLabel={nombre}
                >
                  <Icon
                    name={m.aceptada ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
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
            title={aceptadas.length ? `Usar ${aceptadas.length === 1 ? 'esta meta' : 'estas metas'}` : 'Seguir sin metas'}
            onPress={aplicar}
          />
          <Button title="Ahora no" variant="ghost" onPress={() => descartarRevision(revision.semana)} />
        </>
      ) : (
        <Button title="Listo" variant="ghost" onPress={() => descartarRevision(revision.semana)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  titulo: { ...type.label, color: colors.primary, textTransform: 'uppercase' },
  analisis: { ...type.body, color: colors.text },
  label: { ...type.label, color: colors.muted, textTransform: 'uppercase', marginTop: spacing.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48 },
  metaOff: { opacity: 0.5 },
  check: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
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
  veces: { ...type.body, color: colors.text, minWidth: 28, textAlign: 'center' },
});
