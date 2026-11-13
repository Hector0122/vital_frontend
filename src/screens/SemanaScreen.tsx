import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Screen } from '../components/Screen';
import { colors, spacing, type } from '../theme';

export function SemanaScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Mi semana</Text>
      <Text style={styles.body}>Así se repartió tu tiempo.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.h1, color: colors.text, padding: spacing.md },
  body: { ...type.body, color: colors.muted, paddingHorizontal: spacing.md },
});
