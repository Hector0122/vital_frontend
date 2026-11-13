import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fotoUri } from '../services/fotos';
import type { Actividad, Registro } from '../stores/dataStore';
import { colors, radius, spacing, type } from '../theme';
import { formatFecha } from '../utils/fechas';

interface Props {
  registros: Registro[]; // ya filtrados a la semana
  actividades: Actividad[];
  onAbrir: (registroId: string) => void;
}

/** Fotos y notas de la semana: un pequeño diario. No se muestra si no hay nada. */
export function Recuerdos({ registros, actividades, onAbrir }: Props) {
  const orden = [...registros].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn - b.creadoEn);
  const fotos = orden.flatMap((r) => (r.fotos ?? []).map((f) => ({ f, r })));
  const notas = orden.filter((r) => r.nota);
  if (!fotos.length && !notas.length) return null;
  const nombre = (id: string) => actividades.find((a) => a.id === id)?.nombre ?? '';

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Recuerdos</Text>
      {fotos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tira}>
          {fotos.map(({ f, r }) => (
            <Pressable key={`${r.id}-${f}`} onPress={() => onAbrir(r.id)} accessibilityLabel={`Foto de ${nombre(r.actividadId)}`}>
              <Image source={{ uri: fotoUri(f) }} style={styles.foto} />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {notas.slice(0, 5).map((r) => (
        <Pressable key={r.id} onPress={() => onAbrir(r.id)} style={styles.nota} accessibilityRole="button">
          <Text style={styles.notaTexto} numberOfLines={3}>
            “{r.nota}”
          </Text>
          <Text style={styles.notaPie}>
            {nombre(r.actividadId)} · {formatFecha(r.fecha, { weekday: 'long' })}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: spacing.sm },
  titulo: { ...type.label, color: colors.text, textTransform: 'uppercase' },
  tira: { gap: spacing.xs },
  foto: { width: 104, height: 104, borderRadius: radius.sm },
  nota: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: spacing.sm, paddingVertical: 2 },
  notaTexto: { ...type.bodySm, color: colors.text, fontStyle: 'italic' },
  notaPie: { ...type.caption, color: colors.muted },
});
