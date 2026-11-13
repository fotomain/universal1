// useStoredValue - a per-user convenience remembered on the device in AsyncStorage (the last parameters of the cost calculator). Same idea as kit8/pm/reports/common/useStoredChoice:
// a failed read or write only means "not remembered". A stored value that does not pass isValid is ignored. What the user typed before the stored value came back wins.
import { useCallback, useEffect, useRef, useState } from 'react';

function storage(): any {
  const mod = require('@react-native-async-storage/async-storage');
  return mod?.default ?? mod;
}

export function useStoredValue<T>(storageKey: string, initial: T, isValid: (v: unknown) => v is T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const touched = useRef(false);
  useEffect(() => {
    try {
      Promise.resolve(storage().getItem(storageKey)).then((raw: string | null) => {
        if (raw == null || touched.current) return;
        try { const v = JSON.parse(raw); if (isValid(v)) setValue(v); } catch { /* a broken value is ignored */ }
      }).catch(() => {});
    } catch { /* no storage */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const set = useCallback((next: T) => {
    touched.current = true;
    setValue(next);
    try { Promise.resolve(storage().setItem(storageKey, JSON.stringify(next))).catch(() => {}); } catch { /* no storage */ }
  }, [storageKey]);
  return [value, set];
}
