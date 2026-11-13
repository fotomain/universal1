it('x', () => {
  const m = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
  console.log('has default:', typeof m.default, 'has setItem:', typeof m.setItem);
});
