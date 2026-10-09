/** @jest-environment jsdom */
// kit8/catalog/currency/exchange/CurrencyExchangeEdit: one rate per currency per day, create / update (moves
// rowParentGUID with the date), realtime from another browser, scoped subscription.
import React, { act } from 'react';

const mockReplace = jest.fn();
let mockParams: any = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }), useLocalSearchParams: () => mockParams, router: { push: jest.fn() } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-rate-1' }));
jest.mock('../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../kit8/ui/components/common/IconApp', () => () => null);
jest.mock('../../../../kit8/ui/components/common/SegmentButtonsApp', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ buttons, value, onValueChange, testID }: any) => R.createElement(View, { testID, 'data-value': value },
    buttons.map((b: any) => R.createElement(Pressable, { key: b.value, testID: b.testID, 'aria-selected': b.value === value, onPress: () => onValueChange(b.value) }, R.createElement(Text, null, b.label)))) };
});
jest.mock('../../../../kit8/ui/components/common', () => {
  const R = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');
  const Btn = ({ testID, onPress, disabled, children }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, children));
  return {
    ButtonPrimaryApp: Btn,
    ButtonTextApp: Btn,
    TextInputApp: ({ testID, value, onChangeText, error, showError }: any) =>
      R.createElement(View, null, R.createElement(TextInput, { testID, value, onChangeText }), showError ? R.createElement(Text, { testID: `${testID}-error` }, error) : null),
  };
});

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { reusableCrudSlice } from '../../../../kit8/redux/reusable/reusableCrudSlice';
import { SystemMetaData } from '../../../../kit8/redux/SystemMetaData';
import CurrencyExchangeEdit from '../../../../kit8/catalog/currency/exchange/CurrencyExchangeEdit';
import { __resetRealtimeEntityUsers } from '../../../../kit8/redux/reusable/useRealtimeEntity';
import { orderInListForDate } from '../../../../kit8/catalog/currency/exchange/currencyExchangeModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const E = 'currencyExchangeRateReusable';
const slice = reusableCrudSlice(E);
const cslice = reusableCrudSlice('currencyReusable');
SystemMetaData[E].actions = slice.actions;
SystemMetaData.currencyReusable.actions = cslice.actions;
const USD = { rowGUID: 'usd', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', orderInList: 1, rowJSON: { currencyCode: 'USD', currencyName: 'US Dollar', currencySymbol: '$', decimalDigits: 2, isActive: true } };
const R1 = { rowGUID: 'r1', rowOwnerGUID: 'usd', rowParentGUID: '2026-09-28', orderInList: orderInListForDate('2026-09-28'), updated_at: 't1', rowJSON: { startingDate: '2026-09-28', currencyRatio: 1.08 } };
const G1 = { rowGUID: 'g1', rowOwnerGUID: 'gbp', rowParentGUID: '2026-09-29', orderInList: 0, rowJSON: { startingDate: '2026-09-29', currencyRatio: 0.85 } };

let store: any;
let dispatched: any[] = [];
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });
const typeInto = (id: string, text: string) => {
  const el = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, text); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const value = (id: string) => (q(id) as HTMLInputElement).value;
const chosenType = () => ['Default', 'Budget'].find((t) => q(`currency-exchange-edit-rateType-${t}`)?.getAttribute('aria-selected') === 'true');

function mount(params: any, rows: any[] = [R1, G1]) {
  if (root) act(() => root.unmount());
  __resetRealtimeEntityUsers();
  mockParams = params;
  dispatched = [];
  store = configureStore({
    reducer: { [E]: slice.reducer, currencyReusable: cslice.reducer },
    middleware: (g) => g({ serializableCheck: false }).concat(() => (next: any) => (a: any) => (dispatched.push(a), next(a))),
  });
  act(() => { store.dispatch(slice.actions.readDataSuccess({ data: rows })); store.dispatch(cslice.actions.readDataSuccess({ data: [USD] })); });
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<Provider store={store}><CurrencyExchangeEdit /></Provider>));
}
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ''; __resetRealtimeEntityUsers(); jest.clearAllMocks(); });
const remote = (change: any) => act(() => { store.dispatch(slice.actions.applyRealtimeChange(change)); });

it('subscribes to the rates of THIS currency (readParams.match) and shows the currency code', () => {
  mount({ currencyGUID: 'usd', rowGUID: 'r1' });
  const start = dispatched.find((a) => a.type === `${E}/startRealtime`);
  expect(start.payload.readParams.match).toEqual({ rowOwnerGUID: 'usd' });
  expect(q('currency-exchange-edit-title')!.textContent).toBe('USD rate');
  expect(value('currency-exchange-edit-currencyRatio')).toBe('1.08');
});

it('new rate: one per day (other currencies do not count), then createOne with owner = currency, parent = day', () => {
  mount({ currencyGUID: 'usd' });
  typeInto('currency-exchange-edit-startingDate', '2026-09-28');
  typeInto('currency-exchange-edit-currencyRatio', '1,09');
  press('currency-exchange-edit-save');
  expect(q('currency-exchange-edit-startingDate-error')!.textContent).toMatch(/already exists/);
  expect(q('currency-exchange-edit-open-duplicate')).not.toBeNull();
  expect(dispatched.some((a) => a.type === `${E}/createOne`)).toBe(false);

  press('currency-exchange-edit-next-day'); // 2026-09-29 (GBP has a rate that day - irrelevant)
  expect(value('currency-exchange-edit-startingDate')).toBe('2026-09-29');
  press('currency-exchange-edit-save');
  const create = dispatched.find((a) => a.type === `${E}/createOne`);
  expect(create.payload).toEqual({
    rowGUID: 'new-rate-1', rowOwnerGUID: 'usd', rowParentGUID: '2026-09-29', orderInList: orderInListForDate('2026-09-29'),
    rowJSON: { startingDate: '2026-09-29', currencyRatio: 1.09, rateType: 'Default' },
  });
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/currency/exchange/list', params: { currencyGUID: 'usd' } });
});

