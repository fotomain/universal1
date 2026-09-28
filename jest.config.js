module.exports = {
  preset: "jest-expo",
  // helpers that live next to the tests (e.g. __tests__/pm/ui/pmUiTestKit.tsx) are not suites
  testPathIgnorePatterns: ["/node_modules/", "TestKit\\.tsx?$", "/_to_delete/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  moduleNameMapper: {
    "^react-native$": "react-native-web",
  },
};
