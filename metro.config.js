const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Absolute paths: Xcode's release bundling phase runs Metro from ios/, so
// cwd-relative paths silently miss the CSS and ship an unstyled app.
module.exports = withNativeWind(config, {
  input: path.join(__dirname, 'src/global.css'),
  configPath: path.join(__dirname, 'tailwind.config.js'),
});
