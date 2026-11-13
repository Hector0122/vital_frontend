import { DarkTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { AjustesScreen } from '../screens/AjustesScreen';
import { AreasScreen } from '../screens/AreasScreen';
import { RegistroScreen } from '../screens/RegistroScreen';
import { colors } from '../theme';
import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text },
};

// vital://registrar lo abre el atajo del ícono (res/xml/shortcuts.xml).
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['vital://'],
  config: { screens: { Registro: 'registrar' } },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme} linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabNavigator} />
        <Stack.Screen name="Registro" component={RegistroScreen} options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Ajustes" component={AjustesScreen} options={{ headerShown: true, title: 'Ajustes' }} />
        <Stack.Screen name="Areas" component={AreasScreen} options={{ headerShown: true, title: 'Áreas y actividades' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
