// useCurrencyBasis - the currency the user wants a report that adds projects to show: 'project' (the budget currency of each project) | 'consolidation' (the one currency of the
// organization, sumForConsolidation). ONE choice for every report that offers it (like useVatBasis); remembered in AsyncStorage (a failure only means "the default again").
// Default 'consolidation': the amounts of several projects can only be added in ONE currency.
import { useCallback, useEffect, useState } from 'react';

export type CurrencyBasis = 'project' | 'consolidation';
export const CURRENCY_BASIS_DEFAULT: CurrencyBasis = 'consolidation';
export const CURRENCY_BASES: CurrencyBasis[] = ['consolidation', 'project'];
export const isCurrencyBasis = (v: unknown): v is CurrencyBasis => v === 'project' || v === 'consolidation';
/** the words in the UI (pass through pmT) */
export const CURRENCY_BASIS_SHORT: Record<CurrencyBasis, string> = { consolidation: 'Consolidation currency', project: 'Project currency' };

const STORAGE_KEY = 'pm.currencyBasis';
let current: CurrencyBasis = CURRENCY_BASIS_DEFAULT;
let loaded = false;
const listeners = new Set<(b: CurrencyBasis) => void>();

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    Promise.resolve(AsyncStorage.getItem(STORAGE_KEY)).then((v: unknown) => { if (isCurrencyBasis(v) && v !== current) setCurrencyBasis(v, false); }).catch(() => {});
  } catch { /* no storage (a test, a private window): the default stays */ }
}

export function setCurrencyBasis(next: CurrencyBasis, save = true) {
  current = next;
  listeners.forEach((l) => l(next));
  if (!save) return;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    Promise.resolve(AsyncStorage.setItem(STORAGE_KEY, next)).catch(() => {});
  } catch { /* not remembered */ }
}

export const getCurrencyBasis = (): CurrencyBasis => current;
/** for the tests */
export function resetCurrencyBasisForTest() { current = CURRENCY_BASIS_DEFAULT; loaded = true; listeners.clear(); }

export function useCurrencyBasis(): [CurrencyBasis, (b: CurrencyBasis) => void] {
  const [basis, setBasis] = useState<CurrencyBasis>(current);
  useEffect(() => {
    loadOnce();
    listeners.add(setBasis);
    setBasis(current);
    return () => { listeners.delete(setBasis); };
  }, []);
  const change = useCallback((b: CurrencyBasis) => setCurrencyBasis(b), []);
  return [basis, change];
}
