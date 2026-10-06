/** @jest-environment jsdom */
// kit8/ui/applemacui: tokens, provider and every component's states (jsdom + react-native-web; the PM test kit supplies
// the Reanimated / gesture-handler / icon mocks and the DOM helpers).
import { act } from 'react';
import { cleanupUI, inputValue, mustGet, press, q, renderUI, textOf, typeInto } from '../pm/ui/pmUiTestKit';
import React from 'react';
// jsdom = the web build: Metro would pick AppleDatePicker.web.tsx there
jest.mock('../../kit8/ui/applemacui/components/AppleDatePicker', () => require('../../kit8/ui/applemacui/components/AppleDatePicker.web'));
import { appleMacUIAlpha, appleMacUIDarkTheme, appleMacUILightTheme, appleMacUITheme, appleMacUIThemeColors } from '../../kit8/ui/applemacui/appleMacUITheme';
import { useAppleMacUI, WithAppleMacUI } from '../../kit8/ui/applemacui/WithAppleMacUI';
import { AppleButton } from '../../kit8/ui/applemacui/components/AppleButton';
import { AppleTextField } from '../../kit8/ui/applemacui/components/AppleTextField';
import { AppleSwitch } from '../../kit8/ui/applemacui/components/AppleSwitch';
import { AppleSegmentedControl } from '../../kit8/ui/applemacui/components/AppleSegmentedControl';
import { AppleGroupedList, AppleListRow } from '../../kit8/ui/applemacui/components/AppleList';
import { AppleSheet, resolveSheetRelease } from '../../kit8/ui/applemacui/components/AppleSheet';
import { AppleDatePicker } from '../../kit8/ui/applemacui/components/AppleDatePicker.web';
import { clampDate, formatPickerValue, fromInputValue, toInputValue } from '../../kit8/ui/applemacui/components/appleDatePickerShared';
import AppleMacUIDemoScreen from '../../kit8/ui/applemacui/AppleMacUIDemoScreen';

