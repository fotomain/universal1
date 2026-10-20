/** @jest-environment jsdom */
// The Item number / Search name cells of a Material line: typing finds the product (findProductByField) and the line gets it; nothing / several = a red border + tip, no change.
import React, { act } from 'react';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/pm/inner/buttons', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { PMTipIcon: ({ testID, tip }: any) => R.createElement(Text, { testID }, tip) };
});

import ProductFieldInputCell from '../../../../../kit8/pm/view/task/finances/ProductFieldInputCell';
import { findProductByField } from '../../../../../kit8/catalog/product/productFieldsModel';

const prod = (guid: string, j: Record<string, any>) => ({ rowGUID: guid, rowOwnerGUID: 'type', rowParentGUID: 'empty', orderInList: 0, rowJSON: j } as any);
const PRODUCTS = [
  prod('p1', { title: 'Bolt', itemNumber: '100-0245', searchName: 'screw' }),
  prod('p2', { title: 'Nut', itemNumber: '100-0300', searchName: 'screw nut' }),
  prod('p3', { title: 'Star X', itemNumber: 'SX-1' }),
];

describe('findProductByField', () => {
  it('whole text first, then starts with, then contains; exactly one product decides', () => {
    expect((findProductByField(PRODUCTS, 'itemNumber', '100-0245') as any).product.rowGUID).toBe('p1');
    expect((findProductByField(PRODUCTS, 'itemNumber', ' sx-1 ') as any).product.rowGUID).toBe('p3');
    expect((findProductByField(PRODUCTS, 'itemNumber', '0300') as any).product.rowGUID).toBe('p2');
    // "screw" is a whole name of p1 and only the start of p2: the whole text wins
    expect((findProductByField(PRODUCTS, 'searchName', 'screw') as any).product.rowGUID).toBe('p1');
  });
  it('none / several / empty', () => {
    expect(findProductByField(PRODUCTS, 'itemNumber', 'zzz')).toEqual({ error: 'none', count: 0 });
    expect(findProductByField(PRODUCTS, 'itemNumber', '100-')).toEqual({ error: 'many', count: 2 });
    expect(findProductByField(PRODUCTS, 'searchName', '')).toEqual({ error: 'none', count: 0 });
    // a product without the field is never found by it
    expect(findProductByField(PRODUCTS, 'searchName', 'star')).toEqual({ error: 'none', count: 0 });
  });
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement | null;
const type = async (id: string, text: string) => act(async () => {
  const input = q(id)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async (id: string) => act(async () => { q(id)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
const mount = async (shown: string, onPick: (g: string) => void, field: 'itemNumber' | 'searchName' = 'itemNumber') => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(<ProductFieldInputCell testID="cell" field={field} shown={shown} products={PRODUCTS} onPick={onPick} />); });
};
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; });

describe('ProductFieldInputCell', () => {
  it('shows the field of the product on the line', async () => {
    await mount('100-0245', jest.fn());
    expect(q('cell')!.value).toBe('100-0245');
  });
  it('Enter on a text that finds one product picks it', async () => {
    const onPick = jest.fn();
    await mount('', onPick);
    await type('cell', 'sx-1');
    await submit('cell');
    expect(onPick).toHaveBeenCalledWith('p3');
    expect(q('cell-problem')).toBeNull();
  });
  it('no product / several products: no pick, the reason is a tip', async () => {
    const onPick = jest.fn();
    await mount('', onPick);
    await type('cell', 'nothing');
    await submit('cell');
    expect(onPick).not.toHaveBeenCalled();
    expect(q('cell-problem')!.textContent).toBe('No product with this text');
    await type('cell', '100-');
    expect(q('cell-problem')).toBeNull();
    await submit('cell');
    expect(q('cell-problem')!.textContent).toBe('2 products match - type more');
  });
  it('the unchanged text picks nothing', async () => {
    const onPick = jest.fn();
    await mount('SX-1', onPick);
    await submit('cell');
    expect(onPick).not.toHaveBeenCalled();
  });
});
