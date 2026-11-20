// CalculatorApp - the calculator itself (display + keys + OK / Cancel), the same panel in two places:
//   mode 'inline'  : opened by the calculator icon at the right of a numeric field (CalculatorTrigger): OK closes it and gives the result to the field
//   mode 'window'  : the standalone window of the app bar three dots menu (CalculatorWindowHost): buttons Copy result / Close
// Texts and the decimal separator follow the language of the user (calculatorTexts). Keyboard (web): digits, + - * / ( ) % , . x = Backspace Delete,
// Enter = "=" while the expression has an operator, else OK; Escape = Cancel.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { calcInitialState, calcKeyFromKeyboard, calcOk, calcPress, evaluateExpression, formatCalcNumber, formatExpression } from './calculatorModel';
import type { CalcConstraints, CalcKey, CalcState } from './calculatorModel';
import { setCalculatorMemory, useCalculatorStore } from './calculatorStore';
import { useCalculatorTexts } from './calculatorTexts';
import type { CalculatorTextKey } from './calculatorTexts';

export const CALCULATOR_WIDTH = 288;

export interface CalculatorAppProps extends CalcConstraints {
  mode?: 'inline' | 'window';
  /** the number the field has now (the calculator starts with it; the first digit typed replaces it, an operator continues it) */
  initialValue?: number | string | null;
  /** inline: OK pressed and the expression is right - the result (with the limits of the field) */
  onOk?: (value: number) => void;
  /** inline: Cancel / Escape; window: Close */
  onCancel: () => void;
  /** web: take the keyboard at once (the inline calculator does) */
  autoFocus?: boolean;
  testID?: string;
}

type KeySpec = { key: CalcKey; label: string; tip?: CalculatorTextKey; kind?: 'digit' | 'op' | 'fn' | 'equals' };

