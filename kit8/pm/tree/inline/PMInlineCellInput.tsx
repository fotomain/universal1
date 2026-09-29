// Small in-place editor drawn over a Skia tree cell (Start / Days / %).
// Enter or blur = commit, Esc = cancel. Positioned in canvas coordinates and follows the
// shared vertical scroll on the UI thread, so it stays glued to its row.

import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT } from '../../constants';

export interface PMInlineCellInputProps {
  testID: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  initial: string;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'numbers-and-punctuation';
  /** filters every keystroke (e.g. digits only) */
  sanitize?: (text: string) => string;
  /** returns an error text to keep the editor open, or null when committed */
  onCommit: (text: string) => string | null;
  onCancel: () => void;
  colors: { text: string; background: string; primary: string; error: string };
  /** text alignment (default right: numbers / dates) */
  align?: 'left' | 'right' | 'center';
}

export default function PMInlineCellInput({
  testID,
  rowIndex,
  x,
  width,
  scrollY,
  initial,
  placeholder,
  keyboardType = 'default',
  sanitize,
  onCommit,
  onCancel,
  colors,
  align = 'right',
}: PMInlineCellInputProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState(false);
  const done = useRef(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      // select everything so typing replaces the value
      const el = inputRef.current as unknown as { select?: () => void } | null;
      if (Platform.OS === 'web' && el?.select) el.select();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: PM_SCALE_HEIGHT + rowIndex * PM_ROW_HEIGHT - scrollY.value + 3 }],
  }));

  const commit = () => {
    if (done.current) return;
    const problem = onCommit(value.trim());
    if (problem) {
      setError(true);
      return;
    }
    done.current = true;
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  return (
    <Animated.View style={[styles.box, { left: x, width }, style]}>
      <TextInput
        ref={inputRef}
        testID={testID}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={`${colors.text}66`}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        selectTextOnFocus
        onChangeText={(t) => {
          setError(false);
          setValue(sanitize ? sanitize(t) : t);
        }}
        onSubmitEditing={commit}
        onBlur={() => {
          // blur commits a valid value, cancels an invalid one
          if (done.current) return;
          const problem = onCommit(value.trim());
          done.current = true;
          if (problem) onCancel();
        }}
        onKeyPress={(e) => {
          if ((e.nativeEvent as any).key === 'Escape') cancel();
        }}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.background, borderColor: error ? colors.error : colors.primary, textAlign: align },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', top: 0, height: PM_ROW_HEIGHT - 6, zIndex: 20 },
  input: { flex: 1, borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 0, fontSize: 12, textAlign: 'right' },
});
