// jest-expo 58 (Expo SDK 58 / Jest 30): the React Native setup file (`@react-native/jest-preset/jest/setup.js`) redefines `global.window`.
// That works in the `node` environment it was made for, but our tests run in jsdom (`@jest-environment jsdom`), where `window` is not
// configurable: "TypeError: Cannot redefine property: window". Run the original setup with `window` left alone when it already exists.
const original = Object.defineProperties;
Object.defineProperties = function patched(target, props) {
  if (target === global && props && props.window) {
    const current = Object.getOwnPropertyDescriptor(global, 'window');
    if (current && !current.configurable) {
      const { window: _skipped, ...rest } = props;
      return original.call(this, target, rest);
    }
  }
  return original.call(this, target, props);
};
try {
  require('@react-native/jest-preset/jest/setup.js');
} finally {
  Object.defineProperties = original;
}

