import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Inicio: undefined;
  Semana: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList>;
  // Sin params = registro nuevo; con `registroId` = editar; con `actividadId` = preseleccionada.
  Registro: { registroId?: string; actividadId?: string } | undefined;
  Ajustes: undefined;
  Areas: undefined;
};
