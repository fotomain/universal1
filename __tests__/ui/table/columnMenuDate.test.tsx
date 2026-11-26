/** @jest-environment jsdom */
// Filter & Sort popup of a DATE column: the select list of the operators, the typed day is written as YYYY-MM-DD, a value that is no date keeps the popup open.
// TextInputApp is replaced by a plain input here; this test is about what the popup stores.
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, placeholder, iconsNotTabbable }: any) => R.createElement(TextInput, { testID, value, onChangeText, placeholder, dataSet: { iconsNotTabbable: iconsNotTabbable ? 'true' : 'false' } }) };
});

import ReusableTableColumnMenu from '../../../kit8/ui/components/table/reusable/ReusableTableColumnMenu';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const T = 'dm';
const q = (id: string) => document.querySelector(`[data-testid="${T}-column-menu-${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const typeIn = (id: string, text: string) => {
  const input = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })); });
};
const dateCol = { key: 'due', title: 'Due', type: 'date' } as any;

function mount(extra: any = {}) {
  const onFilter = jest.fn();
  const onClose = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTableColumnMenu col={dateCol} x={10} y={10} sort={null} onSort={jest.fn()} onFilter={onFilter} onClose={onClose} testID={T} {...extra} />));
  return { onFilter, onClose };
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

it('a date column offers the number operators, starts with "is exactly" and has a text field', () => {
  mount();
  expect(q('op-selected')!.textContent).toBe('is exactly (=)');
  expect(q('value')).not.toBeNull();
  expect(q('value2')).toBeNull();
  press('op-select');
  ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'oneOf', 'empty', 'notEmpty'].forEach((o) => expect(q(`op-${o}`)).not.toBeNull());
});

it('Apply writes the typed day as YYYY-MM-DD', () => {
  const { onFilter, onClose } = mount();
  typeIn('value', '05.01.2026');
  press('apply');
  expect(onFilter).toHaveBeenCalledWith({ op: 'eq', value: '2026-01-05' });
  expect(onClose).toHaveBeenCalled();
});

it('between has From and To, both are written as days; a text that is no date keeps the popup open', () => {
  const { onFilter, onClose } = mount();
  press('op-select');
  press('op-between');
  expect(q('value2')).not.toBeNull();
  typeIn('value', '20260101');
  typeIn('value2', 'soon');
  press('apply');
  expect(q('invalid')!.textContent).toContain('date');
  expect(onFilter).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  typeIn('value2', '31.01.2026');
  press('apply');
  expect(onFilter).toHaveBeenCalledWith({ op: 'between', value: '2026-01-01', value2: '2026-01-31' });
});

it('one of takes a list of days; empty needs no value; the stored filter comes back in the popup', () => {
  const { onFilter } = mount();
  press('op-select');
  press('op-oneOf');
  typeIn('value', '2026-01-05, 06.01.2026');
  press('apply');
  expect(onFilter).toHaveBeenCalledWith({ op: 'oneOf', value: '2026-01-05, 2026-01-06' });
  act(() => root.unmount());
  document.body.innerHTML = '';
  const again = mount({ filter: { op: 'between', value: '2026-01-01', value2: '2026-01-31' } });
  expect(q('op-selected')!.textContent).toBe('is between (..)');
  expect((q('value') as HTMLInputElement).value).toBe('2026-01-01');
  expect((q('value2') as HTMLInputElement).value).toBe('2026-01-31');
  press('op-select');
  press('op-empty');
  expect(q('value')).toBeNull();
  press('apply');
  expect(again.onFilter).toHaveBeenCalledWith({ op: 'empty' });
});

it('eight digits turn into YYYY-MM-DD while typing (not in a list) and the clear icons are skipped by Tab', () => {
  mount();
  expect(q('value')!.getAttribute('data-icons-not-tabbable')).toBe('true');
  typeIn('value', '2026113');
  expect((q('value') as HTMLInputElement).value).toBe('2026113');
  typeIn('value', '20261130');
  expect((q('value') as HTMLInputElement).value).toBe('2026-11-30');
  press('op-select');
  press('op-oneOf');
  typeIn('value', '20261130');
  expect((q('value') as HTMLInputElement).value).toBe('20261130');
});

it('between: +5 / -5 in one field is days from the other; the stored filter holds the two real days', () => {
  const { onFilter, onClose } = mount();
  press('op-select');
  press('op-between');
  expect(q('between-hint')!.textContent).toContain('+5 or -5');
  typeIn('value', '2026-11-30');
  typeIn('value2', '+5');
  press('apply');
  expect(onFilter).toHaveBeenLastCalledWith({ op: 'between', value: '2026-11-30', value2: '2026-12-05' });
  expect(onClose).toHaveBeenCalledTimes(1);
  typeIn('value', '-5');
  typeIn('value2', '30.11.2026');
  press('apply');
  expect(onFilter).toHaveBeenLastCalledWith({ op: 'between', value: '2026-11-25', value2: '2026-11-30' });
  typeIn('value', '2026-12-30');
  typeIn('value2', '-3');
  press('apply');
  expect(onFilter).toHaveBeenLastCalledWith({ op: 'between', value: '2026-12-30', value2: '2026-12-27' });  // backwards: the filter orders the ends
});

it('between: both fields relative, or no date in the other field, is refused with a message', () => {
  const { onFilter, onClose } = mount();
  press('op-select');
  press('op-between');
  typeIn('value', '+1');
  typeIn('value2', '-1');
  press('apply');
  expect(q('invalid')!.textContent).toContain('Only one');
  typeIn('value', '');
  typeIn('value2', '+5');
  press('apply');
  expect(q('invalid')!.textContent).toContain('Type a date');
  expect(onFilter).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
