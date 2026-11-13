import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../components/Button';
import { RegistroItem } from '../components/RegistroItem';
import { RevisionCard } from '../components/RevisionCard';
import { Screen } from '../components/Screen';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useDataStore } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { semantic } from '../theme/tokens';
import { formatFecha, hoy } from '../utils/fechas';
import { modeloWidget } from '../widget/modelo';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inicio'>,
  NativeStackScreenProps<RootStackParamList>
>;

const VERDE = semantic.success.dark;
const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const INICIALES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function HomeScreen({ navigation }: Props) {
  const datos = useDataStore();
  const { areas, actividades, registros, alternarDia, revisiones } = datos;
  const revision = revisiones?.find((r) => r.estado === 'pendiente');
  const metas = modeloWidget(datos, hoy());
  const recientes = [...registros]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn - a.creadoEn)
    .slice(0, 8);
  // Agrupados por día, en el orden en que ya vienen (más reciente primero).
  const porDia: [string, typeof recientes][] = [];
  for (const r of recientes) {
    const ultimo = porDia[porDia.length - 1];
    if (ultimo?.[0] === r.fecha) ultimo[1].push(r);
    else porDia.push([r.fecha, [r]]);
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Vital</Text>
          <Pressable
            onPress={() => navigation.navigate('Ajustes')}
            style={styles.ajustes}
            accessibilityRole="button"
            accessibilityLabel="Ajustes"
          >
            <Icon name="cog-outline" size={iconSize.md} color={colors.muted} />
          </Pressable>
        </View>
        <Text style={styles.mensaje}>No tienes que hacerlo todo hoy.</Text>

        {revision && <RevisionCard key={revision.semana} revision={revision} />}

        <Button title="Registrar actividad" onPress={() => navigation.navigate('Registro')} />

        <Text style={styles.section}>Esta semana</Text>
        {metas.length ? (
          <View style={styles.card}>
            <View style={styles.fila}>
              {INICIALES.map((l, i) => (
                <Text key={i} style={styles.inicial}>
                  {l}
                </Text>
              ))}
            </View>
            {metas.map((m) => {
              const cumplida = m.hechos >= m.meta;
              return (
                <View key={m.actividadId} style={styles.meta}>
                  <View style={styles.metaHeader}>
                    <View style={[styles.punto, { backgroundColor: m.color }]} />
                    <Text style={styles.metaNombre} numberOfLines={1}>
                      {m.nombre}
                    </Text>
                    <Text style={[styles.contador, cumplida && { color: VERDE }]}>
                      {cumplida ? '✓ ' : ''}
                      {m.hechos}/{m.meta}
                    </Text>
                  </View>
                  <View style={styles.fila}>
                    {m.dias.map((d) => (
                      <Pressable
                        key={d.fecha}
                        disabled={d.futuro}
                        // Igual que el widget: si el registro tiene detalles, se edita en vez de desmarcar.
                        onPress={() => {
                          const conDetalle = d.conDetalle && registros.find((r) => r.actividadId === m.actividadId && r.fecha === d.fecha);
                          if (conDetalle) navigation.navigate('Registro', { registroId: conDetalle.id });
                          else alternarDia(m.actividadId, d.fecha);
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: d.hecho, disabled: d.futuro }}
                        accessibilityLabel={`${m.nombre}, día ${d.numero}`}
                        style={[
                          styles.celda,
                          d.hecho && styles.celdaHecha,
                          d.esHoy && styles.celdaHoy,
                          d.futuro && styles.celdaFutura,
                        ]}
                      >
                        <Text style={[styles.numero, d.esHoy && { color: colors.primary }]}>{d.numero}</Text>
                        <Text style={styles.check}>{d.hecho ? '✓' : ' '}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.body}>
              Registra lo que vayas haciendo. Al cerrar la semana (domingo en la noche) te propongo una o dos metas
              ligeras para la siguiente.
            </Text>
          </View>
        )}

        <Text style={styles.section}>Recientes</Text>
        {porDia.length ? (
          porDia.map(([fecha, regs]) => (
            <View key={fecha}>
              <Text style={styles.dia}>{capitalizar(formatFecha(fecha, { weekday: 'long', day: 'numeric', month: 'short' }))}</Text>
              {regs.map((r) => {
                const actividad = actividades.find((a) => a.id === r.actividadId);
                return (
                  <RegistroItem
                    key={r.id}
                    registro={r}
                    actividad={actividad}
                    area={areas.find((a) => a.id === actividad?.areaId)}
                    onPress={() => navigation.navigate('Registro', { registroId: r.id })}
                    sinFecha
                  />
                );
              })}
            </View>
          ))
        ) : (
          <Text style={styles.vacio}>Aún no hay registros. Cuando hagas algo que te importe, anótalo aquí.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.huge, gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...type.display, color: colors.text },
  ajustes: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  mensaje: { ...type.body, color: colors.muted, marginBottom: spacing.xs },
  section: { ...type.h2, color: colors.text, marginTop: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  fila: { flexDirection: 'row', gap: 4 },
  inicial: { flex: 1, textAlign: 'center', ...type.caption, color: colors.muted },
  meta: { gap: 6, marginTop: spacing.xs },
  metaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  punto: { width: 8, height: 8, borderRadius: 4 },
  metaNombre: { flex: 1, ...type.body, fontWeight: '600', color: colors.text },
  contador: { ...type.label, color: colors.muted },
  celda: {
    flex: 1,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celdaHecha: { backgroundColor: `${VERDE}29` },
  celdaHoy: { borderWidth: 2, borderColor: colors.primary },
  celdaFutura: { opacity: 0.4 },
  numero: { ...type.caption, color: colors.muted },
  check: { fontSize: 18, lineHeight: 22, fontWeight: '700', color: VERDE },
  body: { ...type.bodySm, color: colors.text },
  dia: { ...type.label, color: colors.muted, textTransform: 'uppercase', marginTop: spacing.xs },
  vacio: { ...type.bodySm, color: colors.muted },
});
