/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import App from './App';
import { widgetTaskHandler } from './src/widget/widgetTaskHandler';
import { name as appName } from './app.json';

registerWidgetTaskHandler(widgetTaskHandler);

AppRegistry.registerComponent(appName, () => App);
