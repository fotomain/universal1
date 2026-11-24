const expoPreset = require("jest-expo/jest-preset");
const rnSetup = require.resolve("@react-native/jest-preset/jest/setup.js");

module.exports = {
  ...expoPreset,
  // the React Native resolver prefers the `react-native` field of a package (react-native-svg/src needs the native `react-native`); our jsdom tests map react-native to react-native-web, so use Jest's own resolver (package `main`, as with Jest 29)
  resolver: undefined,
  // jest-expo 58 + jsdom tests: the RN setup file is run through a wrapper (see jest.rnSetupJsdom.js)
  setupFiles: [require.resolve("./jest.rnSetupJsdom.js"), ...expoPreset.setupFiles.filter((f) => f !== rnSetup), require.resolve("./jest.settleWinterGlobals.js")],
  // helpers that live next to the tests (e.g. __tests__/pm/ui/pmUiTestKit.tsx) are not suites
  testPathIgnorePatterns: ["/node_modules/", "TestKit\\.tsx?$", "/fixtures/", "/_to_delete/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|immer|@reduxjs/.*|redux|reselect|reanimated-color-picker)",
  ],
  moduleNameMapper: {
    "^react-redux$": "<rootDir>/node_modules/react-redux/dist/cjs/index.js",
    "^react-native$": "<rootDir>/jest.reactNativeWeb.js",
    "^react-native-paper-dates$": "<rootDir>/__mocks__/react-native-paper-dates.js",
    "^expo-asset$": "<rootDir>/node_modules/expo-asset",
    // our keys first (the first match wins, as with `preset`)
    ...expoPreset.moduleNameMapper,
  },
};

