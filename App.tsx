/**
 * Vital — punto de entrada de la app.
 * @format
 */
import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './src/navigation/RootNavigator';
import { alHidratar, sincronizar } from './src/services/nube';
import { checkForUpdate } from './src/services/updates';
import { useDataStore } from './src/stores/dataStore';
import { actualizarWidget } from './src/widget/widgetTaskHandler';

function App() {
  useEffect(() => {
    checkForUpdate();
    alHidratar(() => {
      sincronizar();
      actualizarWidget();
    });
    // Cualquier cambio en la app se refleja en el widget.
    const quitarSub = useDataStore.subscribe(() => actualizarWidget());
    // Al volver a la app: recargar por si se marcó algo desde el widget.
    const quitarAppState = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') useDataStore.persist.rehydrate();
    });
    return () => {
      quitarSub();
      quitarAppState.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <RootNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}

export default App;
