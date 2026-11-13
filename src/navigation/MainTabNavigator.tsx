import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { HomeScreen } from '../screens/HomeScreen';
import { SemanaScreen } from '../screens/SemanaScreen';
import { colors, fontFamily, iconSize } from '../theme';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Inicio: 'home-variant-outline',
  Semana: 'calendar-week',
};

function TabIcon({ routeName, color }: { routeName: keyof MainTabParamList; color: string }) {
  return <Icon name={TAB_ICONS[routeName]} size={iconSize.md} color={color} />;
}

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fontFamily.mono },
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBarIcon: ({ color }) => <TabIcon routeName={route.name} color={color} />,
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Semana" component={SemanaScreen} options={{ title: 'Mi semana' }} />
    </Tab.Navigator>
  );
}
