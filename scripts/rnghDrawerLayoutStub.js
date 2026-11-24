// react-native-gesture-handler 3 (Expo SDK 58) no longer has `react-native-gesture-handler/DrawerLayout`; @ant-design/react-native 5.4.3 still
// imports it in its Drawer component (lib/drawer). The app never renders the Ant Drawer (only Ant Switch is used, AntSwitchSub), so metro.config.js
// points the missing module here: a plain container that renders its children. Use ReanimatedDrawerLayout of react-native-gesture-handler for a real drawer.
const React = require('react');
const { View } = require('react-native');

function DrawerLayout({ children, style }) {
  return React.createElement(View, { style }, typeof children === 'function' ? null : children);
}
DrawerLayout.positions = { Left: 'left', Right: 'right' };

module.exports = DrawerLayout;
module.exports.default = DrawerLayout;
