// useStoredChoice - a per-user convenience remembered in AsyncStorage (the switches of a report, its sort). A failed read or write only means "not remembered": the report works without it.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useStoredChoice<T>(storageKey: string, initial: T, isValid: (v: unknown) => v is T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const touched = useRef(false);
  useEffect(() => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      Promise.resolve(AsyncStorage.getItem(storageKey)).then((raw: string | null) => {
        if (raw == null || touched.current) return;
        try { const v = JSON.parse(raw); if (isValid(v)) setValue(v); } catch { /* a broken value is ignored */ }
      }).catch(() => {});
    } catch { /* no storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const set = useCallback((next: T) => {
    touched.current = true;
    setValue(next);
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      Promise.resolve(AsyncStorage.setItem(storageKey, JSON.stringify(next))).catch(() => {});
    } catch { /* no storage */ }
  }, [storageKey]);
  return [value, set];
}
