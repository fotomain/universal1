/** @jest-environment jsdom */
// The calculator in the app: the icon at the right of a numeric field (PMNumberInputApp, NumberInputApp), OK closes it and assigns the result, Cancel
// changes nothing; the standalone window from the app bar menu; the texts follow the language; the columns of the task lines / documents carry it.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }: any) => R.createElement(Text, null, name) };
});
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
let mockLanguage = 'en';
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (k: string) => (mockLanguage === 'ru' && k === 'calculator.cancel' ? 'Отмена' : k),
    i18n: { language: mockLanguage },
  }),
}));

import PMNumberInputApp from '../../../kit8/pm/components/PMNumberInputApp';
import { NumberInputApp } from '../../../kit8/ui/components/common/NumberInputApp';
import CalculatorWindowHost, { clampCalculatorWindow } from '../../../kit8/ui/components/calculator/CalculatorWindowHost';
import { getCalculatorState, openCalculatorWindow, resetCalculatorStore, toggleCalculatorWindow } from '../../../kit8/ui/components/calculator/calculatorStore';
import { CALCULATOR_TEXTS_EN } from '../../../kit8/ui/components/calculator/calculatorTexts';

let root: any;
let host: HTMLElement;
const mount = (el: React.ReactElement) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(el));
};
const $ = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const click = (id: string) => act(() => { ($(id) as HTMLElement).click(); });
let panel = 'qty-calculator-panel';                     // the testID of the panel that is open
const press = (...keys: string[]) => keys.forEach((k) => click(`${panel}-key-${k}`));
const resultText = () => $(`${panel}-result`)?.textContent;
beforeEach(() => { panel = 'qty-calculator-panel'; mockLanguage = 'en'; resetCalculatorStore(); });
afterEach(() => { act(() => root?.unmount()); host?.remove(); document.body.innerHTML = ''; });

