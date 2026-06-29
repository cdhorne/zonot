module.exports = (api) => {
  api.cache(true);
  // babel-preset-expo auto-injects react-native-worklets/plugin (the reanimated-4
  // worklets transform) when the package is installed — adding it manually would
  // double-apply it. Fathom's babel.config likewise omits it.
  return { presets: ['babel-preset-expo'] };
};
