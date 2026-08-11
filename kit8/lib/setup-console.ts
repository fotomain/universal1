import { Text, View, TextInput, Image, LogBox, Platform } from 'react-native';
import {
  TextPropTypes,
  ViewPropTypes,
  TextInputPropTypes,
  ImagePropTypes,
} from 'deprecated-react-native-prop-types';

// Polyfill deprecated React Native propTypes & default properties on components (e.g. Text.default.propTypes.style)
const patchComponentProps = (Component: any, PropTypesObj: any) => {
  if (!Component) return;
  try {
    if (!Component.propTypes) {
      Component.propTypes = PropTypesObj || {};
    }
    if (!Component.defaultProps) {
      Component.defaultProps = {};
    }
    if (!Component.default) {
      Component.default = Component;
    }
    if (Component.default) {
      if (!Component.default.propTypes) {
        Component.default.propTypes = Component.propTypes;
      }
      if (!Component.default.defaultProps) {
        Component.default.defaultProps = Component.defaultProps;
      }
    }
  } catch (e) {
    // Catch if property is read-only in strict mode
  }
};

patchComponentProps(Text, TextPropTypes);
patchComponentProps(View, ViewPropTypes);
patchComponentProps(TextInput, TextInputPropTypes);
patchComponentProps(Image, ImagePropTypes);

// Polyfill removed/deprecated React Native APIs required by legacy packages like antd-mobile-rn
const RN = require('react-native');
if (RN) {
  if (!RN.TabBarIOS) {
    const DummyTabBarIOSItem: any = () => null;
    const DummyTabBarIOS: any = () => null;
    DummyTabBarIOS.Item = DummyTabBarIOSItem;
    RN.TabBarIOS = DummyTabBarIOS;
  }
  if (!RN.SegmentedControlIOS) {
    RN.SegmentedControlIOS = () => null;
  }
  if (!RN.DatePickerIOS) {
    RN.DatePickerIOS = () => null;
  }
  if (!RN.ProgressViewIOS) {
    RN.ProgressViewIOS = () => null;
  }
  if (!RN.ActionSheetIOS) {
    RN.ActionSheetIOS = {
      showActionSheetWithOptions: () => {},
      showShareActionSheetWithOptions: () => {},
    };
  }
}

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

