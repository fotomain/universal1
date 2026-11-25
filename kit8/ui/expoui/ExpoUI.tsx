// The Expo UI theme on @expo/ui (documentation/USER_SETTINGS_TABLE_WBS.html): the native SwiftUI (iOS) / Jetpack Compose (Android) components of the universal API of @expo/ui, and its styled
// react-native fallback on the web. The default design system of the Apple devices (Rule 1). Used by the case 'expo' of TextInputApp, SwitchApp, ButtonApp and TextApp.
//   - @expo/ui is loaded lazily (require): a test, a build without the native module or a failing native view never breaks the screen - an error boundary shows the old hand-made look.
//   - each component sits in a <Host> of the theme colors (seedColor = the primary color, colorScheme = the dark mode of the app).
import React, { useEffect } from 'react';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { useThemeFont } from '../fonts/useThemeFont';

let cached: any;
/** the universal API of @expo/ui, or null when it cannot be used (unit tests, a missing native module) */
export function getExpoUI(): any | null {
  if (cached !== undefined) return cached;
  if ((globalThis as any).__EXPO_UI_FORCE__) {
    cached = (globalThis as any).__EXPO_UI_FORCE__;
    return cached;
  }
  // Jest: the native views do not exist there - every test keeps the hand-made look unless it asks for the real one
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('@expo/ui');
  } catch {
    cached = null;
  }
  return cached;
}
/** tests only */
export function resetExpoUICache() {
  cached = undefined;
  delete (globalThis as any).__EXPO_UI_FORCE__;
}

class ExpoUIBoundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: any) { console.warn('Expo UI component failed, the old look is used instead:', error?.message || error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** <Host> of the theme + the error boundary; `fallback` is what is drawn when @expo/ui is not usable */
export function ExpoUIBox({ children, fallback, fullWidth = true }: { children: React.ReactNode; fallback: React.ReactNode; fullWidth?: boolean }) {
  const ui = getExpoUI();
  const { themeColors, isDark } = useDesignSystem();
  if (!ui?.Host) return <>{fallback}</>;
  return (
    <ExpoUIBoundary fallback={fallback}>
      <ui.Host matchContents={fullWidth ? { vertical: true } : true} colorScheme={isDark ? 'dark' : 'light'} seedColor={themeColors.primary} style={fullWidth ? { width: '100%' } : undefined}>
        {children}
      </ui.Host>
    </ExpoUIBoundary>
  );
}

export interface ExpoUITextInputProps {
  value: string;
  onChangeText?: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  fallback: React.ReactNode;
}

function TextInputInner(p: ExpoUITextInputProps) {
  const ui = getExpoUI();
  const { themeColors } = useDesignSystem();
  const font = useThemeFont('input');
  const state = ui.useNativeState(p.value ?? '');
  // the app owns the text: a change that did not come from the field (clear, reset) is pushed into the native field
  useEffect(() => {
    if (state.value !== (p.value ?? '')) state.value = p.value ?? '';
  }, [p.value, state]);
  return (
    <ui.TextInput
      value={state}
      onChangeText={p.onChangeText}
      placeholder={p.placeholder}
      secureTextEntry={p.secureTextEntry}
      multiline={p.multiline}
      numberOfLines={p.numberOfLines}
      keyboardType={p.keyboardType}
      autoCapitalize={p.autoCapitalize}
      editable={p.editable !== false}
      testID={p.testID}
      accessibilityLabel={p.accessibilityLabel}
      textStyle={{ fontFamily: font.fontFamily, fontSize: font.fontSize, color: themeColors.text, letterSpacing: font.letterSpacing }}
    />
  );
}
export function ExpoUITextInput(p: ExpoUITextInputProps) {
  return <ExpoUIBox fallback={p.fallback}><TextInputInner {...p} /></ExpoUIBox>;
}

export function ExpoUISwitch({ value, onValueChange, label, disabled, testID, fallback }: { value: boolean; onValueChange: (v: boolean) => void; label?: string; disabled?: boolean; testID?: string; fallback: React.ReactNode }) {
  const ui = getExpoUI();
  if (!ui?.Switch) return <>{fallback}</>;
  return <ExpoUIBox fallback={fallback}><ui.Switch value={value} onValueChange={onValueChange} label={label} disabled={disabled} testID={testID} /></ExpoUIBox>;
}

export function ExpoUIButton({ label, variant, onPress, disabled, testID, fallback }: { label: string; variant: 'contained' | 'outlined' | 'text'; onPress: () => void; disabled?: boolean; testID?: string; fallback: React.ReactNode }) {
  const ui = getExpoUI();
  if (!ui?.Button) return <>{fallback}</>;
  const v = variant === 'contained' ? 'filled' : variant;
  return <ExpoUIBox fullWidth={false} fallback={fallback}><ui.Button label={label} variant={v} onPress={onPress} disabled={disabled} testID={testID} /></ExpoUIBox>;
}

export function ExpoUIText({ children, role, color, numberOfLines, testID, fallback }: { children: string; role: 'title' | 'body' | 'label'; color: string; numberOfLines?: number; testID?: string; fallback: React.ReactNode }) {
  const ui = getExpoUI();
  if (!ui?.Text) return <>{fallback}</>;
  return <ExpoUIBox fullWidth={false} fallback={fallback}><TextInner role={role} color={color} numberOfLines={numberOfLines} testID={testID}>{children}</TextInner></ExpoUIBox>;
}
function TextInner({ children, role, color, numberOfLines, testID }: { children: string; role: 'title' | 'body' | 'label'; color: string; numberOfLines?: number; testID?: string }) {
  const ui = getExpoUI();
  const f = useThemeFont(role === 'title' ? 'title' : role === 'label' ? 'label' : 'input');
  return <ui.Text numberOfLines={numberOfLines} testID={testID} textStyle={{ fontFamily: f.fontFamily, fontSize: f.fontSize, lineHeight: f.lineHeight, letterSpacing: f.letterSpacing, color, fontWeight: f.fontWeight === 'normal' ? undefined : f.fontWeight }}>{children}</ui.Text>;
}

/** where each design-system component of the app stands on @expo/ui (documentation / settings screen) */
export const EXPO_UI_COVERAGE: { component: string; expoUI: string; when: string }[] = [
  { component: 'TextInputApp', expoUI: 'TextInput', when: 'a plain field: no icons / adornments (label and helper text are drawn by the app)' },
  { component: 'SwitchApp', expoUI: 'Switch', when: 'always' },
  { component: 'ButtonApp', expoUI: 'Button', when: 'contained / outlined / text with a text label, no icon, not loading, no fixed size' },
  { component: 'TextApp', expoUI: 'Text', when: 'a text child' },
];
