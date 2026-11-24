// react-native-gesture-handler 3 (Expo SDK 58) no longer has `react-native-gesture-handler/Swipeable`; @ant-design/react-native 5.4.3 still imports it
// in SwipeAction (lib/swipe-action). The app never renders Ant's SwipeAction: metro.config.js points the missing module here (a container that renders
// its children). A real swipeable row = `react-native-gesture-handler/ReanimatedSwipeable`.
const React = require('react');
const { View } = require('react-native');

const Swipeable = React.forwardRef(function Swipeable({ children, style }, ref) {
  React.useImperativeHandle(ref, () => ({ close() {}, openLeft() {}, openRight() {}, reset() {} }));
  return React.createElement(View, { style }, children);
});

module.exports = Swipeable;
module.exports.default = Swipeable;