export default function CalculatorApp({ mode = 'inline', initialValue, onOk, onCancel, integer, min, max, autoFocus = false, testID = 'calculator' }: CalculatorAppProps) {
  const { themeColors: c } = useDesignSystem();
  const { tx, separator } = useCalculatorTexts();
  const store = useCalculatorStore();
  const [state, setState] = useState<CalcState>(() => calcInitialState(initialValue, store.memory));
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<any>(null);

  // the memory is shared: another calculator may have changed it
  useEffect(() => { setState((s) => (s.memory === store.memory ? s : { ...s, memory: store.memory })); }, [store.memory]);
  useEffect(() => {
    if (autoFocus && Platform.OS === 'web') { try { rootRef.current?.focus?.(); } catch { /* no focus in tests */ } }
  }, [autoFocus]);

  const press = (key: CalcKey) => {
    setCopied(false);
    const next = calcPress(state, key);
    setState(next);
    if (next.memory !== state.memory) setCalculatorMemory(next.memory);
  };

  const ok = () => {
    const r = calcOk(state, { integer, min, max });
    if (r.kind === 'error') { setState((s) => ({ ...s, error: r.error })); return; }
    if (r.kind === 'value') onOk?.(r.value);
    else onCancel();
  };

  const copy = async () => {
    const r = evaluateExpression(state.expr || '0');
    if (!r.ok) { setState((s) => ({ ...s, error: r.error })); return; }
    try { await Clipboard.setStringAsync(formatCalcNumber(r.value, '.')); setCopied(true); } catch { /* clipboard refused */ }
  };

  const hasOperator = /[-+*/()%]/.test(state.expr.replace(/^-/, ''));
  const onKeyDown = (e: any) => {
    const key: string = e?.key ?? e?.nativeEvent?.key;
    if (!key) return;
    if (key === 'Escape') { e.preventDefault?.(); onCancel(); return; }
    if (key === 'Enter') {
      e.preventDefault?.();
      if (mode === 'inline' && !hasOperator) ok(); else press('equals');
      return;
    }
    const k = calcKeyFromKeyboard(key);
    if (k) { e.preventDefault?.(); press(k); }
  };

  // the display: the expression (small) and the value now (big)
  const live = useMemo(() => (state.expr ? evaluateExpression(state.expr) : null), [state.expr]);
  const big = state.error
    ? tx(state.error === 'divZero' ? 'errDivZero' : state.error === 'invalid' ? 'errInvalid' : 'errSyntax')
    : live && live.ok ? formatCalcNumber(live.value, separator) : state.expr ? formatExpression(state.expr.replace(/[-+*/(]+$/, ''), separator) : '0';
  const small = state.expr ? formatExpression(state.expr, separator) : '';

  const rows: KeySpec[][] = [
    [{ key: 'mc', label: 'MC', tip: 'mc', kind: 'fn' }, { key: 'mr', label: 'MR', tip: 'mr', kind: 'fn' }, { key: 'mplus', label: 'M+', tip: 'mplus', kind: 'fn' }, { key: 'mminus', label: 'M−', tip: 'mminus', kind: 'fn' }],
    [{ key: 'clear', label: 'C', tip: 'clear', kind: 'fn' }, { key: 'back', label: '⌫', tip: 'backspace', kind: 'fn' }, { key: '(', label: '(', kind: 'fn' }, { key: ')', label: ')', kind: 'fn' }],
    [{ key: 'sqrt', label: '√', tip: 'sqrt', kind: 'fn' }, { key: 'inv', label: '1/x', tip: 'inv', kind: 'fn' }, { key: '%', label: '%', tip: 'percent', kind: 'fn' }, { key: '/', label: '÷', kind: 'op' }],
    [{ key: '7', label: '7' }, { key: '8', label: '8' }, { key: '9', label: '9' }, { key: '*', label: '×', kind: 'op' }],
    [{ key: '4', label: '4' }, { key: '5', label: '5' }, { key: '6', label: '6' }, { key: '-', label: '−', kind: 'op' }],
    [{ key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' }, { key: '+', label: '+', kind: 'op' }],
    [{ key: 'sign', label: '±', tip: 'sign', kind: 'fn' }, { key: '0', label: '0' }, { key: '.', label: separator }, { key: 'equals', label: '=', tip: 'equals', kind: 'equals' }],
  ];

  const keyStyle = (kind: KeySpec['kind'], hovered: boolean, pressed: boolean) => {
    const base = kind === 'equals' ? c.primary : kind === 'op' ? c.primary + '22' : kind === 'fn' ? c.text + '10' : c.surface;
    return [styles.key, { backgroundColor: base, borderColor: c.border, opacity: pressed ? 0.7 : hovered ? 0.88 : 1 }];
  };

  const webProps: any = Platform.OS === 'web' ? { tabIndex: 0, onKeyDown } : {};

  return (
    <View ref={rootRef} testID={testID} accessibilityLabel={tx('title')} style={[styles.panel, { backgroundColor: c.background, borderColor: c.border }]} {...webProps}>
      <View style={[styles.display, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.displayTop}>
          <Text testID={`${testID}-memory`} style={[styles.memoryMark, { color: c.primary, opacity: state.memory !== 0 ? 1 : 0 }]}>M</Text>
          <Text testID={`${testID}-expression`} numberOfLines={1} ellipsizeMode="head" style={[styles.expression, { color: c.text }]}>{small}</Text>
        </View>
        <Text testID={`${testID}-result`} numberOfLines={1} adjustsFontSizeToFit style={[styles.result, { color: state.error ? c.error : c.text }]}>{big}</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((k) => (
            <Pressable
              key={k.key}
              testID={`${testID}-key-${k.key}`}
              accessibilityRole="button"
              accessibilityLabel={k.tip ? tx(k.tip) : k.label}
              {...(Platform.OS === 'web' && k.tip ? ({ title: tx(k.tip) } as any) : {})}
              onPress={() => press(k.key)}
              // web: a key must not take the focus from the calculator (the keyboard keeps working)
              {...(Platform.OS === 'web' ? ({ onMouseDown: (e: any) => e?.preventDefault?.() } as any) : {})}
              style={({ hovered, pressed }: any) => keyStyle(k.kind, !!hovered, !!pressed)}
            >
              <Text style={[styles.keyText, { color: k.kind === 'equals' ? '#fff' : k.kind === 'op' ? c.primary : c.text }, k.kind === 'fn' && styles.keyTextFn]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
      ))}

      <View style={styles.footer}>
        {mode === 'inline' ? (
          <>
            <Pressable testID={`${testID}-cancel`} accessibilityRole="button" onPress={onCancel} style={[styles.footerBtn, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 15 }}>{tx('cancel')}</Text>
            </Pressable>
            <Pressable testID={`${testID}-ok`} accessibilityRole="button" onPress={ok} style={[styles.footerBtn, { backgroundColor: c.primary, borderColor: c.primary }]}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{tx('ok')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable testID={`${testID}-copy`} accessibilityRole="button" onPress={copy} style={[styles.footerBtn, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 15 }}>{copied ? tx('copied') : tx('copy')}</Text>
            </Pressable>
            <Pressable testID={`${testID}-close`} accessibilityRole="button" onPress={onCancel} style={[styles.footerBtn, { backgroundColor: c.primary, borderColor: c.primary }]}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{tx('close')}</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: CALCULATOR_WIDTH, padding: 10, borderRadius: 12, borderWidth: 1, ...Platform.select({ web: { outlineStyle: 'none' } as any, default: {} }) },
  display: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, minHeight: 64, justifyContent: 'space-between' },
  displayTop: { flexDirection: 'row', alignItems: 'center' },
  memoryMark: { fontSize: 12, fontWeight: '700', width: 16 },
  expression: { flex: 1, textAlign: 'right', fontSize: 13, opacity: 0.65 },
  result: { textAlign: 'right', fontSize: 28, fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: 6 },
  key: { flex: 1, height: 42, marginHorizontal: 3, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 18, fontWeight: '600' },
  keyTextFn: { fontSize: 15 },
  footer: { flexDirection: 'row', marginTop: 4 },
  footerBtn: { flex: 1, height: 42, marginHorizontal: 3, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
