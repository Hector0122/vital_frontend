import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Button } from '../components/Button';
import type { RootStackParamList } from '../navigation/types';
import { exportarRespaldo, importarRespaldo } from '../services/backup';
import { borrarFotosHuerfanas } from '../services/fotos';
import {
  conectar,
  desconectar,
  leerConfig,
  pendientes,
  respaldarEnNube,
  restaurarDeNube,
  sincronizar,
  useNubeStore,
} from '../services/nube';
import { fotosEnUso, useDataStore } from '../stores/dataStore';
import { colors, radius, spacing, type } from '../theme';

const mensaje = (e: unknown) => String((e as Error)?.message ?? e);

export function AjustesScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, 'Ajustes'>) {
  const [ocupado, setOcupado] = useState(false);
  const [nubeUrl, setNubeUrl] = useState<string | null>(null); // null = sin configurar
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const registros = useDataStore(s => s.registros);
  const subidas = useNubeStore(s => s.subidas);
  const ultimoRespaldo = useNubeStore(s => s.ultimoRespaldo);
  const diasDesdeRespaldo = ultimoRespaldo
    ? Math.floor((Date.now() - ultimoRespaldo) / 86_400_000)
    : null;
  const porSubir = pendientes(fotosEnUso(registros), subidas).subir.length;

  useEffect(() => {
    leerConfig().then(c => setNubeUrl(c?.url ?? null));
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
        const {
          areas,
          actividades,
          registros: regs,
          revisiones,
        } = useDataStore.getState();
        if (
          await exportarRespaldo({
            areas,
            actividades,
            registros: regs,
            revisiones,
          })
        ) {
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
                Toast.show({
                  type: 'success',
                  text1: 'Respaldo restaurado',
                  text2: `${datos.registros.length} registros`,
                });
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
        Toast.show({
          type: 'success',
          text1: 'Conectado',
          text2: 'Subiendo tus fotos…',
        });
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
          ? {
              type: 'info',
              text1: `${fallidas} sin sincronizar`,
              text2: 'Se reintentará más tarde.',
            }
          : { type: 'success', text1: 'Fotos al día' },
      );
    });

  const respaldarAhora = () =>
    conOcupado(async () => {
      try {
        await respaldarEnNube(true);
        Toast.show({ type: 'success', text1: 'Respaldo guardado en la nube' });
      } catch (e) {
        Alert.alert('No se pudo respaldar', mensaje(e));
      }
    });

  const restaurarNube = () =>
    Alert.alert(
      '¿Restaurar desde la nube?',
      'Se reemplazarán tus áreas, actividades y registros actuales por el último respaldo en la nube.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          onPress: () =>
            conOcupado(async () => {
              try {
                const { datos, fallidas } = await restaurarDeNube();
                useDataStore.getState().reemplazarTodo(datos);
                Toast.show({
                  type: fallidas ? 'info' : 'success',
                  text1: 'Respaldo restaurado',
                  text2: fallidas
                    ? `${fallidas} fotos no se pudieron bajar`
                    : `${datos.registros.length} registros`,
                });
              } catch (e) {
                Alert.alert('No se pudo restaurar', mensaje(e));
              }
            }),
        },
      ],
    );

  // El aviso lo programa Android (AvisoDomingo.kt); aquí solo se pide el permiso.
  const activarAviso = async () => {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (r !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Aviso apagado',
          'Puedes activarlo cuando quieras en los ajustes de Android.',
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Abrir ajustes', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
    }
    Toast.show({
      type: 'success',
      text1: 'Aviso activado',
      text2: 'Domingos a las 7 de la noche',
    });
  };

  const quitarNube = () =>
    Alert.alert(
      '¿Desconectar la nube?',
      'Las fotos que ya subiste se quedan en tu bucket; la app deja de subir nuevas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          onPress: async () => {
            await desconectar();
            setNubeUrl(null);
          },
        },
      ],
    );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.section}>Tus áreas</Text>
      <Text style={styles.body}>
        Crea, edita, reordena u oculta áreas y actividades.
      </Text>
      <Button
        title="Áreas y actividades"
        variant="ghost"
        onPress={() => navigation.navigate('Areas')}
      />

      <Text style={[styles.section, styles.separado]}>Aviso del domingo</Text>
      <Text style={styles.body}>
        Un solo aviso a la semana, el domingo a las 7 de la noche, cuando tu
        semana está lista para revisar. Para quitarlo, apaga las notificaciones
        de Vital en los ajustes de Android.
      </Text>
      <Button title="Activar aviso" variant="ghost" onPress={activarAviso} />
      <Button
        title="Ajustes de notificaciones"
        variant="ghost"
        onPress={() => Linking.openSettings()}
      />

      <Text style={[styles.section, styles.separado]}>Respaldo</Text>
      <Text style={styles.body}>
        Tus datos viven solo en este teléfono. Guarda de vez en cuando un
        respaldo (registros, notas y fotos) en Descargas o en Drive para no
        perderlos si cambias de teléfono.
      </Text>
      <Button title="Exportar respaldo" onPress={exportar} disabled={ocupado} />
      <Button
        title="Restaurar respaldo"
        variant="ghost"
        onPress={restaurar}
        disabled={ocupado}
      />

      <Text style={[styles.section, styles.separado]}>Nube e IA</Text>
      {nubeUrl ? (
        <>
          <Text style={styles.body}>
            Conectado a {nubeUrl.replace('https://', '')}.{' '}
            {porSubir
              ? `${porSubir} foto${porSubir > 1 ? 's' : ''} por subir.`
              : 'Todas tus fotos están en la nube.'}
          </Text>
          <Text style={styles.body}>
            Tus datos se respaldan solos una vez por semana.{' '}
            {diasDesdeRespaldo === null
              ? 'Aún no hay respaldo en la nube.'
              : diasDesdeRespaldo === 0
              ? 'Último respaldo: hoy.'
              : `Último respaldo: hace ${diasDesdeRespaldo} día${
                  diasDesdeRespaldo > 1 ? 's' : ''
                }.`}
          </Text>
          <Button
            title="Sincronizar ahora"
            variant="ghost"
            onPress={subirAhora}
            disabled={ocupado}
          />
          <Button
            title="Respaldar datos ahora"
            variant="ghost"
            onPress={respaldarAhora}
            disabled={ocupado}
          />
          <Button
            title="Restaurar desde la nube"
            variant="ghost"
            onPress={restaurarNube}
            disabled={ocupado}
          />
          <Button
            title="Desconectar"
            variant="ghost"
            onPress={quitarNube}
            disabled={ocupado}
          />
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Opcional: conecta tu Worker (ver cloud-worker/README.md) para
            guardar copia de tus fotos en R2 y recibir la revisión semanal con
            IA. Sin conexión, la revisión se hace con reglas en el teléfono. El
            token se guarda cifrado aquí.
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
          <Button
            title="Conectar"
            onPress={guardarNube}
            disabled={ocupado || !url.trim() || !token.trim()}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.huge,
    gap: spacing.sm,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
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
