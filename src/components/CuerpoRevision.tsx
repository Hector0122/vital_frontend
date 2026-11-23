import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDataStore, type Revision } from '../stores/dataStore';
import { colors, iconSize, spacing, type } from '../theme';
import { diasDeSemana, hoy } from '../utils/fechas';
import { metasDeSemana } from '../utils/resumen';

/**
 * El contenido de "Cómo te fue": por secciones si la revisión las trae (v0.4),
 * o el texto de siempre si es vieja. El estado de las metas lo calcula la app
 * (siempre cierto); la IA solo lo comenta.
 */
export function CuerpoRevision({ revision }: { revision: Revision }) {
  const { actividades, registros, revisiones } = useDataStore();
  const s = revision.secciones;
  if (!s) return <Text style={styles.texto}>{revision.analisis}</Text>;

  const dias = diasDeSemana(revision.semana);
  const metas = metasDeSemana(
    { actividades, revisiones },
    revision.semana,
    hoy(),
  ).flatMap(m => {
    const a = actividades.find(x => x.id === m.actividadId);
    if (!a) return [];
    const hechos = new Set(
      registros
        .filter(r => r.actividadId === a.id && dias.includes(r.fecha))
        .map(r => r.fecha),
    ).size;
    return [{ nombre: a.nombre, meta: m.veces, dias: hechos }];
  });

  return (
    <View style={styles.cuerpo}>
      <Text style={styles.titular}>{s.titular}</Text>

      {s.destacado.map(d => (
        <Fila key={d} icono="star-four-points-outline" texto={d} />
      ))}

      {metas.length || s.metas ? (
        <View style={styles.bloque}>
          <Text style={styles.label}>Tus metas</Text>
          {metas.map(m => (
            <View key={m.nombre} style={styles.meta}>
              <Icon
                name={
                  m.dias >= m.meta
                    ? 'check-circle'
                    : m.dias
                    ? 'circle-half-full'
                    : 'circle-outline'
                }
                size={iconSize.sm}
                color={m.dias >= m.meta ? colors.primary : colors.muted}
              />
              <Text style={[styles.texto, styles.flex]}>{m.nombre}</Text>
              <Text style={styles.muted}>
                {m.dias} de {m.meta}
              </Text>
            </View>
          ))}
          {s.metas ? <Text style={styles.muted}>{s.metas}</Text> : null}
        </View>
      ) : null}

      {s.sentir ? <Fila icono="emoticon-outline" texto={s.sentir} /> : null}

      {s.proxima ? (
        <View style={styles.bloque}>
          <Text style={styles.label}>Para la próxima</Text>
          <Text style={styles.texto}>{s.proxima}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Fila({ icono, texto }: { icono: string; texto: string }) {
  return (
    <View style={styles.fila}>
      <Icon name={icono} size={iconSize.sm} color={colors.primary} />
      <Text style={[styles.texto, styles.flex]}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cuerpo: { gap: spacing.sm },
  titular: {
    ...type.body,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
    color: colors.text,
  },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  bloque: { gap: spacing.xs, marginTop: spacing.xs },
  label: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 28,
  },
  texto: { ...type.bodySm, color: colors.text },
  muted: { ...type.bodySm, color: colors.muted },
  flex: { flex: 1 },
});
