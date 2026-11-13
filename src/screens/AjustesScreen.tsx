import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/types';
import { exportarRespaldo, importarRespaldo } from '../services/backup';
import { borrarFotosHuerfanas } from '../services/fotos';
import { fotosEnUso, useDataStore } from '../stores/dataStore';
import { colors, spacing, type } from '../theme';

export function AjustesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Ajustes'>) {
  const [ocupado, setOcupado] = useState(false);

  const exportar = async () => {
    setOcupado(true);
    try {
      const { areas, actividades, registros } = useDataStore.getState();
      if (await exportarRespaldo({ areas, actividades, registros })) {
        Toast.show({ type: 'success', text1: 'Respaldo guardado' });
      }
    } catch (e) {
      Alert.alert('No se pudo exportar', String((e as Error)?.message ?? e));
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = () =>
    Alert.alert(
      '¿Restaurar un respaldo?',
      'Se reemplazarán todas tus áreas, actividades y registros actuales por los del archivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir archivo',
          onPress: async () => {
            setOcupado(true);
            try {
              const datos = await importarRespaldo();
              if (!datos) return;
              useDataStore.getState().reemplazarTodo(datos);
              await borrarFotosHuerfanas(fotosEnUso(datos.registros));
              Toast.show({ type: 'success', text1: 'Respaldo restaurado', text2: `${datos.registros.length} registros` });
            } catch (e) {
              Alert.alert('No se pudo restaurar', String((e as Error)?.message ?? e));
            } finally {
              setOcupado(false);
            }
          },
        },
      ],
    );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.section}>Tus áreas</Text>
      <Text style={styles.body}>Crea, edita, reordena u oculta áreas y actividades.</Text>
      <Button title="Áreas y actividades" variant="ghost" onPress={() => navigation.navigate('Areas')} />

      <Text style={[styles.section, styles.separado]}>Respaldo</Text>
      <Text style={styles.body}>
        Tus datos viven solo en este teléfono. Guarda de vez en cuando un respaldo (registros, notas y fotos) en
        Descargas o en Drive para no perderlos si cambias de teléfono.
      </Text>
      <Button title="Exportar respaldo" onPress={exportar} disabled={ocupado} />
      <Button title="Restaurar respaldo" variant="ghost" onPress={restaurar} disabled={ocupado} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.background, flexGrow: 1 },
  section: { ...type.h2, color: colors.text },
  separado: { marginTop: spacing.lg },
  body: { ...type.bodySm, color: colors.muted, marginBottom: spacing.xs },
});