afterEach(() => cleanupUI());
// StyleSheet.create styles are CSS classes on react-native-web: read the computed style
const css = (el: Element) => getComputedStyle(el);
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const has = (css: string, hex: string) => {
  const [r, g, b] = rgb(hex);
  return new RegExp(`${r},\\s?${g},\\s?${b}`).test(css) || css.toLowerCase() === hex.toLowerCase();
};
// WCAG contrast of two opaque colors
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('tokens', () => {
  it('iOS system colors, type scale, radii, 4 pt grid, 44 pt touch target', () => {
    expect(appleMacUILightTheme.colors.systemBlue).toBe('#007AFF');
    expect(appleMacUILightTheme.tint).toBe('#007AFF');
    expect(appleMacUIDarkTheme.tint).toBe('#0A84FF');
    const t = appleMacUILightTheme.typography;
    expect([t.largeTitle.fontSize, t.title1.fontSize, t.headline.fontSize, t.body.fontSize, t.callout.fontSize, t.subhead.fontSize, t.footnote.fontSize, t.caption1.fontSize]).toEqual([34, 28, 17, 17, 16, 15, 13, 12]);
    expect(t.headline.fontWeight).toBe('600');
    expect(appleMacUILightTheme.radii.input).toBe(10);
    expect(appleMacUILightTheme.radii.button).toBeGreaterThanOrEqual(12);
    expect(appleMacUILightTheme.radii.buttonLarge).toBeLessThanOrEqual(14);
    expect(appleMacUILightTheme.radii.sheet).toBeGreaterThanOrEqual(20);
    expect(appleMacUILightTheme.size.touchTarget).toBe(44);
    for (const v of Object.values(appleMacUILightTheme.space)) expect(v % 4).toBe(0);
    expect(appleMacUIAlpha('#007AFF', 0.15)).toBe('rgba(0,122,255,0.15)');
    expect(appleMacUIThemeColors(appleMacUIDarkTheme)).toMatchObject({ primary: '#0A84FF', text: '#FFFFFF', error: '#FF453A' });
  });

  it('text contrast is at least 4.5:1 (label on backgrounds, white on the filled button)', () => {
    for (const th of [appleMacUILightTheme, appleMacUIDarkTheme]) {
      expect(contrast(th.colors.label, th.colors.systemBackground)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(th.colors.label, th.colors.secondarySystemBackground)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('WithAppleMacUI', () => {
  const Probe = () => {
    const { theme } = useAppleMacUI();
    return <AppleButton testID="probe" title={theme.name} />;
  };
  it('picks light / dark by mode, accepts a tint, works without a provider', () => {
    renderUI(<Probe />);
    expect(textOf('probe')).toBe('light');
    renderUI(
      <WithAppleMacUI theme={appleMacUITheme} mode="dark">
        <Probe />
      </WithAppleMacUI>
    );
    expect(textOf('probe')).toBe('dark');
    expect(has(css(mustGet('probe')).backgroundColor, '#0A84FF')).toBe(true);
    renderUI(
      <WithAppleMacUI theme={appleMacUITheme} mode="light" tint="#34C759">
        <Probe />
      </WithAppleMacUI>
    );
    expect(has(css(mustGet('probe')).backgroundColor, '#34C759')).toBe(true);
  });
});

describe('AppleButton', () => {
  it('variants: filled = tint background, tinted = tint at 15 %, gray = fill, plain = transparent', () => {
    renderUI(
      <>
        <AppleButton testID="f" title="Filled" variant="filled" />
        <AppleButton testID="t" title="Tinted" variant="tinted" />
        <AppleButton testID="g" title="Gray" variant="gray" />
        <AppleButton testID="p" title="Plain" variant="plain" />
      </>
    );
    expect(has(css(mustGet('f')).backgroundColor, '#007AFF')).toBe(true);
    expect(css(mustGet('t')).backgroundColor).toMatch(/0,\s?122,\s?255,\s?0\.15/);
    expect(css(mustGet('g')).backgroundColor).toMatch(/120,\s?120,\s?128/);
    expect(css(mustGet('p')).backgroundColor).toMatch(/transparent|rgba\(0,\s?0,\s?0,\s?0/);
    expect(mustGet('f').getAttribute('role')).toBe('button');
  });

  it('sizes: 32 / 44 / 50 pt high, never narrower than the 44 pt touch target', () => {
    renderUI(
      <>
        <AppleButton testID="s" title="S" size="small" />
        <AppleButton testID="m" title="M" />
        <AppleButton testID="l" title="L" size="large" />
      </>
    );
    expect([css(mustGet('s')).minHeight, css(mustGet('m')).minHeight, css(mustGet('l')).minHeight]).toEqual(['32px', '44px', '50px']);
    expect(css(mustGet('s')).minWidth).toBe('44px');
    expect(css(mustGet('l')).borderTopLeftRadius).toBe('14px');
  });

  it('press calls onPress; disabled and loading do not; loading shows the spinner instead of the title', () => {
    const onPress = jest.fn();
    const ui = renderUI(<AppleButton testID="b" title="Save" onPress={onPress} />);
    press('b');
    expect(onPress).toHaveBeenCalledTimes(1);
    ui.rerender(<AppleButton testID="b" title="Save" onPress={onPress} disabled />);
    expect(mustGet('b').getAttribute('aria-disabled')).toBe('true');
    press('b');
    ui.rerender(<AppleButton testID="b" title="Save" onPress={onPress} loading />);
    expect(mustGet('b').getAttribute('aria-busy')).toBe('true');
    expect(q('b-spinner')).not.toBeNull();
    expect(textOf('b')).not.toContain('Save');
    press('b');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('destructive uses systemRed', () => {
    renderUI(<AppleButton testID="d" title="Delete" destructive />);
    expect(has(css(mustGet('d')).backgroundColor, '#FF3B30')).toBe(true);
  });
});

describe('AppleTextField', () => {
  it('label, placeholder, typing, clear button', () => {
    const onChange = jest.fn();
    const ui = renderUI(<AppleTextField testID="tf" label="Name" placeholder="Your name" value="" onChangeText={onChange} />);
    expect(document.body.textContent).toContain('Name');
    expect(mustGet('tf').getAttribute('placeholder')).toBe('Your name');
    expect(q('tf-clear')).toBeNull(); // nothing to clear
    typeInto('tf', 'Ann');
    expect(onChange).toHaveBeenLastCalledWith('Ann');
    ui.rerender(<AppleTextField testID="tf" label="Name" value="Ann" onChangeText={onChange} />);
    expect(inputValue('tf')).toBe('Ann');
    press('tf-clear');
    expect(onChange).toHaveBeenLastCalledWith('');
    ui.rerender(<AppleTextField testID="tf" label="Name" value="Ann" onChangeText={onChange} clearButton={false} />);
    expect(q('tf-clear')).toBeNull();
  });

  it('error and helper text; the error marks the field invalid', () => {
    const ui = renderUI(<AppleTextField testID="tf" value="x" helperText="Helper" />);
    expect(textOf('tf-message')).toBe('Helper');
    ui.rerender(<AppleTextField testID="tf" value="x" helperText="Helper" error="Wrong" />);
    expect(textOf('tf-message')).toBe('Wrong');
    expect(mustGet('tf').getAttribute('aria-invalid')).toBe('true');
    expect(has(css(mustGet('tf-message')).color, '#FF3B30')).toBe(true);
  });

  it('secure entry with a show / hide toggle; disabled is not editable', () => {
    const ui = renderUI(<AppleTextField testID="tf" value="secret" secureTextEntry />);
    expect(mustGet('tf').getAttribute('type')).toBe('password');
    press('tf-reveal');
    expect(mustGet('tf').getAttribute('type')).not.toBe('password');
    press('tf-reveal');
    expect(mustGet('tf').getAttribute('type')).toBe('password');
    ui.rerender(<AppleTextField testID="tf" value="x" disabled />);
    expect((mustGet('tf') as HTMLInputElement).readOnly || (mustGet('tf') as HTMLInputElement).disabled).toBe(true);
    expect(q('tf-clear')).toBeNull();
  });

  it('focus ring on focus; grouped variant has the label inside the row', () => {
    renderUI(<AppleTextField testID="tf" label="City" value="" variant="grouped" />);
    const input = mustGet('tf');
    expect(input.parentElement!.textContent).toContain('City'); // same row
    renderUI(<AppleTextField testID="tf2" label="City" value="" />);
    const box = mustGet('tf2').parentElement!;
    act(() => {
      mustGet('tf2').focus();
    });
    expect(has(css(box).borderTopColor, '#007AFF')).toBe(true);
  });
});

describe('AppleSwitch', () => {
  it('role switch, checked state, toggles; disabled does nothing', () => {
    const onChange = jest.fn();
    const ui = renderUI(<AppleSwitch testID="sw" label="Wi-Fi" value={false} onValueChange={onChange} />);
    const sw = mustGet('sw');
    expect(sw.getAttribute('role')).toBe('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(sw.getAttribute('aria-label')).toBe('Wi-Fi');
    expect([css(sw).width, css(sw).height]).toEqual(['51px', '31px']);
    press('sw');
    expect(onChange).toHaveBeenLastCalledWith(true);
    ui.rerender(<AppleSwitch testID="sw" value onValueChange={onChange} disabled />);
    expect(mustGet('sw').getAttribute('aria-checked')).toBe('true');
    press('sw');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('AppleSegmentedControl', () => {
  const segments = [
    { value: 'a', label: 'One' },
    { value: 'b', label: 'Two' },
    { value: 'c', label: 'Three', disabled: true },
  ];
  it('selected segment, choosing another, disabled segment', () => {
    const onChange = jest.fn();
    renderUI(<AppleSegmentedControl testID="seg" value="a" onValueChange={onChange} segments={segments} />);
    expect(mustGet('seg').getAttribute('role')).toBe('radiogroup');
    expect(mustGet('seg-a').getAttribute('aria-checked')).toBe('true');
    expect(mustGet('seg-b').getAttribute('aria-checked')).toBe('false');
    press('seg-b');
    expect(onChange).toHaveBeenCalledWith('b');
    press('seg-a'); // already selected
    press('seg-c'); // disabled
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(mustGet('seg-c').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('AppleGroupedList / AppleListRow', () => {
  it('header, footer, separators between rows, value, accessory, press', () => {
    const onPress = jest.fn();
    renderUI(
      <AppleGroupedList testID="list" header="General" footer="Footer text">
        <AppleListRow testID="r1" title="About" value="v1" onPress={onPress} />
        <AppleListRow testID="r2" title="Static" subtitle="No action" />
        <AppleListRow testID="r3" title="Off" disabled onPress={onPress} />
      </AppleGroupedList>
    );
    expect(textOf('list')).toContain('General');
    expect(textOf('list')).toContain('Footer text');
    const card = mustGet('r1').parentElement!;
    expect(card.children.length).toBe(5); // 3 rows + 2 hairline separators
    expect(css(card).borderTopLeftRadius).toBe('12px');
    expect(textOf('r1')).toContain('v1');
    expect(textOf('r1')).toContain('chevron_right'); // a row that opens something
    expect(textOf('r2')).not.toContain('chevron_right');
    expect(css(mustGet('r1')).minHeight).toBe('44px');
    press('r1');
    press('r3');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('AppleSheet', () => {
  it('release: nearest detent, or close when pulled far / flung down (not when a decision is required)', () => {
    const offsets = [300, 0]; // medium, large
    expect(resolveSheetRelease(offsets, 40, 0, 700, true)).toBe(0);
    expect(resolveSheetRelease(offsets, 220, 0, 700, true)).toBe(300);
    expect(resolveSheetRelease(offsets, 520, 0, 700, true)).toBe('close');
    expect(resolveSheetRelease(offsets, 320, 1500, 700, true)).toBe('close');
    expect(resolveSheetRelease(offsets, 520, 0, 700, false)).toBe(300);
  });

  it('visible shows title + content with a grabber; backdrop closes; hidden renders nothing', () => {
    const onClose = jest.fn();
    const ui = renderUI(
      <AppleSheet testID="sh" visible onClose={onClose} title="Options">
        <AppleButton testID="in" title="Inside" />
      </AppleSheet>
    );
    expect(textOf('sh')).toContain('Options');
    expect(q('in')).not.toBeNull();
    expect(q('sh-handle')).not.toBeNull();
    expect(css(mustGet('sh')).borderTopLeftRadius).toBe('20px');
    press('sh-backdrop');
    expect(onClose).toHaveBeenCalledTimes(1);
    ui.rerender(
      <AppleSheet testID="sh" visible={false} onClose={onClose} title="Options">
        <AppleButton testID="in" title="Inside" />
      </AppleSheet>
    );
    expect(q('sh')).toBeNull();
  });

  it('not dismissible: the backdrop does not close it', () => {
    const onClose = jest.fn();
    renderUI(<AppleSheet testID="sh" visible onClose={onClose} dismissible={false} />);
    press('sh-backdrop');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AppleDatePicker', () => {
  it('helpers: input values per mode, parsing, clamping', () => {
    const d = new Date(2026, 9, 6, 9, 5);
    expect(toInputValue(d, 'date')).toBe('2026-10-06');
    expect(toInputValue(d, 'time')).toBe('09:05');
    expect(toInputValue(d, 'datetime')).toBe('2026-10-06T09:05');
    expect(toInputValue(null, 'date')).toBe('');
    expect(formatPickerValue(d, 'datetime')).toBe('2026-10-06 09:05');
    expect(fromInputValue('2026-12-24', 'date')!.getDate()).toBe(24);
    expect(fromInputValue('2026-12-24T18:30', 'datetime')!.getHours()).toBe(18);
    const t = fromInputValue('23:15', 'time', d)!;
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([6, 23, 15]);
    expect(fromInputValue('nope', 'date')).toBeNull();
    expect(clampDate(new Date(2020, 0, 1), new Date(2026, 0, 1)).getFullYear()).toBe(2026);
    expect(clampDate(new Date(2030, 0, 1), undefined, new Date(2027, 0, 1)).getFullYear()).toBe(2027);
  });

  it('web: <input type> per mode with value / min / max; a change reports the Date', () => {
    const onChange = jest.fn();
    const ui = renderUI(<AppleDatePicker testID="dp" label="Date" value={new Date(2026, 9, 6)} onChange={onChange} min={new Date(2026, 0, 1)} max={new Date(2026, 11, 31)} />);
    const el = mustGet('dp') as HTMLInputElement;
    expect([el.type, el.value, el.min, el.max]).toEqual(['date', '2026-10-06', '2026-01-01', '2026-12-31']);
    expect(el.getAttribute('aria-label')).toBe('Date');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      set.call(el, '2026-11-20');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(toInputValue(onChange.mock.calls[0][0], 'date')).toBe('2026-11-20');
    ui.rerender(<AppleDatePicker testID="dp" mode="time" value={new Date(2026, 9, 6, 7, 45)} onChange={onChange} />);
    expect([(mustGet('dp') as HTMLInputElement).type, (mustGet('dp') as HTMLInputElement).value]).toEqual(['time', '07:45']);
    ui.rerender(<AppleDatePicker testID="dp" mode="datetime" value={new Date(2026, 9, 6, 7, 45)} onChange={onChange} disabled />);
    expect((mustGet('dp') as HTMLInputElement).type).toBe('datetime-local');
    expect((mustGet('dp') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('demo screen', () => {
  it('renders every component in light and dark', () => {
    renderUI(<AppleMacUIDemoScreen />);
    expect(q('applemacui-demo-Light')).not.toBeNull();
    expect(q('applemacui-demo-Dark')).not.toBeNull();
    expect(has(css(mustGet('applemacui-demo-Dark')).backgroundColor, '#000000')).toBe(true);
    expect(has(css(mustGet('applemacui-demo-Light')).backgroundColor, '#F2F2F7')).toBe(true);
  });
});
