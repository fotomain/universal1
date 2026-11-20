// CalculatorTrigger - the calculator icon at the RIGHT side of a numeric field. A press opens the calculator (CalculatorApp, mode inline) in a small
// window next to the field, filled with the number the field has now; OK closes it and hands the result to the field (onResult), Cancel / Escape / a
// press outside closes it and changes nothing. On the keyboard of the field (web) F2 does the same (`openRef` is how the field asks for it).
import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../common/IconApp';
import CalculatorApp, { CALCULATOR_WIDTH } from './CalculatorApp';
import type { CalcConstraints } from './calculatorModel';
import { useCalculatorTexts } from './calculatorTexts';

export interface CalculatorTriggerHandle { open: () => void }

export interface CalculatorTriggerProps extends CalcConstraints {
  /** the number of the field now (typed, not yet saved), null = empty / not a number */
  getValue: () => number | null;
  /** OK: the result (integer / min / max of the field applied) */
  onResult: (value: number) => void;
  disabled?: boolean;
  /** the size of the touch area (default 28; a row of a table is 30 - 40 high) */
  size?: number;
  testID?: string;
  openRef?: React.Ref<CalculatorTriggerHandle>;
}

interface Anchor { x: number; y: number; width: number; height: number }
const PANEL_HEIGHT = 480;

export default function CalculatorTrigger({ getValue, onResult, integer, min, max, disabled, size = 28, testID = 'calculator-trigger', openRef }: CalculatorTriggerProps) {
  const { themeColors: c } = useDesignSystem();
  const { tx } = useCalculatorTexts();
  const { width: winW, height: winH } = useWindowDimensions();
  const ref = useRef<any>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [initial, setInitial] = useState<number | null>(null);

  const show = useCallback(() => {
    if (disabled) return;
    setInitial(getValue());
    setAnchor(null);
    const el = ref.current;
    try {
      if (el?.getBoundingClientRect) {                                       // web: the DOM box, at once
        const r = el.getBoundingClientRect();
        if (r.width > 0) setAnchor({ x: r.left, y: r.top, width: r.width, height: r.height });
      } else if (el?.measureInWindow) {                                      // iOS / Android: asked, answers a moment later (the window opens centered first)
        el.measureInWindow((x: number, y: number, width: number, height: number) => { if (Number.isFinite(x) && width > 0) setAnchor({ x, y, width, height }); });
      }
    } catch { /* centered */ }
    setOpen(true);
  }, [disabled, getValue]);
  useImperativeHandle(openRef, () => ({ open: show }), [show]);

  const close = () => setOpen(false);
  const phone = winW < CALCULATOR_WIDTH + 40;
  let left = Math.max(8, (winW - CALCULATOR_WIDTH) / 2);
  let top = Math.max(8, (winH - PANEL_HEIGHT) / 2);
  if (anchor && !phone) {
    left = Math.min(Math.max(8, anchor.x + anchor.width - CALCULATOR_WIDTH), winW - CALCULATOR_WIDTH - 8);
    top = anchor.y + anchor.height + 4;
    if (top + PANEL_HEIGHT > winH - 8) top = Math.max(8, anchor.y - PANEL_HEIGHT - 4);
  }

  return (
    <>
      <Pressable
        ref={ref}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={tx('open')}
        {...(Platform.OS === 'web' ? ({ title: tx('open'), tabIndex: -1 } as any) : {})}
        disabled={disabled}
        onPress={show}
        hitSlop={4}
        style={({ hovered, pressed }: any) => [styles.btn, { width: size, height: size, backgroundColor: hovered || pressed ? c.primary + '22' : 'transparent', opacity: disabled ? 0.35 : 1 }]}
      >
        <IconApp name="calculate" size={Math.round(size * 0.68)} color={c.primary} />
      </Pressable>
      {open && (
        <Modal transparent visible animationType="fade" onRequestClose={close}>
          <Pressable testID={`${testID}-backdrop`} style={styles.backdrop} onPress={close}>
            {/* a press on the panel is not a press on the backdrop */}
            <Pressable style={[styles.panelWrap, { left, top }]} onPress={(e: any) => e?.stopPropagation?.()}>
              <View style={styles.shadow}>
                <CalculatorApp
                  testID={`${testID}-panel`}
                  mode="inline"
                  autoFocus
                  initialValue={initial}
                  integer={integer}
                  min={min}
                  max={max}
                  onOk={(v) => { close(); onResult(v); }}
                  onCancel={close}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center', borderRadius: 6, marginLeft: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  panelWrap: { position: 'absolute' },
  shadow: { borderRadius: 12, ...Platform.select({ web: { boxShadow: '0 6px 24px rgba(0,0,0,0.28)' } as any, default: { elevation: 12, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } } }) },
});
