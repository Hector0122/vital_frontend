import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Chip } from '../components/Chip';
import { EditorModal, type ValoresEditor } from '../components/EditorModal';
import { borrarFotosHuerfanas } from '../services/fotos';
import { sincronizar } from '../services/nube';
import {
  fotosEnUso,
  useDataStore,
  type Actividad,
  type Area,
} from '../stores/dataStore';
import { areaHues, colors, iconSize, radius, spacing, type } from '../theme';

type Edicion =
  | { tipo: 'area'; area?: Area }
  | { tipo: 'actividad'; areaId: string; actividad?: Actividad };

export function AreasScreen() {
  const {
    areas,
    actividades,
    registros,
    guardarArea,
    guardarActividad,
    borrarActividad,
    moverArea,
  } = useDataStore();
  const [edicion, setEdicion] = useState<Edicion>();
  const lista = [...areas].sort((a, b) => a.orden - b.orden);

  const inicial: ValoresEditor =
    edicion?.tipo === 'area'
      ? edicion.area ?? {
          nombre: '',
          icono: 'circle-outline', // neutro: cada área elige el suyo en el editor
          // Un color que ninguna área use; si ya están todos, se repite en orden.
          color:
            areaHues.find(c => !areas.some(a => a.color === c)) ??
            areaHues[areas.length % areaHues.length],
          activo: true,
        }
      : edicion?.actividad ?? {
          nombre: '',
          icono: 'circle-outline',
          activo: true,
        };

  // Sin metaSemanal: esa la pone la revisión semanal y aquí se conserva.
  const guardar = ({ nombre, icono, color, activo }: ValoresEditor) => {
    if (edicion?.tipo === 'area')
      guardarArea({
        id: edicion.area?.id,
        nombre,
        icono,
        color: color!,
        activo,
      });
    else if (edicion)
      guardarActividad({
        id: edicion.actividad?.id,
        areaId: edicion.areaId,
        nombre,
        icono,
        activo,
      });
    setEdicion(undefined);
  };

  const borrar = (a: Actividad) => {
    const n = registros.filter(r => r.actividadId === a.id).length;
    const eliminar = () => {
      borrarActividad(a.id);
      borrarFotosHuerfanas(fotosEnUso(useDataStore.getState().registros));
      sincronizar();
      setEdicion(undefined);
    };
    // Con historial, lo normal es ocultarla: borrar se lleva sus registros para siempre.
    Alert.alert(
      `¿Eliminar "${a.nombre}"?`,
      n
        ? `Tiene ${n} registro(s). Si la desactivas deja de aparecer y conservas tu historial; si la eliminas, se borran también sus registros y no se puede deshacer.`
        : 'No se puede deshacer.',
      n
        ? [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Desactivar',
              onPress: () => {
                guardarActividad({ ...a, activo: false });
                setEdicion(undefined);
              },
            },
            {
              text: `Eliminar con ${n} registro(s)`,
              style: 'destructive',
              onPress: eliminar,
            },
          ]
        : [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: eliminar },
          ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Toca un área o actividad para editarla. Desactivar oculta sin borrar
        (tus registros se conservan); eliminar una actividad la borra con sus
        registros.
      </Text>

      {lista.map((area, i) => (
        <View
          key={area.id}
          style={[styles.card, !area.activo && styles.inactiva]}
        >
          <View style={styles.header}>
            <Pressable
              style={styles.headerNombre}
              onPress={() => setEdicion({ tipo: 'area', area })}
              accessibilityRole="button"
              accessibilityHint="Editar área"
            >
              <Icon name={area.icono} size={iconSize.md} color={area.color} />
              <Text style={styles.nombre}>{area.nombre}</Text>
              {!area.activo && <Text style={styles.badge}>oculta</Text>}
            </Pressable>
            <Pressable
              onPress={() => moverArea(area.id, -1)}
              disabled={i === 0}
              hitSlop={8}
              style={styles.flecha}
              accessibilityLabel="Subir"
            >
              <Icon
                name="chevron-up"
                size={iconSize.md}
                color={i === 0 ? colors.border : colors.muted}
              />
            </Pressable>
            <Pressable
              onPress={() => moverArea(area.id, 1)}
              disabled={i === lista.length - 1}
              hitSlop={8}
              style={styles.flecha}
              accessibilityLabel="Bajar"
            >
              <Icon
                name="chevron-down"
                size={iconSize.md}
                color={i === lista.length - 1 ? colors.border : colors.muted}
              />
            </Pressable>
          </View>
          <View style={styles.wrap}>
            {actividades
              .filter(a => a.areaId === area.id)
              .map(a => (
                <Chip
                  key={a.id}
                  label={`${a.nombre}${
                    a.metaSemanal ? ` · ${a.metaSemanal}×` : ''
                  }${a.activo ? '' : ' (oculta)'}`}
                  icono={a.icono}
                  color={area.color}
                  seleccionado={a.activo}
                  onPress={() =>
                    setEdicion({
                      tipo: 'actividad',
                      areaId: area.id,
                      actividad: a,
                    })
                  }
                />
              ))}
            <Chip
              label="Actividad"
              icono="plus"
              onPress={() => setEdicion({ tipo: 'actividad', areaId: area.id })}
            />
          </View>
        </View>
      ))}

      <Chip
        label="Nueva área"
        icono="plus"
        onPress={() => setEdicion({ tipo: 'area' })}
      />

      {edicion && (
        <EditorModal
          key={
            edicion.tipo === 'area'
              ? edicion.area?.id ?? 'nueva-area'
              : edicion.actividad?.id ?? `nueva-${edicion.areaId}`
          }
          visible
          titulo={
            edicion?.tipo === 'area'
              ? edicion.area
                ? 'Editar área'
                : 'Nueva área'
              : edicion?.actividad
              ? 'Editar actividad'
              : 'Nueva actividad'
          }
          inicial={inicial}
          conColor={edicion.tipo === 'area'}
          onGuardar={guardar}
          onCerrar={() => setEdicion(undefined)}
          onBorrar={
            edicion.tipo === 'actividad' && edicion.actividad
              ? () => borrar(edicion.actividad!)
              : undefined
          }
        />
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
  hint: { ...type.bodySm, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  inactiva: { opacity: 0.55 },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerNombre: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
  },
  nombre: { ...type.body, color: colors.text, fontWeight: '600' },
  badge: { ...type.caption, color: colors.muted },
  flecha: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
