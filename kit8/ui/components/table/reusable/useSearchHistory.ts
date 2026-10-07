// ReusableTable - the last search substrings of a table (newest first), kept on the device (AsyncStorage).
import { useCallback, useEffect, useState } from 'react';

export const SEARCH_HISTORY_MAX = 10;

/** newest first, no duplicates (case-insensitive), at most SEARCH_HISTORY_MAX */
export function addToSearchHistory(history: string[], text: string, max = SEARCH_HISTORY_MAX): string[] {
  const t = (text || '').trim();
  if (!t) return history;
  if (history[0] === t) return history;
  return [t, ...history.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(0, max);
}

const storage = (): any => {
  try { return require('@react-native-async-storage/async-storage').default; } catch { return null; }
};

export function useSearchHistory(storageKey: string) {
  const key = `reusableTable.searchHistory.${storageKey}`;
  const [history, setHistory] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    Promise.resolve(storage()?.getItem?.(key)).then((raw: any) => {
      if (!alive || !raw) return;
      try { const list = JSON.parse(raw); if (Array.isArray(list)) setHistory(list.filter((x) => typeof x === 'string').slice(0, SEARCH_HISTORY_MAX)); } catch { /* broken value: start empty */ }
    }).catch(() => {});
    return () => { alive = false; };
  }, [key]);
  const save = (list: string[]) => { try { Promise.resolve(storage()?.setItem?.(key, JSON.stringify(list))).catch(() => {}); } catch { /* history is only a convenience */ } };
  const remember = useCallback((text: string) => setHistory((h) => { const next = addToSearchHistory(h, text); if (next !== h) save(next); return next; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  const clear = useCallback(() => { setHistory([]); save([]); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]);
  return { history, remember, clear };
}
