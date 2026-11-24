// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

// react-native-gesture-handler 3 removed `DrawerLayout` and `Swipeable`, which @ant-design/react-native (Drawer, SwipeAction: not used by the app)
// still imports: the two missing modules are answered by small stubs (scripts/rnghDrawerLayoutStub.js, rnghSwipeableStub.js)
const path = require('path');
const MISSING_GESTURE_HANDLER_MODULES = {
  'react-native-gesture-handler/DrawerLayout': path.join(__dirname, 'scripts', 'rnghDrawerLayoutStub.js'),
  'react-native-gesture-handler/Swipeable': path.join(__dirname, 'scripts', 'rnghSwipeableStub.js'),
};
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (MISSING_GESTURE_HANDLER_MODULES[moduleName]) {
    return { type: 'sourceFile', filePath: MISSING_GESTURE_HANDLER_MODULES[moduleName] };
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

config.server = {
  ...config.server,
  port: 8088,
};

module.exports = config;
