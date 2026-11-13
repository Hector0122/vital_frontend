import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import Toast from 'react-native-toast-message';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/types';
import { exportarRespaldo, importarRespaldo } from '../services/backup';
import { borrarFotosHuerfanas } from '../services/fotos';
import { conectar, desconectar, leerConfig, pendientes, sincronizar, useNubeStore } from '../services/nube';
import { fotosEnUso, useDataStore } from '../stores/dataStore';
import { colors, radius, spacing, type } from '../theme';

const mensaje = (e: unknown) => String((e as Error)?.message ?? e);

export function AjustesScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Ajustes'>) {
  const [ocupado, setOcupado] = useState(false);
  const [nubeUrl, setNubeUrl] = useState<string | null>(null); // null = sin configurar
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const registros = useDataStore((s) => s.registros);
  const subidas = useNubeStore((s) => s.subidas);
  const porSubir = pendientes(fotosEnUso(registros), subidas).subir.length;

  useEffect(() => {
    leerConfig().then((c) => setNubeUrl(c?.url ?? null));
  }, []);

  const conOcupado = async (fn: () => Promise<void>) => {
    setOcupado(true);
    try {
      await fn();
    } finally {
      setOcupado(false);
    }
  };

  const exportar = () =>
    conOcupado(async () => {
      try {
        const { areas, actividades, registros: regs, revisiones } = useDataStore.getState();
        if (await exportarRespaldo({ areas, actividades, registros: regs, revisiones })) {
          Toast.show({ type: 'success', text1: 'Respaldo guardado' });
        }
      } catch (e) {
        Alert.alert('No se pudo exportar', mensaje(e));
      }
    });

  const restaurar = () =>
    Alert.alert(
      '¿Restaurar un respaldo?',
      'Se reemplazarán todas tus áreas, actividades y registros actuales por los del archivo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir archivo',
          onPress: () =>
            conOcupado(async () => {
              try {
                const datos = await importarRespaldo();
                if (!datos) return;
                useDataStore.getState().reemplazarTodo(datos);
                await borrarFotosHuerfanas(fotosEnUso(datos.registros));
                sincronizar();
                Toast.show({ type: 'success', text1: 'Respaldo restaurado', text2: `${datos.registros.length} registros` });
              } catch (e) {
                Alert.alert('No se pudo restaurar', mensaje(e));
              }
            }),
        },
      ],
    );

  const guardarNube = () =>
    conOcupado(async () => {
      try {
        await conectar(url, token);
        setNubeUrl((await leerConfig())?.url ?? null);
        setToken('');
        Toast.show({ type: 'success', text1: 'Conectado', text2: 'Subiendo tus fotos…' });
        sincronizar();
      } catch (e) {
        Alert.alert('No se pudo conectar', mensaje(e));
      }
    });

  const subirAhora = () =>
    conOcupado(async () => {
      const fallidas = await sincronizar();
      Toast.show(
        fallidas
          ? { type: 'info', text1: `${fallidas} sin sincronizar`, text2: 'Se reintentará más tarde.' }
          : { type: 'success', text1: 'Fotos al día' },
      );
    });

  const quitarNube = () =>
    Alert.alert('¿Desconectar la nube?', 'Las fotos que ya subiste se quedan en tu bucket; la app deja de subir nuevas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        onPress: async () => {
          await desconectar();
          setNubeUrl(null);
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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

      <Text style={[styles.section, styles.separado]}>Nube e IA</Text>
      {nubeUrl ? (
        <>
          <Text style={styles.body}>
            Conectado a {nubeUrl.replace('https://', '')}.{' '}
            {porSubir ? `${porSubir} foto${porSubir > 1 ? 's' : ''} por subir.` : 'Todas tus fotos están en la nube.'}
          </Text>
          <Button title="Sincronizar ahora" variant="ghost" onPress={subirAhora} disabled={ocupado} />
          <Button title="Desconectar" variant="ghost" onPress={quitarNube} disabled={ocupado} />
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Opcional: conecta tu Worker (ver cloud-worker/README.md) para guardar copia de tus fotos en R2 y recibir
            la revisión semanal con IA. Sin conexión, la revisión se hace con reglas en el teléfono. El token se
            guarda cifrado aquí.
          </Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://vital-cloud.….workers.dev"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="API token"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Button title="Conectar" onPress={guardarNube} disabled={ocupado || !url.trim() || !token.trim()} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.huge, gap: spacing.sm, backgroundColor: colors.background, flexGrow: 1 },
  section: { ...type.h2, color: colors.text },
  separado: { marginTop: spacing.lg },
  body: { ...type.bodySm, color: colors.muted, marginBottom: spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    ...type.body,
  },
});