describe('the icon at the right of a PMNumberInputApp', () => {
  const field = (onCommit: jest.Mock, extra: any = {}) => (
    <PMNumberInputApp testID="qty" tableName="task_line_table" tableFieldName="qtyTaskLine" value={10} onCommit={onCommit} {...extra} />
  );

  it('is there by default and can be switched off', () => {
    mount(field(jest.fn()));
    expect($('qty-calculator')).not.toBeNull();
    act(() => root.unmount());
    host.remove();
    mount(field(jest.fn(), { calculator: false }));
    expect($('qty-calculator')).toBeNull();
  });

  it('is not there for a read only cell', () => {
    mount(field(jest.fn(), { editable: false }));
    expect($('qty-calculator')).toBeNull();
  });

  it('opens with the number of the field; OK closes it and assigns the result', () => {
    const onCommit = jest.fn();
    mount(field(onCommit));
    click('qty-calculator');
    expect($('qty-calculator-panel')).not.toBeNull();
    expect(resultText()).toBe('10');
    press('*', '2', '5', '+', '3');           // 10 * 25 + 3 (the typed 2 replaces nothing: an operator continued the 10)
    expect(resultText()).toBe('253');
    click('qty-calculator-panel-ok');
    expect($('qty-calculator-panel')).toBeNull();
    expect(onCommit).toHaveBeenCalledWith(253);
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('253');
  });

  it('Cancel changes nothing', () => {
    const onCommit = jest.fn();
    mount(field(onCommit));
    click('qty-calculator');
    press('+', '5');
    click('qty-calculator-panel-cancel');
    expect($('qty-calculator-panel')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    expect((document.querySelector('input') as HTMLInputElement).value).toBe('10');
  });

  it('positiveOnly: a negative result is kept at 0; a wrong expression keeps the window open', () => {
    const onCommit = jest.fn();
    mount(field(onCommit));
    click('qty-calculator');
    press('-', '5', '0');
    click('qty-calculator-panel-ok');
    expect(onCommit).toHaveBeenCalledWith(0);
    click('qty-calculator');
    press('clear', '5', '/', '0');
    click('qty-calculator-panel-ok');
    expect($('qty-calculator-panel')).not.toBeNull();
    expect(resultText()).toBe(CALCULATOR_TEXTS_EN.errDivZero);
  });

  it('OK with nothing typed and no number in the field closes without a value', () => {
    const onCommit = jest.fn();
    mount(field(onCommit, { value: null }));
    click('qty-calculator');
    click('qty-calculator-panel-ok');
    expect($('qty-calculator-panel')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('an integer field rounds the result', () => {
    const onCommit = jest.fn();
    mount(field(onCommit, { integer: true, value: 3 }));
    click('qty-calculator');
    press('/', '2');
    click('qty-calculator-panel-ok');
    expect(onCommit).toHaveBeenCalledWith(2);   // 1.5 -> 2
  });
});

describe('the language', () => {
  it('the decimal key and the Cancel text follow the language of the user', () => {
    mockLanguage = 'ru';
    mount(<PMNumberInputApp testID="qty" tableName="t" tableFieldName="f" value={1.5} onCommit={jest.fn()} />);
    click('qty-calculator');
    expect(resultText()).toBe('1,5');
    expect($('qty-calculator-panel-key-.')?.textContent).toBe(',');
    expect($('qty-calculator-panel-cancel')?.textContent).toBe('Отмена');
    expect($('qty-calculator-panel-ok')?.textContent).toBe('OK');         // no translation key in the mock: the English text is the fallback
  });
});

describe('NumberInputApp (the other numeric fields)', () => {
  it('calculator is opt-in; OK writes the result through onChangeText / onChangeValue', () => {
    const onChangeValue = jest.fn();
    const onChangeText = jest.fn();
    mount(<NumberInputApp testID="n" value="4" onChangeValue={onChangeValue} onChangeText={onChangeText} />);
    expect($('n-calculator')).toBeNull();
    act(() => root.unmount());
    host.remove();
    mount(<NumberInputApp testID="n" value="4" calculator onChangeValue={onChangeValue} onChangeText={onChangeText} />);
    panel = 'n-calculator-panel';
    click('n-calculator');
    press('*', '6');
    click('n-calculator-panel-ok');
    expect(onChangeValue).toHaveBeenCalledWith(24);
    expect(onChangeText).toHaveBeenCalledWith('24');
  });
});

describe('the standalone window', () => {
  it('opens and closes from the store (the app bar menu item toggles it), no backdrop: the screen below stays usable', () => {
    mount(<CalculatorWindowHost />);
    expect($('calculator-window')).toBeNull();
    act(() => openCalculatorWindow());
    expect($('calculator-window')).not.toBeNull();
    expect($('calculator-window-layer')).not.toBeNull();
    click('calculator-window-x');
    expect($('calculator-window')).toBeNull();
    act(() => toggleCalculatorWindow());
    expect($('calculator-window')).not.toBeNull();
    act(() => toggleCalculatorWindow());
    expect($('calculator-window')).toBeNull();
  });

  it('calculates and the memory is shared with the calculator of a field', () => {
    mount(<><CalculatorWindowHost /><PMNumberInputApp testID="qty" tableName="t" tableFieldName="f" value={1} onCommit={jest.fn()} /></>);
    act(() => openCalculatorWindow());
    const k = (key: string) => click(`calculator-window-app-key-${key}`);
    ['7', '*', '6', 'mplus'].forEach(k);                      // M+ keeps 42
    expect(getCalculatorState().memory).toBe(42);
    expect($('calculator-window-app-result')?.textContent).toBe('42');
    expect($('calculator-window-app-copy')).not.toBeNull();
    click('calculator-window-app-close');
    expect($('calculator-window')).toBeNull();
    click('qty-calculator');
    expect($('qty-calculator-panel-memory')?.style.opacity ?? '1').toBe('1');   // the M mark is on
    press('clear', 'mr');
    expect(resultText()).toBe('42');
  });

  it('clampCalculatorWindow keeps the title bar on the screen', () => {
    expect(clampCalculatorWindow(-50, -50, 1000, 800)).toEqual({ x: 0, y: 0 });
    expect(clampCalculatorWindow(5000, 5000, 1000, 800).x).toBeLessThan(1000);
    expect(clampCalculatorWindow(5000, 5000, 1000, 800).y).toBeLessThan(800);
    expect(clampCalculatorWindow(100, 120, 1000, 800)).toEqual({ x: 100, y: 120 });
  });
});

describe('where the calculator is mounted', () => {
  const root_ = path.resolve(__dirname, '../../..');
  const read = (f: string) => fs.readFileSync(path.join(root_, f), 'utf8');
  it('every editable number column of the task lines and documents goes through pmNumberColumn, which uses PMNumberInputApp (calculator on)', () => {
    expect(read('kit8/pm/components/pmNumberColumn.tsx')).toContain('PMNumberInputApp');
    expect(read('kit8/pm/components/PMNumberInputApp.tsx')).toContain('calculator = true');
  });
  it('the app bar three dots menu has the Calculator item, the root layout mounts the window host', () => {
    expect(read('kit8/ui/components/common/ApplicationBarApp.tsx')).toContain("t('calculator.menu')");
    expect(read('app/_layout.tsx')).toContain('<CalculatorWindowHost />');
  });
  it('all 15 languages have the calculator texts with the same keys as English', () => {
    const src = read('kit8/i18n/i18n.ts');
    const blocks = src.split('      calculator: {').slice(1).map((b) => b.split('      },')[0]);
    expect(blocks).toHaveLength(15);
    const keysOf = (b: string) => Array.from(b.matchAll(/^\s+(\w+):/gm)).map((m) => m[1]);
    const en = keysOf(blocks[0]);
    expect(en.sort()).toEqual(Object.keys(CALCULATOR_TEXTS_EN).sort());
    blocks.forEach((b) => expect(keysOf(b).sort()).toEqual(en));
  });
});
