/**
 * Vital — punto de entrada de la app.
 * @format
 */
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { RootNavigator } from './src/navigation/RootNavigator';
import { checkForUpdate } from './src/services/updates';

function App() {
  useEffect(() => {
    checkForUpdate();
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