it('existing rate: a new date moves rowParentGUID + orderInList; sql_for_delete asks twice', () => {
  mount({ currencyGUID: 'usd', rowGUID: 'r1' });
  press('currency-exchange-edit-prev-day');
  typeInto('currency-exchange-edit-currencyRatio', '1.07');
  press('currency-exchange-edit-save');
  expect(dispatched.find((a) => a.type === `${E}/updateOne`).payload).toEqual({
    rowGUID: 'r1', rowOwnerGUID: 'usd', rowJSON: { startingDate: '2026-09-27', currencyRatio: 1.07, rateType: 'Default' },
    orderInList: orderInListForDate('2026-09-27'), columns: { rowParentGUID: '2026-09-27' },
  });
  mount({ currencyGUID: 'usd', rowGUID: 'r1' });
  press('currency-exchange-edit-sql_for_delete');
  expect(dispatched.some((a) => a.type === `${E}/deleteOne`)).toBe(false);
  press('currency-exchange-edit-sql_for_delete');
  expect(dispatched.find((a) => a.type === `${E}/deleteOne`).payload).toEqual({ rowGUID: 'r1', rowOwnerGUID: 'usd' });
});

it('changed in another browser: clean form follows; dirty form offers Reload; deleted blocks saving', () => {
  mount({ currencyGUID: 'usd', rowGUID: 'r1' });
  remote({ eventType: 'UPDATE', table: 't', new: { ...R1, updated_at: 't2', rowJSON: { ...R1.rowJSON, currencyRatio: 1.1 } }, old: null });
  expect(value('currency-exchange-edit-currencyRatio')).toBe('1.1');
  typeInto('currency-exchange-edit-currencyRatio', '2');
  remote({ eventType: 'UPDATE', table: 't', new: { ...R1, updated_at: 't3', rowJSON: { ...R1.rowJSON, currencyRatio: 1.2 } }, old: null });
  expect(q('currency-exchange-edit-remote-changed')).not.toBeNull();
  expect(value('currency-exchange-edit-currencyRatio')).toBe('2');
  press('currency-exchange-edit-reload');
  expect(value('currency-exchange-edit-currencyRatio')).toBe('1.2');

  remote({ eventType: 'DELETE', table: 't', new: null, old: { rowGUID: 'r1' } });
  expect(q('currency-exchange-edit-gone')!.textContent).toMatch(/deleted in another window/);
  press('currency-exchange-edit-save');
  expect(dispatched.some((a) => a.type === `${E}/updateOne`)).toBe(false);
});

describe('rate type (Default | Budget, as D365 FO)', () => {
  it('a Default rate and a Budget rate of the same day can both exist: the key of a Budget rate is "day|Budget"', () => {
    mount({ currencyGUID: 'usd' });
    expect(chosenType()).toBe('Default');
    typeInto('currency-exchange-edit-startingDate', '2026-09-28'); // R1 is a Default rate of that day
    typeInto('currency-exchange-edit-currencyRatio', '1,20');
    press('currency-exchange-edit-rateType-Budget');
    expect(chosenType()).toBe('Budget');
    press('currency-exchange-edit-save');
    expect(q('currency-exchange-edit-startingDate-error')).toBeNull();
    const create = dispatched.find((a) => a.type === `${E}/createOne`);
    expect(create.payload).toEqual({
      rowGUID: 'new-rate-1', rowOwnerGUID: 'usd', rowParentGUID: '2026-09-28|Budget', orderInList: orderInListForDate('2026-09-28'),
      rowJSON: { startingDate: '2026-09-28', currencyRatio: 1.2, rateType: 'Budget' },
    });
  });

  it('two rates of the same type and day are refused, with a link to the existing one', () => {
    const B1 = { ...R1, rowGUID: 'b1', rowParentGUID: '2026-09-28|Budget', rowJSON: { startingDate: '2026-09-28', currencyRatio: 1.2, rateType: 'Budget' } };
    mount({ currencyGUID: 'usd' }, [R1, B1, G1]);
    typeInto('currency-exchange-edit-startingDate', '2026-09-28');
    typeInto('currency-exchange-edit-currencyRatio', '1.3');
    press('currency-exchange-edit-rateType-Budget');
    press('currency-exchange-edit-save');
    expect(q('currency-exchange-edit-startingDate-error')!.textContent).toMatch(/Budget rate for 2026-09-28 already exists/);
    expect(dispatched.some((a) => a.type === `${E}/createOne`)).toBe(false);
    press('currency-exchange-edit-open-duplicate');
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/currency/exchange/edit', params: { currencyGUID: 'usd', rowGUID: 'b1' } });
  });

  it('an existing Budget rate opens with its type; changing the type moves rowParentGUID', () => {
    const B1 = { ...R1, rowGUID: 'b1', rowParentGUID: '2026-09-28|Budget', rowJSON: { startingDate: '2026-09-28', currencyRatio: 1.2, rateType: 'Budget' } };
    mount({ currencyGUID: 'usd', rowGUID: 'b1' }, [B1]);
    expect(chosenType()).toBe('Budget');
    press('currency-exchange-edit-rateType-Default');
    press('currency-exchange-edit-save');
    expect(dispatched.find((a) => a.type === `${E}/updateOne`).payload).toMatchObject({ rowGUID: 'b1', columns: { rowParentGUID: '2026-09-28' }, rowJSON: { rateType: 'Default' } });
  });
});
