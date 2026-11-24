// `react-native` in the jsdom tests = react-native-web (jest.config.js moduleNameMapper). react-native-svg 15.16 (Expo SDK 58) takes
// `codegenNativeComponent` / `codegenNativeCommands` from the public `react-native` module (new in RN 0.88); react-native-web has neither.
// Same as the native mock: the component is its native name (a host tag). Loaded lazily by the first `import 'react-native'`, so a test's
// jest.mock('react-native-web/...') is registered before react-native-web is evaluated.
const rnWeb = require('react-native-web');
if (!rnWeb.codegenNativeComponent) {
  Object.defineProperty(rnWeb, 'codegenNativeComponent', { configurable: true, enumerable: true, value: (name) => name });
}
if (!rnWeb.codegenNativeCommands) {
  Object.defineProperty(rnWeb, 'codegenNativeCommands', { configurable: true, enumerable: true, value: () => ({}) });
}
module.exports = rnWeb;
