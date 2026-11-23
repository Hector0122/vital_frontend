import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDataStore, type Revision } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { diasDeSemana, parseIso } from '../utils/fechas';
import { Button } from './Button';
import { CuerpoRevision } from './CuerpoRevision';
import { MetasPropuestas } from './MetasPropuestas';

const corta = (f: string) =>
  parseIso(f).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

/** Revisión de la semana cerrada: análisis + metas ligeras que se aceptan, ajustan o ignoran. */
export function RevisionCard({ revision }: { revision: Revision }) {
  const { aplicarRevision, descartarRevision } = useDataStore();
  const dias = diasDeSemana(revision.semana);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="weather-sunset" size={iconSize.md} color={colors.primary} />
        <Text style={styles.titulo}>
          Cómo te fue · {corta(dias[0])} – {corta(dias[6])}
        </Text>
      </View>
      <CuerpoRevision revision={revision} />

      {revision.sugerencias.length ? (
        <>
          <Text style={styles.label}>Para la siguiente, si te late</Text>
          <MetasPropuestas
            sugerencias={revision.sugerencias}
            onUsar={metas => {
              aplicarRevision(revision.semana, metas);
              Toast.show({
                type: 'success',
                text1: metas.length ? 'Metas de la semana listas' : 'Listo',
              });
            }}
            onCancelar={() => descartarRevision(revision.semana)}
          />
        </>
      ) : (
        <Button
          title="Listo"
          variant="ghost"
          onPress={() => descartarRevision(revision.semana)}
        />
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
  label: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
});
