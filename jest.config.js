// Libs de RN publicadas como ESM necesitan pasar por Babel en tests.
const modulesToTransform = [
  '(jest-)?react-native',
  '@react-native(-community)?',
  '@react-navigation',
  'react-native-screens',
  'react-native-safe-area-context',
  'react-native-toast-message',
  'react-native-vector-icons',
  '@react-native-async-storage',
  '@react-native-documents',
].join('|');

module.exports = {
  preset: '@react-native/jest-preset',
  transformIgnorePatterns: [`node_modules/(?!(${modulesToTransform})/)`],
};
module.exports.setupFiles = ['./jest.setup.js', '<rootDir>/node_modules/@react-native-documents/picker/jest/build/jest/setup.js'];
