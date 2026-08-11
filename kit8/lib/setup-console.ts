import {LogBox, Platform} from 'react-native';

if (Platform.OS === 'web') {
  LogBox.ignoreLogs([
    'Animated: `useNativeDriver`',
    '[Reanimated] Reduced motion setting is enabled on this device.',
    '"shadow*" style props are deprecated. Use "boxShadow".',
    'props.pointerEvents is deprecated'
  ]);

  const originalWarn = console.warn;
  const originalError = console.error;
  const originalLog = console.log;
  
  const filterLogs = (args: any[]) => {
    return !!(args.length > 0 && typeof args[0] === 'string' && (
        args[0].includes('Animated: `useNativeDriver`') ||
        args[0].includes('[Reanimated] Reduced motion setting') ||
        args[0].includes('"shadow*" style props are deprecated') ||
        args[0].includes('props.pointerEvents is deprecated') ||
        args[0].includes('Multiple GoTrueClient instances detected')
    ));

  };

  console.warn = (...args) => {
    if (filterLogs(args)) return;
    originalWarn(...args);
  };
  
  console.error = (...args) => {
    if (filterLogs(args)) return;
    originalError(...args);
  };

  console.log = (...args) => {
    if (filterLogs(args)) return;
    originalLog(...args);
  };
}
