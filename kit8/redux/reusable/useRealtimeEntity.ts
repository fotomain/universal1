// Keeps a reusable entity (SystemMetaData key) in sync with Supabase Realtime while at least one
// screen uses it. Every mounted user registers { filter, readParams }; the most recently mounted one
// decides the channel + catch-up read (readParams.match scopes the list, e.g. the rates of ONE currency).
// startRealtime is dispatched only when that effective subscription changes, stopRealtime when the last
// user unmounts - so the list and the edit screen of the same scope share one channel (drawer screens stay
// mounted), and opening another scope (another currency) re-subscribes with its own read.
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../SystemMetaData';

export interface UseRealtimeEntityOptions {
  /** PostgREST filter for the channel, e.g. 'rowOwnerGUID=eq.x' */
  filter?: string;
  /** readData payload for the first read and the catch-up read after every (re)connect; `match` scopes the list */
  readParams?: any;
  enabled?: boolean;
}

type Sub = { id: number; filter?: string; readParams?: any };
const subs: Record<string, Sub[]> = {};
const running: Record<string, string | null> = {};
let nextSubId = 1;
const subKey = (s: Sub) => JSON.stringify([s.filter ?? null, s.readParams ?? null]);

function sync(entityKey: string, dispatch: (a: any) => any) {
  const actions = SystemMetaData[entityKey]?.actions;
  if (!actions?.startRealtime) return;
  const list = subs[entityKey] || [];
  if (list.length === 0) {
    if (running[entityKey]) {
      running[entityKey] = null;
      dispatch(actions.stopRealtime());
    }
    return;
  }
  const top = list[list.length - 1];
  const k = subKey(top);
  if (running[entityKey] !== k) {
    running[entityKey] = k;
    dispatch(actions.startRealtime({ filter: top.filter, readParams: top.readParams }));
  }
}

export function useRealtimeEntity(entityKey: string, options: UseRealtimeEntityOptions = {}) {
  const dispatch = useDispatch();
  const { filter, readParams, enabled = true } = options;
  const paramsKey = JSON.stringify(readParams ?? null);
  useEffect(() => {
    if (!enabled || !SystemMetaData[entityKey]?.actions?.startRealtime) return;
    const sub: Sub = { id: nextSubId++, filter, readParams };
    (subs[entityKey] = subs[entityKey] || []).push(sub);
    sync(entityKey, dispatch);
    return () => {
      subs[entityKey] = (subs[entityKey] || []).filter((s) => s.id !== sub.id);
      sync(entityKey, dispatch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, entityKey, filter, paramsKey, enabled]);
  return useSelector((state: any) => state?.[entityKey]?.realtimeStatus ?? 'idle') as 'idle' | 'subscribing' | 'subscribed' | 'error';
}

/** test helper */
export const __resetRealtimeEntityUsers = () => {
  for (const k of Object.keys(subs)) delete subs[k];
  for (const k of Object.keys(running)) delete running[k];
};
