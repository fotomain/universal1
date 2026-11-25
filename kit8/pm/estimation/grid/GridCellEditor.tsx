// GridCellEditor - the in-place editor of ONE cell of the estimate grid (a plain TextInput over the Skia canvas, positioned in content x and following the shared vertical scroll on the UI thread,
// so it stays glued to its row like the editors of the task tree). Enter = commit and go down, Tab = commit and go right, Esc = cancel, leaving the cell = commit (a refused value cancels).
// `onCommit` returns an error text to keep the editor open (the border turns red), or null when the value was taken.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT } from '../../model/constants';

export type GridMove = 'none' | 'down' | 'right';

export interface GridCellEditorProps {
  testID: string;
  rowIndex: number;
  /** left edge of the cell (content x) */
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  initial: string;
  /** 'select' = everything selected (a double click / Enter: typing replaces), 'end' = the cursor after the text (typing a character starts the edit) */
  caret: 'select' | 'end';
  align: 'left' | 'right' | 'center';
  numeric: boolean;
  onCommit: (text: string, move: GridMove) => string | null;
  onCancel: () => void;
  colors: { text: string; background: string; primary: string; error: string };
}

/** a number cell takes digits, the sign and a decimal separator only */
export const sanitizeNumberText = (t: string): string => t.replace(/[^0-9.,\-\s]/g, '');

export default function GridCellEditor({ testID, rowIndex, x, width, scrollY, initial, caret, align, numeric, onCommit, onCancel, colors }: GridCellEditorProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);
  const done = useRef(false);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      const el = inputRef.current as unknown as { select?: () => void; setSelectionRange?: (a: number, b: number) => void } | null;
      if (Platform.OS !== 'web' || !el) return;
      if (caret === 'select') el.select?.();
      else el.setSelectionRange?.(initial.length, initial.length);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: PM_SCALE_HEIGHT + rowIndex * PM_ROW_HEIGHT - scrollY.value }] }));

  const commit = (move: GridMove) => {
    if (done.current) return;
    const problem = onCommit(value, move);
    if (problem) setError(true);
    else done.current = true;
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  return (
    <Animated.View style={[styles.box, { left: x, width, height: PM_ROW_HEIGHT }, style]}>
      <View style={[styles.frame, { backgroundColor: colors.background, borderColor: error ? colors.error : colors.primary }]}>
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus={caret === 'select'}
          onChangeText={(t) => { setError(false); setValue(numeric ? sanitizeNumberText(t) : t); }}
          onSubmitEditing={() => commit('down')}
          onBlur={() => {
            // leaving the cell commits a valid value and drops a refused one
            if (done.current) return;
            const problem = onCommit(value, 'none');
            done.current = true;
            if (problem) onCancel();
          }}
          onKeyPress={(e) => {
            const key = (e.nativeEvent as any).key;
            if (key === 'Escape') cancel();
            else if (key === 'Tab') { (e as any).preventDefault?.(); commit('right'); }
          }}
          style={[styles.input, { color: colors.text, textAlign: align }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', top: 0 },
  frame: { flex: 1, borderWidth: 2, justifyContent: 'center' },
  input: { paddingHorizontal: 6, paddingVertical: 0, fontSize: 12, height: '100%' },
});
