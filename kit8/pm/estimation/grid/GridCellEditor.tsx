// GridCellEditor - the in-place editor of ONE cell of the estimate grid (a plain TextInput over the Skia canvas, positioned in content x and following the shared vertical scroll on the UI thread,
// so it stays glued to its row like the editors of the task tree). Enter = commit and go down, Tab = commit and go right, Esc = cancel, leaving the cell = commit (a refused value cancels).
// A NUMBER cell has the buttons of the number inputs of the app inside it: - and + (one step from what is typed now, kept to min / max) and the calculator (its OK puts the result in and commits).
// `onCommit` returns an error text to keep the editor open (the border turns red), or null when the value was taken.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import CalculatorTrigger from '../../../ui/components/calculator/CalculatorTrigger';
import { parseNumberInput, sanitizeNumberText, stepNumber } from '../../../ui/components/table/reusable/tableRows';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT } from '../../model/constants';
import { editorButtonSize } from '../model/estimateGridModel';

export type GridMove = 'none' | 'down' | 'right';

export interface GridCellEditorProps {
  testID: string;
  rowIndex: number;
  /** left edge of the editor (content x) */
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  initial: string;
  /** 'select' = everything selected (a double click / Enter: typing replaces), 'end' = the cursor after the text (typing a character starts the edit) */
  caret: 'select' | 'end';
  align: 'left' | 'right' | 'center';
  numeric: boolean;
  /** a number cell: the allowed range */
  min?: number;
  max?: number;
  onCommit: (text: string, move: GridMove) => string | null;
  onCancel: () => void;
  colors: { text: string; background: string; primary: string; error: string };
}


export default function GridCellEditor({ testID, rowIndex, x, width, scrollY, initial, caret, align, numeric, min, max, onCommit, onCancel, colors }: GridCellEditorProps) {
  const BTN = editorButtonSize(width);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);
  const done = useRef(false);
  /** the calculator window is open: the input loses the focus to it without leaving the cell */
  const calculatorOpen = useRef(false);
  /** a button of the editor is being pressed: the press takes the focus from the input (a blur) without leaving the cell */
  const pressing = useRef(false);
  const hold = () => { pressing.current = true; setTimeout(() => { pressing.current = false; }, 400); return false; };
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

  const commit = (move: GridMove, text = value) => {
    if (done.current) return;
    const problem = onCommit(text, move);
    if (problem) setError(true);
    else done.current = true;
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };
  const range = { min, max };
  const stepBy = (direction: 1 | -1) => {
    setError(false);
    setValue(String(stepNumber(parseNumberInput(value, range), direction, range)));
    inputRef.current?.focus();
  };
  const current = numeric ? parseNumberInput(value, range) : null;
  const atMin = min !== undefined && current !== null && current <= min;
  const atMax = max !== undefined && current !== null && current >= max;
  const stepButton = (direction: 1 | -1, disabled: boolean) => (
    <View onStartShouldSetResponderCapture={hold}>
      <Pressable testID={`${testID}-${direction === 1 ? 'increase' : 'decrease'}`} accessibilityLabel={direction === 1 ? 'Increase' : 'Decrease'} disabled={disabled} onPress={() => stepBy(direction)} style={[styles.btn, { width: BTN, height: BTN, opacity: disabled ? 0.3 : 1 }]}>
        <Text style={{ color: colors.primary, fontSize: BTN < 22 ? 15 : 18, fontWeight: '700', lineHeight: 20 }}>{direction === 1 ? '+' : '−'}</Text>
      </Pressable>
    </View>
  );

  return (
    <Animated.View style={[styles.box, { left: x, width, height: PM_ROW_HEIGHT }, style]}>
      <View style={[styles.frame, { overflow: 'hidden' }, { backgroundColor: colors.background, borderColor: error ? colors.error : colors.primary }]}>
        {numeric && stepButton(-1, atMin)}
        <TextInput
          ref={inputRef}
          testID={testID}
          value={value}
          keyboardType={numeric ? 'decimal-pad' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
          selectTextOnFocus={caret === 'select'}
          onFocus={() => { calculatorOpen.current = false; }}
          onChangeText={(t) => { setError(false); setValue(numeric ? sanitizeNumberText(t, false, min === undefined || min < 0) : t); }}
          onSubmitEditing={() => commit('down')}
          onBlur={() => {
            // leaving the cell commits a valid value and drops a refused one (a press on - / + / the calculator, or the calculator window taking the focus, is not leaving)
            if (done.current || calculatorOpen.current || pressing.current) return;
            const problem = onCommit(value, 'none');
            done.current = true;
            if (problem) onCancel();
          }}
          onKeyPress={(e) => {
            const key = (e.nativeEvent as any).key;
            if (key === 'Escape') cancel();
            else if (key === 'Tab') { (e as any).preventDefault?.(); commit('right'); }
          }}
          style={[styles.input, { color: colors.text, textAlign: numeric ? 'center' : align }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
        />
        {numeric && stepButton(1, atMax)}
        {numeric && (
          <View onStartShouldSetResponderCapture={hold}>
            <CalculatorTrigger
              testID={`${testID}-calculator`}
              size={BTN}
              min={min}
              max={max}
              getValue={() => { calculatorOpen.current = true; return parseNumberInput(value, range); }}
              onResult={(n) => { calculatorOpen.current = false; setValue(String(n)); commit('none', String(n)); }}
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', top: 0 },
  frame: { flex: 1, borderWidth: 2, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 2, paddingVertical: 0, fontSize: 12, height: '100%' },
  btn: { alignItems: 'center', justifyContent: 'center' },
});
