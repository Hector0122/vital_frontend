import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { areaHues, colors, iconSize, radius, spacing, type } from '../theme';
import { Button } from './Button';
import { Chip } from './Chip';

// Iconos MDI curados para áreas y actividades (sin buscador: YAGNI).
const ICONOS = [
  'leaf', 'run', 'walk', 'bike', 'swim', 'yoga', 'dumbbell', 'food-apple-outline',
  'palette-outline', 'guitar-electric', 'music-note', 'draw', 'camera-outline', 'lightbulb-outline', 'code-tags', 'hammer-wrench',
  'sprout-outline', 'book-open-variant', 'school-outline', 'translate', 'pencil-outline', 'puzzle-outline',
  'account-group-outline', 'human-male-child', 'home-heart', 'heart-outline', 'map-marker-outline', 'phone-outline', 'dog',
  'weather-night', 'sofa-outline', 'gamepad-variant-outline', 'power-sleep', 'television-classic', 'coffee-outline', 'tree-outline',
];

export interface ValoresEditor {
  nombre: string;
  icono: string;
  color?: string;
  activo: boolean;
  metaSemanal?: number;
}

interface Props {
  visible: boolean;
  titulo: string;
  inicial: ValoresEditor;
  conColor: boolean; // solo las áreas tienen color
  conMeta: boolean; // solo las actividades tienen meta semanal
  onGuardar: (v: ValoresEditor) => void;
  onCerrar: () => void;
}

export function EditorModal({ visible, titulo, inicial, conColor, conMeta, onGuardar, onCerrar }: Props) {
  const [v, setV] = useState(inicial);
  const nombre = v.nombre.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>{titulo}</Text>

            <TextInput
              style={styles.input}
              value={v.nombre}
              onChangeText={(t) => setV({ ...v, nombre: t })}
              placeholder="Nombre"
              placeholderTextColor={colors.muted}
              maxLength={40}
              autoFocus={!inicial.nombre}
            />

            {conColor && (
              <View style={styles.wrap}>
                {areaHues.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setV({ ...v, color: c })}
                    style={[styles.color, { backgroundColor: c }, v.color === c && styles.colorElegido]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: v.color === c }}
                    accessibilityLabel={`Color ${c}`}
                  />
                ))}
              </View>
            )}

            <View style={styles.wrap}>
              {ICONOS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setV({ ...v, icono: ic })}
                  style={[styles.icono, v.icono === ic && { borderColor: v.color ?? colors.primary }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: v.icono === ic }}
                  accessibilityLabel={`Icono ${ic}`}
                >
                  <Icon name={ic} size={iconSize.md} color={v.icono === ic ? v.color ?? colors.primary : colors.muted} />
                </Pressable>
              ))}
            </View>

            {conMeta && (
              <>
                <Text style={styles.body}>Meta semanal (opcional)</Text>
                <Text style={styles.hint}>Con meta, aparece en el widget de la pantalla de inicio.</Text>
                <View style={styles.wrap}>
                  {[undefined, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <Chip
                      key={n ?? 0}
                      label={n ? `${n}×` : 'Sin meta'}
                      seleccionado={v.metaSemanal === n}
                      onPress={() => setV({ ...v, metaSemanal: n })}
                    />
                  ))}
                </View>
              </>
            )}

            <View style={styles.fila}>
              <View style={styles.flex}>
                <Text style={styles.body}>Activa</Text>
                <Text style={styles.hint}>Si la desactivas se oculta, pero sus registros se conservan.</Text>
              </View>
              <Switch
                value={v.activo}
                onValueChange={(activo) => setV({ ...v, activo })}
                trackColor={{ true: colors.primarySoft, false: colors.border }}
                thumbColor={v.activo ? colors.primary : colors.muted}
              />
            </View>

            <Button title="Guardar" disabled={!nombre} onPress={() => onGuardar({ ...v, nombre })} />
            <Button title="Cancelar" variant="ghost" onPress={onCerrar} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  content: { padding: spacing.md, gap: spacing.sm },
  title: { ...type.h2, color: colors.text },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    ...type.body,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  color: { width: 40, height: 40, borderRadius: 20 },
  colorElegido: { borderWidth: 3, borderColor: colors.text },
  icono: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  body: { ...type.body, color: colors.text },
  hint: { ...type.caption, color: colors.muted },
});
