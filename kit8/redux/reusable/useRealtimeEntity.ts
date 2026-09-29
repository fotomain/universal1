// Keeps a reusable entity (SystemMetaData key) in sync with Supabase Realtime while at least one
// screen uses it: the first user dispatches startRealtime, the last one stopRealtime (ref-counted, so
// the list and the edit screen can both use it; drawer screens stay mounted).
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SystemMetaData } from '../SystemMetaData';

const users: Record<string, number> = {};

export interface UseRealtimeEntityOptions {
  /** PostgREST filter for the channel, e.g. 'rowOwnerGUID=eq.x' */
  filter?: string;
  /** readData payload for the first read and the catch-up read after every (re)connect */
  readParams?: any;
  enabled?: boolean;
}

export function useRealtimeEntity(entityKey: string, options: UseRealtimeEntityOptions = {}) {
  const dispatch = useDispatch();
  const { filter, readParams, enabled = true } = options;
  const paramsKey = JSON.stringify(readParams ?? null);
  useEffect(() => {
    const actions = SystemMetaData[entityKey]?.actions;
    if (!enabled || !actions?.startRealtime) return;
    users[entityKey] = (users[entityKey] || 0) + 1;
    if (users[entityKey] === 1) dispatch(actions.startRealtime({ filter, readParams }));
    return () => {
      users[entityKey] = Math.max(0, (users[entityKey] || 1) - 1);
      if (users[entityKey] === 0) dispatch(actions.stopRealtime());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, entityKey, filter, paramsKey, enabled]);
  return useSelector((state: any) => state?.[entityKey]?.realtimeStatus ?? 'idle') as 'idle' | 'subscribing' | 'subscribed' | 'error';
}

/** test helper */
export const __resetRealtimeEntityUsers = () => {
  for (const k of Object.keys(users)) delete users[k];
};
