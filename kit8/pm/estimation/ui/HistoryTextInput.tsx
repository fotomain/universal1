// HistoryTextInput - a TextInputApp with a clock icon INSIDE it: the last texts typed into THIS field (newest first, kept on the device under `historyKey`) open in a menu, a pick puts the
// text back. Every field has its own history: give each its own `historyKey` (a key that changes - e.g. with the chosen filter field - switches to the history of that key).
// A typed text goes to the history when the user leaves the field, presses Enter, or the screen calls `remember()` (a norm was selected).
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';
import TextInputApp, { type TextInputAppProps } from '../../../ui/components/common/TextInputApp';
import { useSearchHistory } from '../../../ui/components/table/reusable/useSearchHistory';
import { pmT } from '../../i18n/pmT';
import PMContextMenu from '../../inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../inner/menu/PMMenuItem';

export interface HistoryTextInputHandle { remember: (text?: string) => void }
export interface HistoryTextInputProps extends Omit<TextInputAppProps, 'leftIcons'> {
  /** where this field's history is kept (AsyncStorage key suffix) */
  historyKey: string;
  testID: string;
}

const HistoryTextInput = forwardRef<HistoryTextInputHandle, HistoryTextInputProps>(function HistoryTextInput({ historyKey, testID, value = '', onChangeText, onBlur, onSubmitEditing, ...rest }, ref) {
  const history = useSearchHistory(historyKey);
  const valueRef = useRef(value);
  valueRef.current = value;
  const lastPress = useRef({ x: 0, y: 0 });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  useImperativeHandle(ref, () => ({ remember: (text?: string) => history.remember(text ?? valueRef.current) }), [history.remember]); // eslint-disable-line react-hooks/exhaustive-deps

  const items: PMMenuItemProps[] = [
    ...history.history.map((h, i) => ({ testID: `${testID}-history-${i}`, label: h, icon: 'history', onPress: () => { setMenu(null); onChangeText?.(h); history.remember(h); } })),
    ...(history.history.length === 0
      ? [{ testID: `${testID}-history-empty`, label: pmT('No searches yet'), icon: 'history', disabled: true, onPress: () => {} }]
      : [{ testID: `${testID}-history-clear`, label: pmT('Clear history'), icon: 'delete', danger: true, onPress: () => { setMenu(null); history.clear(); } }]),
  ];
  return (
    <View style={{ flex: 1, minWidth: 0 }} onStartShouldSetResponderCapture={(e: any) => { lastPress.current = { x: e?.nativeEvent?.pageX ?? 0, y: (e?.nativeEvent?.pageY ?? 0) + 14 }; return false; }}>
      <TextInputApp {...rest} testID={testID} value={value} onChangeText={onChangeText} iconsNotTabbable iconSize={16} style={{ marginBottom: 0 }}
        onBlur={(e: any) => { history.remember(valueRef.current); onBlur?.(e); }}
        onSubmitEditing={(e: any) => { history.remember(valueRef.current); onSubmitEditing?.(e); }}
        leftIcons={[{ icon: 'history', testID: `${testID}-history-button`, accessibilityLabel: 'Search history', onPress: () => setMenu({ x: lastPress.current.x, y: lastPress.current.y }) }]} />
      {menu && <PMContextMenu testID={`${testID}-history-menu`} x={menu.x} y={menu.y} caption={pmT('Search history')} onClose={() => setMenu(null)} items={items} />}
    </View>
  );
});

export default HistoryTextInput;
