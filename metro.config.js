// Metro ne connaît pas .glb par défaut : sans cette ligne, require('...glb') échoue.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('glb', 'gltf');

module.exports = config;
