import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RegistroItem } from '../components/RegistroItem';
import { Screen } from '../components/Screen';
import type { MainTabParamList } from '../navigation/types';
import { useDataStore } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { formatDuracion } from '../utils/catalogo';
import { diasDeSemana, formatFecha, hoy, parseIso } from '../utils/fechas';
import { resumenSemana, veces } from '../utils/resumen';

type Props = BottomTabScreenProps<MainTabParamList, 'Semana'>;

const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function SemanaScreen({ navigation }: Props) {
  const { areas, actividades, registros } = useDataStore();
  const [offset, setOffset] = useState(0); // 0 = esta semana, -1 = la anterior…
  const [diaElegido, setDiaElegido] = useState<string>();

  const dias = diasDeSemana(hoy(), offset);
  const { porDia, porArea, frase } = resumenSemana(registros, actividades, areas, dias);
  const dia = diaElegido && dias.includes(diaElegido) ? diaElegido : undefined;

  const actividadDe = (id: string) => actividades.find((a) => a.id === id);
  const areaDe = (areaId?: string) => areas.find((a) => a.id === areaId);

  const rango = `${parseIso(dias[0]).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${parseIso(
    dias[6],
  ).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Mi semana</Text>

        <View style={styles.nav}>
          <Pressable onPress={() => setOffset(offset - 1)} hitSlop={12} accessibilityLabel="Semana anterior">
            <Icon name="chevron-left" size={iconSize.lg} color={colors.muted} />
          </Pressable>
          <Text style={styles.rango}>{offset === 0 ? `Esta semana · ${rango}` : rango}</Text>
          <Pressable
            onPress={() => setOffset(offset + 1)}
            disabled={offset === 0}
            hitSlop={12}
            accessibilityLabel="Semana siguiente"
            style={offset === 0 && styles.oculto}
          >
            <Icon name="chevron-right" size={iconSize.lg} color={colors.muted} />
          </Pressable>
        </View>

        {/* Días: puntos del color de cada área presente; sin registro = círculo vacío neutro. */}
        <View style={styles.dias}>
          {dias.map((d, i) => {
            const areasDelDia = [...new Set(porDia[d].map((r) => actividadDe(r.actividadId)?.areaId))]
              .map(areaDe)
              .filter(Boolean);
            const elegido = d === dia;
            return (
              <Pressable
                key={d}
                style={[styles.dia, elegido && styles.diaElegido]}
                onPress={() => setDiaElegido(elegido ? undefined : d)}
                accessibilityRole="button"
                accessibilityLabel={`${formatFecha(d)}: ${porDia[d].length ? veces(porDia[d].length) : 'sin registros'}`}
              >
                <Text style={styles.inicial}>{INICIALES[i]}</Text>
                <Text style={[styles.numero, d === hoy() && { color: colors.primary }]}>{parseIso(d).getDate()}</Text>
                <View style={styles.puntos}>
                  {areasDelDia.length ? (
                    areasDelDia.slice(0, 3).map((a) => <View key={a!.id} style={[styles.punto, { backgroundColor: a!.color }]} />)
                  ) : (
                    <View style={[styles.punto, styles.puntoVacio]} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {dia ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{formatFecha(dia)}</Text>
            {porDia[dia].length ? (
              porDia[dia].map((r) => {
                const actividad = actividadDe(r.actividadId);
                return (
                  <RegistroItem
                    key={r.id}
                    registro={r}
                    actividad={actividad}
                    area={areaDe(actividad?.areaId)}
                    onPress={() => navigation.navigate('Registro', { registroId: r.id })}
                  />
                );
              })
            ) : (
              <Text style={styles.muted}>No hay registros.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.fraseCard}>
          <Text style={styles.frase}>{frase}</Text>
        </View>

        {porArea.map(({ area, veces: total, actividades: acts }) => (
          <View key={area.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name={area.icono} size={iconSize.sm} color={area.color} />
              <Text style={[styles.cardTitle, styles.flex]}>{area.nombre}</Text>
              <Text style={styles.muted}>{veces(total)}</Text>
            </View>
            {acts.map(({ actividad, veces: n, minutos }) => (
              <View key={actividad.id} style={styles.fila}>
                <Text style={[styles.body, styles.flex]} numberOfLines={1}>
                  {actividad.nombre}
                </Text>
                {/* Un punto por vez: presencia, no progreso. */}
                <View style={styles.puntosFila} accessibilityLabel={veces(n)}>
                  {Array.from({ length: Math.min(n, 7) }, (_, k) => (
                    <View key={k} style={[styles.puntoVez, { backgroundColor: area.color }]} />
                  ))}
                  {n > 7 && <Text style={styles.muted}>+{n - 7}</Text>}
                </View>
                <Text style={styles.minutos}>{minutos ? formatDuracion(minutos) : ''}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.huge, gap: spacing.sm },
  title: { ...type.h1, color: colors.text },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rango: { ...type.label, color: colors.muted, textTransform: 'uppercase' },
  oculto: { opacity: 0 },
  dias: { flexDirection: 'row', justifyContent: 'space-between' },
  dia: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginHorizontal: 2,
    borderRadius: radius.sm,
    gap: 4,
    minHeight: 72,
  },
  diaElegido: { backgroundColor: colors.surface },
  inicial: { ...type.caption, color: colors.muted },
  numero: { ...type.body, color: colors.text },
  puntos: { flexDirection: 'row', gap: 3, height: 8 },
  punto: { width: 8, height: 8, borderRadius: 4 },
  puntoVacio: { borderWidth: 1, borderColor: colors.border },
  fraseCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  frase: { ...type.body, fontSize: 17, lineHeight: 24, color: colors.text },
  flex: { flex: 1 },
  puntosFila: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  puntoVez: { width: 10, height: 10, borderRadius: 5 },
  minutos: { ...type.caption, color: colors.muted, width: 64, textAlign: 'right' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { ...type.label, color: colors.text, textTransform: 'uppercase' },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 36 },
  body: { ...type.bodySm, color: colors.text },
  muted: { ...type.bodySm, color: colors.muted },
});
