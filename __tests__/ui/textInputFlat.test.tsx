/** @jest-environment jsdom */
// TextInputApp mode="flat": no background, no border / underline, no outer margin - in EVERY design system - while the label and the placeholder still work. The default stays outlined.
import React, { act } from 'react';

let mockSystem = 'native';
jest.mock('../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: mockSystem, isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fafafa', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../kit8/lib/webAutofillStyle', () => ({ installNoAutofillHighlight: () => {} }));
let paperProps: any = null;
jest.mock('react-native-paper', () => {
  const R = require('react');
  const TextInput: any = (p: any) => { paperProps = p; return R.createElement('input', { 'data-testid': 'paper-input', placeholder: p.placeholder, value: p.value, readOnly: true }); };
  TextInput.Icon = () => null;
  return { TextInput, HelperText: () => null };
});
let tamaguiProps: any = null;
jest.mock('../../kit8/ui/components/common/tamagui/TamaguiTextInputSub', () => ({ __esModule: true, default: (p: any) => { tamaguiProps = p; return null; } }));
let googleProps: any = null;
jest.mock('../../kit8/ui/components/common/googlemd3web/GoogleMD3WebTextInput', () => ({ __esModule: true, default: (p: any) => { googleProps = p; return null; } }));
let appleProps: any = null;
jest.mock('../../kit8/ui/applemacui/components/AppleTextField', () => ({ AppleTextField: (p: any) => { appleProps = p; return null; } }));

import { TextInputApp } from '../../kit8/ui/components/common/TextInputApp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
function render(el: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(el));
  return host;
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; paperProps = tamaguiProps = googleProps = appleProps = null; });

const box = (host: HTMLElement) => host.querySelector('input')!.parentElement as HTMLElement;
const css = (el: HTMLElement) => getComputedStyle(el);
const transparent = (c: string) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';

describe.each(['native', 'ant', 'expo'])('%s: the field is a box we draw', (system) => {
  beforeEach(() => { mockSystem = system; });
  it('flat: no border, no background, no horizontal padding, no outer margin; the label and the placeholder are there', () => {
    const host = render(<TextInputApp mode="flat" label="Task name" placeholder="Type a name" value="" onChangeText={() => {}} />);
    expect(host.textContent).toContain('Task name');
    expect(host.querySelector('input')!.getAttribute('placeholder')).toBe('Type a name');
    expect(css(box(host)).borderTopWidth).toBe('0px');
    expect(transparent(css(box(host)).backgroundColor)).toBe(true);
    expect(css(box(host)).paddingLeft).toBe('0px');
    expect(css(box(host).parentElement as HTMLElement).marginBottom).toBe('0px');
  });
  it('default (no mode): outlined as before - a border, a background, a margin', () => {
    const host = render(<TextInputApp label="Task name" placeholder="Type a name" value="" onChangeText={() => {}} />);
    expect(css(box(host)).borderTopWidth).not.toBe('0px');
    expect(css(box(host).parentElement as HTMLElement).marginBottom).not.toBe('0px');
  });
  it('flat with a value still types', () => {
    const onChange = jest.fn();
    const host = render(<TextInputApp mode="flat" value="abc" onChangeText={onChange} />);
    expect(host.querySelector('input')!.value).toBe('abc');
  });
});

describe('paper', () => {
  beforeEach(() => { mockSystem = 'paper'; });
  it('flat: paper mode "flat" with the underline switched off (rest and focus), a transparent background; label and placeholder go to paper', () => {
    render(<TextInputApp mode="flat" label="Task name" placeholder="Type a name" value="x" onChangeText={() => {}} />);
    expect(paperProps.mode).toBe('flat');
    expect(paperProps.underlineColor).toBe('transparent');
    expect(paperProps.activeUnderlineColor).toBe('transparent');
    expect(paperProps.style.backgroundColor).toBe('transparent');
    expect(paperProps.label).toBe('Task name');
    expect(paperProps.placeholder).toBe('Type a name');
  });
  it('flat has no outer margin', () => {
    const host = render(<TextInputApp mode="flat" value="x" onChangeText={() => {}} />);
    expect(css(host.firstElementChild as HTMLElement).marginBottom).toBe('0px');
  });
  it('default: outlined as before (the outline, the surface background, 12 px margin)', () => {
    const host = render(<TextInputApp label="L" value="x" onChangeText={() => {}} />);
    expect(paperProps.mode).toBe('outlined');
    expect(paperProps.underlineColor).toBeUndefined();
    expect(paperProps.style.backgroundColor).toBe('#fafafa');
    expect(css(host.firstElementChild as HTMLElement).marginBottom).toBe('12px');
  });
  it('mode "outlined" is the same as the default', () => {
    render(<TextInputApp mode="outlined" value="x" onChangeText={() => {}} />);
    expect(paperProps.mode).toBe('outlined');
  });
});

describe('the other design systems get the flat switch', () => {
  it('tamagui: flat={true}; default false', () => {
    mockSystem = 'tamagui';
    render(<TextInputApp mode="flat" value="x" onChangeText={() => {}} />);
    expect(tamaguiProps.flat).toBe(true);
    act(() => root.unmount());
    render(<TextInputApp value="x" onChangeText={() => {}} />);
    expect(tamaguiProps.flat).toBe(false);
  });
  it('googlemd3web: flat={true}; default false', () => {
    mockSystem = 'googlemd3web';
    render(<TextInputApp mode="flat" label="L" value="x" onChangeText={() => {}} />);
    expect(googleProps.flat).toBe(true);
    expect(googleProps.label).toBe('L');
    act(() => root.unmount());
    render(<TextInputApp value="x" onChangeText={() => {}} />);
    expect(googleProps.flat).toBe(false);
  });
  it('applemacui: variant "flat"; default is not flat', () => {
    mockSystem = 'applemacui';
    render(<TextInputApp mode="flat" label="L" placeholder="P" value="x" onChangeText={() => {}} />);
    expect(appleProps.variant).toBe('flat');
    expect(appleProps.label).toBe('L');
    expect(appleProps.placeholder).toBe('P');
    act(() => root.unmount());
    render(<TextInputApp value="x" onChangeText={() => {}} />);
    expect(appleProps.variant).not.toBe('flat');
  });
});
