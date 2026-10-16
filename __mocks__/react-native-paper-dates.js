const React = require('react');
const { View, Text, Pressable } = require('react-native');

function DatePickerModal({ visible, onDismiss, onConfirm, date, locale, mode, validRange }) {
  if (!visible) return null;
  return React.createElement(
    View,
    { testID: 'mock-date-picker-modal' },
    React.createElement(Text, null, 'DatePickerModal'),
    React.createElement(
      Pressable,
      {
        testID: 'mock-date-picker-confirm',
        onPress: () => onConfirm && onConfirm({ date: date || new Date(2026, 8, 30) }),
      },
      React.createElement(Text, null, 'Confirm')
    ),
    React.createElement(
      Pressable,
      {
        testID: 'mock-date-picker-dismiss',
        onPress: () => onDismiss && onDismiss(),
      },
      React.createElement(Text, null, 'Dismiss')
    )
  );
}

// DatePickerModalContent - the bare content (no outer Modal/backdrop) that DateQuickPickModal.tsx wraps with its OWN Modal to add the quick-pick row;
// own testIDs (not the ones of DatePickerModal above) so a test can tell the quick-pick row and this stub apart.
function DatePickerModalContent({ onDismiss, onConfirm, date }) {
  return React.createElement(
    View,
    { testID: 'mock-date-picker-content' },
    React.createElement(Text, null, 'DatePickerModalContent'),
    React.createElement(
      Pressable,
      {
        testID: 'mock-date-picker-content-confirm',
        onPress: () => onConfirm && onConfirm({ date: date || new Date(2026, 8, 30) }),
      },
      React.createElement(Text, null, 'Confirm')
    ),
    React.createElement(
      Pressable,
      {
        testID: 'mock-date-picker-content-dismiss',
        onPress: () => onDismiss && onDismiss(),
      },
      React.createElement(Text, null, 'Dismiss')
    )
  );
}

module.exports = {
  DatePickerModal,
  DatePickerModalContent,
  registerTranslation: () => {},
  en: {},
};
