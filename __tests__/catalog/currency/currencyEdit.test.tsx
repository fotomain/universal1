/** @jest-environment jsdom */
// kit8/catalog/currency/CurrencyEdit: create / update through the reusable saga actions; the form follows
// realtime changes made in another browser (clean form: updates; dirty form: Reload / Keep mine; deleted).
import React, { act } from 'react';

const mockReplace = jest.fn();
let mockParams: any = {};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }), useLocalSearchParams: () => mockParams, router: { push: mockPush } }));
jest.mock('../../../kit8/ui/components/common/IconApp', () => () => null);
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-guid-1' }));
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common', () => {
  const R = require('react');
  const { Pressable, Text, TextInput, Switch, View } = require('react-native');
  const Btn = ({ testID, onPress, disabled, children }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, children));
  return {
    ButtonPrimaryApp: Btn,
    ButtonTextApp: Btn,
    TextInputApp: ({ testID, value, onChangeText, error, showError }: any) =>
      R.createElement(View, null, R.createElement(TextInput, { testID, value, onChangeText }), showError ? R.createElement(Text, { testID: `${testID}-error` }, error) : null),
    SwitchApp: ({ testID, value, onValueChange }: any) => R.createElement(Switch, { testID, value, onValueChange }),
  };
});

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { reusableCrudSlice } from '../../../kit8/redux/reusable/reusableCrudSlice';
import { SystemMetaData } from '../../../kit8/redux/SystemMetaData';
import CurrencyEdit from '../../../kit8/catalog/currency/CurrencyEdit';
import { __resetRealtimeEntityUsers } from '../../../kit8/redux/reusable/useRealtimeEntity';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const slice = reusableCrudSlice('currencyReusable');
SystemMetaData.currencyReusable.actions = slice.actions;
let store: any;
let dispatched: any[] = [];
let root: any;
const host = () => document.body;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });
const typeInto = (id: string, text: string) => {
  const el = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, text); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const EUR = { rowGUID: 'eur', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', orderInList: 1, updated_at: 't1',
  rowJSON: { currencyCode: 'EUR', currencyName: 'Euro', currencySymbol: '€', currencyNumericCode: '978', decimalDigits: 2, isActive: true } };

function mount(params: any, rows: any[] = [EUR]) {
  mockParams = params;
  dispatched = [];
  store = configureStore({
    reducer: { currencyReusable: slice.reducer },
    middleware: (g) => g({ serializableCheck: false }).concat(() => (next: any) => (a: any) => (dispatched.push(a), next(a))),
  });
  act(() => { store.dispatch(slice.actions.readDataSuccess({ data: rows })); });
  const el = document.createElement('div');
  host().appendChild(el);
  root = createRoot(el);
  act(() => root.render(<Provider store={store}><CurrencyEdit /></Provider>));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; __resetRealtimeEntityUsers(); jest.clearAllMocks(); });
const remote = (change: any) => act(() => { store.dispatch(slice.actions.applyRealtimeChange(change)); });
const value = (id: string) => (q(id) as HTMLInputElement).value;

it('starts the realtime subscription for the catalog', () => {
  mount({ rowGUID: 'eur' });
  expect(dispatched.some((a) => a.type === 'currencyReusable/startRealtime')).toBe(true);
});

it('new currency: validation, then createOne with the catalog owner', () => {
  mount({});
  typeInto('currency-edit-currencyCode', 'eur');
  typeInto('currency-edit-currencyName', 'Euro again');
  press('currency-edit-save');
  expect(q('currency-edit-currencyCode-error')!.textContent).toMatch(/already in the catalog/);
  typeInto('currency-edit-currencyCode', 'chf');
  press('currency-edit-save');
  const create = dispatched.find((a) => a.type === 'currencyReusable/createOne');
  expect(create.payload).toMatchObject({ rowGUID: 'new-guid-1', rowOwnerGUID: 'currencyCatalog', rowParentGUID: 'empty', rowJSON: { currencyCode: 'CHF', currencyName: 'Euro again', decimalDigits: 2, isActive: true } });
  expect(mockReplace).toHaveBeenCalledWith('/currency/list');
});

it('existing currency: updateOne with rowJSON; delete asks twice', () => {
  mount({ rowGUID: 'eur' });
  expect(value('currency-edit-currencyName')).toBe('Euro');
  typeInto('currency-edit-currencyName', 'Euro (EU)');
  press('currency-edit-save');
  expect(dispatched.find((a) => a.type === 'currencyReusable/updateOne').payload).toMatchObject({ rowGUID: 'eur', rowJSON: { currencyName: 'Euro (EU)' } });
  mount({ rowGUID: 'eur' });
  press('currency-edit-delete');
  expect(dispatched.some((a) => a.type === 'currencyReusable/deleteOne')).toBe(false);
  press('currency-edit-delete');
  expect(dispatched.find((a) => a.type === 'currencyReusable/deleteOne').payload).toMatchObject({ rowGUID: 'eur' });
});

it('changed in another browser: clean form follows; dirty form offers Reload / Keep mine', () => {
  mount({ rowGUID: 'eur' });
  remote({ eventType: 'UPDATE', table: 'currencyTable', new: { ...EUR, updated_at: 't2', rowJSON: { ...EUR.rowJSON, currencyName: 'Euro v2' } }, old: null });
  expect(value('currency-edit-currencyName')).toBe('Euro v2');
  expect(q('currency-edit-remote-changed')).toBeNull();

  typeInto('currency-edit-currencySymbol', 'EUR€');
  remote({ eventType: 'UPDATE', table: 'currencyTable', new: { ...EUR, updated_at: 't3', rowJSON: { ...EUR.rowJSON, currencyName: 'Euro v3' } }, old: null });
  expect(q('currency-edit-remote-changed')).not.toBeNull();
  expect(value('currency-edit-currencySymbol')).toBe('EUR€'); // my edit is kept until I choose
  press('currency-edit-reload');
  expect(value('currency-edit-currencyName')).toBe('Euro v3');
  expect(value('currency-edit-currencySymbol')).toBe('€');
  expect(q('currency-edit-remote-changed')).toBeNull();
});

it('deleted in another browser: notice, no save', () => {
  mount({ rowGUID: 'eur' });
  remote({ eventType: 'DELETE', table: 'currencyTable', new: null, old: { rowGUID: 'eur' } });
  expect(q('currency-edit-gone')!.textContent).toMatch(/deleted in another window/);
  press('currency-edit-save');
  expect(dispatched.some((a) => a.type === 'currencyReusable/updateOne')).toBe(false);
  expect(q('currency-edit-delete')).toBeNull();
});

it('hyperlink "Rates": only for a saved currency, opens its exchange rates', () => {
  mount({});
  expect(q('currency-edit-rates')).toBeNull();
  mount({ rowGUID: 'eur' });
  press('currency-edit-rates');
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/currency/exchange/list', params: { currencyGUID: 'eur' } });
});
