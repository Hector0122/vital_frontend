/* eslint-env jest */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);
jest.mock('react-native-fs', () => ({ DocumentDirectoryPath: '/docs', CachesDirectoryPath: '/cache' }));
jest.mock('react-native-image-picker', () => ({}));
