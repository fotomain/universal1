// Native autolinking overrides.
module.exports = {
  dependencies: {
    // iOS-only library: its Android project is an empty shell that does not
    // build with the current Android Gradle Plugin, so skip it on Android.
    'react-native-viewdrop-ios': {
      platforms: { android: null },
    },
  },
};
