/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock('react-native-fs', () => ({ DocumentDirectoryPath: '/docs', CachesDirectoryPath: '/cache' }));
jest.mock('react-native-image-picker', () => ({}));
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {},
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));
jest.mock('react-native-android-widget', () => ({
  FlexWidget: 'FlexWidget',
  TextWidget: 'TextWidget',
  registerWidgetTaskHandler: jest.fn(),
  requestWidgetUpdate: jest.fn(async () => {}),
}));
