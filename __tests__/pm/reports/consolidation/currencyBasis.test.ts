/** @jest-environment jsdom */
// useCurrencyBasis: the one choice of the currency of a report that adds projects (default consolidation)
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { CURRENCY_BASIS_DEFAULT, getCurrencyBasis, isCurrencyBasis, resetCurrencyBasisForTest, setCurrencyBasis, useCurrencyBasis } from '../../../../kit8/pm/reports/common/useCurrencyBasis';

jest.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }), { virtual: true });

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
function renderHook<T>(fn: () => T): { result: { current: T }; unmount: () => void } {
  const result = { current: undefined as unknown as T };
  const Probe = () => { result.current = fn(); return null; };
  const el = document.createElement('div');
  const root = createRoot(el);
  act(() => root.render(React.createElement(Probe)));
  return { result, unmount: () => act(() => root.unmount()) };
}

describe('useCurrencyBasis', () => {
  beforeEach(() => resetCurrencyBasisForTest());
  it('the default is the consolidation currency', () => {
    expect(CURRENCY_BASIS_DEFAULT).toBe('consolidation');
    expect(getCurrencyBasis()).toBe('consolidation');
    expect(isCurrencyBasis('project')).toBe(true);
    expect(isCurrencyBasis('x')).toBe(false);
  });
  it('every component that uses it follows one change', () => {
    const a = renderHook(() => useCurrencyBasis());
    const b = renderHook(() => useCurrencyBasis());
    act(() => a.result.current[1]('project'));
    expect(a.result.current[0]).toBe('project');
    expect(b.result.current[0]).toBe('project');
    act(() => setCurrencyBasis('consolidation'));
    expect(b.result.current[0]).toBe('consolidation');
    a.unmount();
    b.unmount();
  });
});
