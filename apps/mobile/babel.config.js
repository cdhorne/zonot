module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its worklets babel plugin via react-native-worklets;
    // must stay LAST in the plugins list.
    plugins: ['react-native-worklets/plugin'],
  };
};
