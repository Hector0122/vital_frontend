import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { Screen } from '../components/Screen';
import type { MainTabParamList } from '../navigation/types';
import { borrarFotosHuerfanas, elegirFoto, fotoUri } from '../services/fotos';
import { fotosEnUso, useDataStore } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { areasConActividades, DURACIONES, formatDuracion, SENSACIONES } from '../utils/catalogo';
import { hoy } from '../utils/fechas';

type Props = BottomTabScreenProps<MainTabParamList, 'Registro'>;

export function RegistroScreen({ navigation, route }: Props) {
  const { registroId, actividadId } = route.params ?? {};
  const { areas, actividades, registros, agregarRegistros, editarRegistro, borrarRegistro } = useDataStore();
  const editando = registros.find((r) => r.id === registroId);

  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [fecha, setFecha] = useState(hoy());
  const [duracion, setDuracion] = useState('');
  const [nota, setNota] = useState('');
  const [sensacion, setSensacion] = useState<string>();
  const [fotos, setFotos] = useState<string[]>([]);

  // Reinicia el formulario cada vez que cambia lo que se pide (nuevo / editar / preseleccionado).
  useEffect(() => {
    setSeleccion(editando ? [editando.actividadId] : actividadId ? [actividadId] : []);
    setFecha(editando?.fecha ?? hoy());
    setDuracion(editando?.duracionMin ? String(editando.duracionMin) : '');
    setNota(editando?.nota ?? '');
    setSensacion(editando?.sensacion);
    setFotos(editando?.fotos ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId, actividadId]);

  const salir = () => {
    navigation.setParams({ registroId: undefined, actividadId: undefined });
    navigation.navigate('Inicio');
  };

  const alternar = (id: string) =>
    setSeleccion((s) => (editando ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const agregarFoto = async (desdeCamara: boolean) => {
    try {
      const nombre = await elegirFoto(desdeCamara);
      if (nombre) setFotos((f) => [...f, nombre]);
    } catch {
      Toast.show({ type: 'error', text1: 'No se pudo agregar la foto' });
    }
  };

  const guardar = () => {
    const min = parseInt(duracion, 10);
    const campos = {
      fecha,
      duracionMin: min > 0 ? min : undefined,
      nota: nota.trim() || undefined,
      sensacion,
      fotos: fotos.length ? fotos : undefined,
    };
    if (editando) editarRegistro(editando.id, { actividadId: seleccion[0], ...campos });
    else agregarRegistros(seleccion, campos);
    // Fotos quitadas del formulario ya no las usa nadie.
    borrarFotosHuerfanas(fotosEnUso(useDataStore.getState().registros));
    Toast.show({ type: 'success', text1: editando ? 'Registro actualizado' : 'Registrado' });
    salir();
  };

  const borrar = () =>
    Alert.alert('¿Borrar este registro?', 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          borrarRegistro(editando!.id);
          borrarFotosHuerfanas(fotosEnUso(useDataStore.getState().registros));
          Toast.show({ type: 'success', text1: 'Registro borrado' });
          salir();
        },
      },
    ]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{editando ? 'Editar registro' : 'Registrar'}</Text>
        <Text style={styles.hint}>
          {editando ? 'Cambia lo que necesites.' : 'Elige una o varias cosas que hiciste. Todo lo demás es opcional.'}
        </Text>

        {areasConActividades(areas, actividades).map(({ area, actividades: acts }) =>
          acts.length ? (
            <View key={area.id} style={styles.section}>
              <Text style={[styles.label, { color: area.color }]}>{area.nombre}</Text>
              <View style={styles.wrap}>
                {acts.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.nombre}
                    icono={a.icono}
                    color={area.color}
                    seleccionado={seleccion.includes(a.id)}
                    onPress={() => alternar(a.id)}
                  />
                ))}
              </View>
            </View>
          ) : null,
        )}

        <Text style={styles.label}>Fecha</Text>
        <DateField value={fecha} onChange={setFecha} />

        <Text style={styles.label}>Duración (opcional)</Text>
        <View style={styles.wrap}>
          {DURACIONES.map((m) => (
            <Chip
              key={m}
              label={formatDuracion(m)}
              seleccionado={duracion === String(m)}
              onPress={() => setDuracion(duracion === String(m) ? '' : String(m))}
            />
          ))}
          <TextInput
            style={[styles.input, styles.minutos]}
            value={duracion}
            onChangeText={(t) => setDuracion(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="min"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Duración en minutos"
          />
        </View>

        <Text style={styles.label}>¿Cómo te sentiste? (opcional)</Text>
        <View style={styles.wrap}>
          {SENSACIONES.map(([s, icono]) => (
            <Chip key={s} label={s} icono={icono} seleccionado={sensacion === s} onPress={() => setSensacion(sensacion === s ? undefined : s)} />
          ))}
        </View>

        <Text style={styles.label}>Nota (opcional)</Text>
        <TextInput
          style={[styles.input, styles.nota]}
          value={nota}
          onChangeText={setNota}
          multiline
          placeholder="Algo que quieras recordar…"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Fotos (opcional)</Text>
        <View style={styles.wrap}>
          {fotos.map((f) => (
            <View key={f}>
              <Image source={{ uri: fotoUri(f) }} style={styles.foto} />
              <Pressable
                style={styles.quitarFoto}
                onPress={() => setFotos((x) => x.filter((y) => y !== f))}
                accessibilityLabel="Quitar foto"
                hitSlop={8}
              >
                <Icon name="close" size={iconSize.sm} color={colors.text} />
              </Pressable>
            </View>
          ))}
          <Chip label="Cámara" icono="camera-outline" onPress={() => agregarFoto(true)} />
          <Chip label="Galería" icono="image-outline" onPress={() => agregarFoto(false)} />
        </View>

        <Button
          title={editando ? 'Guardar cambios' : seleccion.length > 1 ? `Registrar ${seleccion.length}` : 'Registrar'}
          onPress={guardar}
          disabled={!seleccion.length}
          style={styles.guardar}
        />
        {editando && <Button title="Borrar registro" variant="ghost" onPress={borrar} />}
        {(editando || actividadId) && <Button title="Cancelar" variant="ghost" onPress={salir} />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.huge, gap: spacing.xs },
  title: { ...type.h1, color: colors.text },
  hint: { ...type.bodySm, color: colors.muted, marginBottom: spacing.xs },
  section: { gap: spacing.xs },
  label: { ...type.label, color: colors.muted, marginTop: spacing.sm, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    ...type.body,
  },
  minutos: { width: 72, textAlign: 'center' },
  nota: { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.xs },
  foto: { width: 72, height: 72, borderRadius: radius.sm },
  quitarFoto: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.background,
    borderRadius: radius.pill,
    padding: 2,
  },
  guardar: { marginTop: spacing.lg },
});
