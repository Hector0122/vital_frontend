import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { RegistroItem } from '../components/RegistroItem';
import { Screen } from '../components/Screen';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useDataStore } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { areasConActividades } from '../utils/catalogo';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Inicio'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { areas, actividades, registros } = useDataStore();
  const recientes = [...registros]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn - a.creadoEn)
    .slice(0, 8);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Vital</Text>
          <Pressable onPress={() => navigation.navigate('Ajustes')} hitSlop={12} accessibilityLabel="Ajustes">
            <Icon name="cog-outline" size={iconSize.md} color={colors.muted} />
          </Pressable>
        </View>
        <Text style={styles.mensaje}>No tienes que hacerlo todo hoy.</Text>

        <Button title="Registrar actividad" onPress={() => navigation.navigate('Registro')} />

        {areasConActividades(areas, actividades).map(({ area, actividades: acts }) => (
          <View key={area.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Icon name={area.icono} size={iconSize.sm} color={area.color} />
              <Text style={styles.cardTitle}>{area.nombre}</Text>
            </View>
            <View style={styles.wrap}>
              {acts.map((a) => (
                <Chip
                  key={a.id}
                  label={a.nombre}
                  icono={a.icono}
                  color={area.color}
                  onPress={() => navigation.navigate('Registro', { actividadId: a.id })}
                />
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.section}>Recientes</Text>
        {recientes.length ? (
          recientes.map((r) => {
            const actividad = actividades.find((a) => a.id === r.actividadId);
            return (
              <RegistroItem
                key={r.id}
                registro={r}
                actividad={actividad}
                area={areas.find((a) => a.id === actividad?.areaId)}
                onPress={() => navigation.navigate('Registro', { registroId: r.id })}
              />
            );
          })
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
  mensaje: { ...type.body, color: colors.muted, marginBottom: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardTitle: { ...type.label, color: colors.text, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  section: { ...type.h2, color: colors.text, marginTop: spacing.md },
  vacio: { ...type.bodySm, color: colors.muted },
});
