const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// cloud-worker/ es un proyecto aparte (Cloudflare Worker); Metro no debe vigilarlo.
const config = {
  resolver: { blockList: [/cloud-worker\/.*/] },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
