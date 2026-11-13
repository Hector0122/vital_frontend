import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  construirEntradaEnfoque,
  proponerEnfoque,
  type PropuestaEnfoque,
} from '../services/enfoque';
import { useDataStore } from '../stores/dataStore';
import { colors, iconSize, radius, spacing, type } from '../theme';
import { diasDeSemana, hoy } from '../utils/fechas';
import { Button } from './Button';
import { MetasPropuestas } from './MetasPropuestas';

/** "Esta semana me quiero enfocar en…": la IA (o reglas, sin conexión) reacomoda las metas. */
export function EnfoqueCard() {
  const semana = diasDeSemana(hoy())[0];
  const enfoque = useDataStore(s => s.enfoques?.[semana]);
  const [modo, setModo] = useState<
    'idle' | 'escribiendo' | 'pensando' | 'propuesta'
  >('idle');
  const [texto, setTexto] = useState('');
  const [propuesta, setPropuesta] = useState<PropuestaEnfoque>();

  const pedir = async () => {
    setModo('pensando');
    const p = await proponerEnfoque(
      construirEntradaEnfoque(useDataStore.getState(), texto, hoy()),
    );
    setPropuesta(p);
    setModo('propuesta');
  };

  if (modo === 'idle') {
    return (
      <Pressable
        style={styles.fila}
        onPress={() => {
          setTexto(enfoque ?? '');
          setModo('escribiendo');
        }}
        accessibilityRole="button"
      >
        <Icon name="target" size={iconSize.sm} color={colors.primary} />
        <Text
          style={[styles.flex, enfoque ? styles.enfoque : styles.invitacion]}
          numberOfLines={2}
        >
          {enfoque
            ? `Tu enfoque: “${enfoque}”`
            : '¿En qué te quieres enfocar esta semana?'}
        </Text>
        <Text style={styles.link}>{enfoque ? 'Cambiar' : 'Escribir'}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      {modo === 'propuesta' && propuesta ? (
        <>
          <Text style={styles.mensaje}>{propuesta.mensaje}</Text>
          {propuesta.metas.length ? (
            <MetasPropuestas
              sugerencias={propuesta.metas}
              onUsar={metas => {
                useDataStore.getState().aplicarMetas(metas);
                useDataStore.getState().guardarEnfoque(semana, texto.trim());
                Toast.show({
                  type: 'success',
                  text1: 'Metas ajustadas a tu enfoque',
                });
                setModo('idle');
              }}
              onCancelar={() => setModo('idle')}
              textoCancelar="Dejar como estaba"
            />
          ) : (
            <Button
              title="Entendido"
              variant="ghost"
              onPress={() => setModo('escribiendo')}
            />
          )}
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={texto}
            onChangeText={setTexto}
            placeholder="Ej. esta semana quiero dibujar más y descansar"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={300}
            autoFocus
            editable={modo !== 'pensando'}
          />
          {modo === 'pensando' ? (
            <ActivityIndicator color={colors.primary} style={styles.cargando} />
          ) : (
            <>
              <Button
                title="Ajustar mis metas"
                onPress={pedir}
                disabled={!texto.trim()}
              />
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setModo('idle')}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
  },
  flex: { flex: 1 },
  invitacion: { ...type.bodySm, color: colors.muted },
  enfoque: { ...type.bodySm, color: colors.text, fontStyle: 'italic' },
  link: { ...type.label, color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  mensaje: { ...type.body, color: colors.text },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
    textAlignVertical: 'top',
    ...type.body,
  },
  cargando: { marginVertical: spacing.sm },
});
