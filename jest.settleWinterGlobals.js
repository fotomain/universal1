// Expo SDK 58 / Jest 30: `expo/src/winter` installs LAZY globals (fetch, URL, TextEncoderStream ... = getters that `require` their module on first use).
// In a jsdom test Jest 30 touches every global when it tears the environment down; the getter then requires a file "outside of the scope of the test
// code" and the whole suite fails ('You are trying to `require` a file outside of the scope of the test code'). Read each lazy global once HERE,
// while requiring is still allowed: the getter then turns itself into a plain value.
for (const name of Object.getOwnPropertyNames(globalThis)) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  } catch (e) {
    continue;
  }
  if (descriptor && typeof descriptor.get === 'function' && descriptor.get.name === 'getValue') {
    try {
      void globalThis[name];
    } catch (e) {
      // a global that cannot load in Jest stays as it is
    }
  }
}
