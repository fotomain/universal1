// useVatBasis - the VAT basis the user picked (Cost | Net | With VAT), ONE choice for every report that shows money; remembered in AsyncStorage (a failure of the storage only means
// "the default again": the screen never depends on it). Every component that calls the hook follows the same choice at once.
import { useCallback, useEffect, useState } from 'react';
import { VAT_BASIS_DEFAULT, VatBasis, isVatBasis } from './vatBasis';

const STORAGE_KEY = 'pm.vatBasis';
let current: VatBasis = VAT_BASIS_DEFAULT;
let loaded = false;
const listeners = new Set<(b: VatBasis) => void>();

function loadOnce() {
  if (loaded) return;
  loaded = true;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    Promise.resolve(AsyncStorage.getItem(STORAGE_KEY)).then((v: unknown) => { if (isVatBasis(v) && v !== current) setVatBasis(v, false); }).catch(() => {});
  } catch { /* no storage (a test, a private window): the default stays */ }
}

export function setVatBasis(next: VatBasis, save = true) {
  current = next;
  listeners.forEach((l) => l(next));
  if (!save) return;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    Promise.resolve(AsyncStorage.setItem(STORAGE_KEY, next)).catch(() => {});
  } catch { /* not remembered */ }
}

export const getVatBasis = (): VatBasis => current;
/** for the tests */
export function resetVatBasisForTest() { current = VAT_BASIS_DEFAULT; loaded = true; listeners.clear(); }

export function useVatBasis(): [VatBasis, (b: VatBasis) => void] {
  const [basis, setBasis] = useState<VatBasis>(current);
  useEffect(() => {
    loadOnce();
    listeners.add(setBasis);
    setBasis(current);
    return () => { listeners.delete(setBasis); };
  }, []);
  const change = useCallback((b: VatBasis) => setVatBasis(b), []);
  return [basis, change];
}
