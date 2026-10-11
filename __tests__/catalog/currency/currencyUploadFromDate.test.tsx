/** @jest-environment jsdom */
// The "Upload all data from a date" button of a currency card: opens the dialog with a date (DateInputApp), Upload calls onUploadFromDate(id, date).
import React, { act } from 'react';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../kit8/ui/components/common/IconApp', () => () => null);
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/date_input/DateInputApp', () => {
  const R = require('react');
  const { TextInput, Text, View } = require('react-native');
  return { __esModule: true, default: ({ testID, value, onChangeText, error }: any) => R.createElement(View, null, R.createElement(TextInput, { testID, value, onChangeText }), error ? R.createElement(Text, { testID: `${testID}-error` }, String(error)) : null) };
});

import CurrencyCard from '../../../kit8/catalog/currency/CurrencyCard';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });
const typeInto = (id: string, text: string) => {
  const el = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, text); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
let root: any;
const card = { id: 'g', title: 'Pound', rawItem: { rowGUID: 'g', rowJSON: { currencyCode: 'GBP', currencyName: 'Pound' } } } as any;
function mount(onUploadFromDate?: any) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<CurrencyCard card={card} onUploadFromDate={onUploadFromDate} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

it('no button without the handler', () => {
  mount();
  expect(q('currency-card-upload-g')).toBeNull();
});

it('the button opens the dialog with a date a year back; a wrong date blocks Upload; Upload sends the card and the date, a success closes the dialog', async () => {
  const onUpload = jest.fn(async () => true);
  mount(onUpload);
  expect(q('currency-card-upload-modal-g')).toBeNull();
  press('currency-card-upload-g');
  expect(q('currency-card-upload-modal-g')).not.toBeNull();
  const first = (q('currency-card-upload-modal-g-date') as HTMLInputElement).value;
  expect(first).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  typeInto('currency-card-upload-modal-g-date', '2026-13-40');
  expect(q('currency-card-upload-modal-g-date-error')!.textContent).toMatch(/YYYY-MM-DD/);
  press('currency-card-upload-modal-g-ok');
  expect(onUpload).not.toHaveBeenCalled();
  typeInto('currency-card-upload-modal-g-date', '2025-01-01');
  await act(async () => { (q('currency-card-upload-modal-g-ok') as any).click(); await Promise.resolve(); await Promise.resolve(); });
  expect(onUpload).toHaveBeenCalledWith('g', '2025-01-01');
  expect(q('currency-card-upload-modal-g')).toBeNull();
});

it('a failed upload keeps the dialog open; Cancel closes it without a call', async () => {
  const onUpload = jest.fn(async () => false);
  mount(onUpload);
  press('currency-card-upload-g');
  await act(async () => { (q('currency-card-upload-modal-g-ok') as any).click(); });
  expect(onUpload).toHaveBeenCalledTimes(1);
  expect(q('currency-card-upload-modal-g')).not.toBeNull();
  press('currency-card-upload-modal-g-cancel');
  expect(q('currency-card-upload-modal-g')).toBeNull();
  expect(onUpload).toHaveBeenCalledTimes(1);
});
