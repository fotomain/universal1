/** @jest-environment jsdom */
// ColorPickerApp: Default chip, quick swatches, Custom chip (shows a custom value), normalizeHexColor.
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import ColorPickerApp, { normalizeHexColor } from '../kit8/components/common/ColorPickerApp';

jest.mock('../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { text: '#000', border: '#ccc', background: '#fff', primary: '#6366f1' } }),
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const colors = { text: '#000', border: '#ccc', background: '#fff', primary: '#6366f1' };
let root: Root | null = null;
let host: HTMLElement;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (p: string) => Array.from(document.querySelectorAll(`[data-testid^="${p}"]`)).map((e) => e.getAttribute('data-testid'));
const press = (id: string) => act(() => { q(id)!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
function render(el: React.ReactElement) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(el));
}
afterEach(() => { act(() => root?.unmount()); root = null; host?.remove(); });

describe('normalizeHexColor', () => {
  it('normalizes to #RRGGBB upper case', () => {
    expect(normalizeHexColor('#abc')).toBe('#AABBCC');
    expect(normalizeHexColor('4455ff')).toBe('#4455FF');
    expect(normalizeHexColor('#11223344')).toBe('#112233');
    expect(normalizeHexColor('nope')).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
  });
});

describe('ColorPickerApp', () => {
  it('renders Default + swatches + Custom; pressing them reports the color', () => {
    const onChange = jest.fn();
    render(<ColorPickerApp testID="cp" value={null} onChange={onChange} defaultColor="#FF0033" swatches={['#000000', '#4455ff']} colors={colors} />);
    expect(qa('cp-')).toEqual(['cp-default', 'cp-#000000', 'cp-#4455FF', 'cp-custom']);
    press('cp-#4455FF');
    press('cp-default');
    expect(onChange.mock.calls).toEqual([['#4455FF'], [null]]);
  });

  it('a value outside the swatches is shown on the Custom chip', () => {
    render(<ColorPickerApp testID="cp" value="#123abc" onChange={() => {}} swatches={['#000000']} colors={colors} />);
    expect(q('cp-default')).toBeNull();
    expect(q('cp-custom')!.textContent).toContain('#123ABC');
  });
});
