import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, BackHandler, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { DateField } from '../components/DateField';
import { Screen } from '../components/Screen';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { borrarFotosHuerfanas, elegirFoto, fotoUri } from '../services/fotos';
import { sincronizar } from '../services/nube';
import { fotosEnUso, useDataStore } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { areasConActividades, DURACIONES, formatDuracion, frecuentes, SENSACIONES } from '../utils/catalogo';
import { hoy } from '../utils/fechas';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Registro'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Dos pasos: 1) qué hiciste, 2) detalles opcionales. Editar entra directo al paso 2. */
export function RegistroScreen({ navigation, route }: Props) {
  const { registroId, actividadId } = route.params ?? {};
  const { areas, actividades, registros, agregarRegistros, editarRegistro, borrarRegistro } = useDataStore();
  const editando = registros.find((r) => r.id === registroId);

  const [paso, setPaso] = useState<1 | 2>(1);
  const [seleccion, setSeleccion] = useState<string[]>([]);
  const [fecha, setFecha] = useState(hoy());
  const [duracion, setDuracion] = useState('');
  const [nota, setNota] = useState('');
  const [sensacion, setSensacion] = useState<string>();
  const [fotos, setFotos] = useState<string[]>([]);

  const reiniciar = (e = editando, preseleccion = actividadId) => {
    setSeleccion(e ? [e.actividadId] : preseleccion ? [preseleccion] : []);
    setPaso(e || preseleccion ? 2 : 1);
    setFecha(e?.fecha ?? hoy());
    setDuracion(e?.duracionMin ? String(e.duracionMin) : '');
    setNota(e?.nota ?? '');
    setSensacion(e?.sensacion);
    setFotos(e?.fotos ?? []);
  };

  // Cada vez que cambia lo que se pide (nuevo / editar / preseleccionado).
  useEffect(() => {
    reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registroId, actividadId]);

  // El botón atrás de Android en el paso 2 vuelve al paso 1.
  useEffect(() => {
    if (paso !== 2 || editando) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPaso(1);
      return true;
    });
    return () => sub.remove();
  }, [paso, editando]);

  const salir = () => {
    reiniciar(undefined, undefined);
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
    sincronizar();
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
          sincronizar();
          salir();
        },
      },
    ]);

  const elegidas = seleccion.map((id) => actividades.find((a) => a.id === id)).filter(Boolean);
  const colorDe = (areaId?: string) => areas.find((a) => a.id === areaId)?.color;
  const masUsadas = frecuentes(registros, actividades);

  if (paso === 1) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.paso}>Paso 1 de 2</Text>
          <Text style={styles.title}>¿Qué hiciste?</Text>
          <Text style={styles.hint}>Puedes elegir varias.</Text>

          {masUsadas.length ? (
            <View style={styles.section}>
              <Text style={[styles.label, styles.labelPrimario]}>Frecuentes</Text>
              <View style={styles.wrap}>
                {masUsadas.map((a) => (
                  <Chip
                    key={a.id}
                    label={a.nombre}
                    icono={a.icono}
                    color={colorDe(a.areaId)}
                    seleccionado={seleccion.includes(a.id)}
                    onPress={() => alternar(a.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

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

          <Pressable style={styles.link} onPress={() => navigation.navigate('Areas')} accessibilityRole="button">
            <Icon name="pencil-outline" size={iconSize.sm} color={colors.muted} />
            <Text style={styles.linkText}>Editar áreas y actividades</Text>
          </Pressable>
        </ScrollView>
        <View style={styles.pie}>
          <Button
            title={seleccion.length > 1 ? `Continuar (${seleccion.length})` : 'Continuar'}
            onPress={() => setPaso(2)}
            disabled={!seleccion.length}
          />
          {editando && <Button title="Cancelar" variant="ghost" onPress={salir} />}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!editando && <Text style={styles.paso}>Paso 2 de 2</Text>}
        <Text style={styles.title}>{editando ? 'Editar registro' : 'Detalles'}</Text>
        {!editando && <Text style={styles.hint}>Todo es opcional. Puedes registrar ya.</Text>}

        <Pressable style={styles.resumen} onPress={() => setPaso(1)} accessibilityRole="button" accessibilityHint="Cambiar actividades">
          <View style={[styles.wrap, styles.flex]}>
            {elegidas.map((a) => (
              <View key={a!.id} style={styles.elegida}>
                <Icon name={a!.icono} size={iconSize.sm} color={colorDe(a!.areaId) ?? colors.primary} />
                <Text style={styles.elegidaText}>{a!.nombre}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cambiar}>Cambiar</Text>
        </Pressable>

        <Text style={styles.label}>Fecha</Text>
        <DateField value={fecha} onChange={setFecha} />

        <Text style={styles.label}>Duración</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filaScroll}>
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
            value={DURACIONES.map(String).includes(duracion) ? '' : duracion}
            onChangeText={(t) => setDuracion(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="otro"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Duración en minutos"
          />
        </ScrollView>

        <Text style={styles.label}>
          ¿Cómo te sentiste?{sensacion ? <Text style={styles.sensacionElegida}> · {sensacion}</Text> : null}
        </Text>
        <View style={styles.sensaciones}>
          {SENSACIONES.map(([s, icono]) => {
            const activa = sensacion === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSensacion(activa ? undefined : s)}
                style={[styles.sensacion, activa && styles.sensacionActiva]}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
                accessibilityLabel={s}
              >
                <Icon name={icono} size={iconSize.md} color={activa ? colors.primary : colors.muted} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Nota</Text>
        <TextInput
          style={[styles.input, styles.nota]}
          value={nota}
          onChangeText={setNota}
          multiline
          placeholder="Algo que quieras recordar…"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.label}>Fotos</Text>
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

        {editando && <Button title="Borrar registro" variant="ghost" onPress={borrar} style={styles.borrar} />}
      </ScrollView>
      <View style={styles.pie}>
        <Button
          title={editando ? 'Guardar cambios' : seleccion.length > 1 ? `Registrar ${seleccion.length}` : 'Registrar'}
          onPress={guardar}
          disabled={!seleccion.length}
        />
        <Button title={editando ? 'Cancelar' : 'Atrás'} variant="ghost" onPress={editando ? salir : () => setPaso(1)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.xs },
  paso: { ...type.label, color: colors.primary, textTransform: 'uppercase' },
  title: { ...type.h1, color: colors.text },
  hint: { ...type.bodySm, color: colors.muted, marginBottom: spacing.xs },
  section: { gap: spacing.xs },
  label: { ...type.label, color: colors.muted, marginTop: spacing.sm, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  flex: { flex: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, marginTop: spacing.md },
  linkText: { ...type.bodySm, color: colors.muted, textDecorationLine: 'underline' },
  pie: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  resumen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 56,
  },
  elegida: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  elegidaText: { ...type.body, color: colors.text },
  cambiar: { ...type.label, color: colors.primary },
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
  filaScroll: { gap: spacing.xs, alignItems: 'center' },
  labelPrimario: { color: colors.primary },
  sensacionElegida: { color: colors.primary },
  sensaciones: { flexDirection: 'row', justifyContent: 'space-between' },
  sensacion: {
    width: 56,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  sensacionActiva: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
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
  borrar: { marginTop: spacing.lg },
});
