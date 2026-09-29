import { createContext, useContext } from 'react';
import { UndoGanttStorage } from './undoGanttTypes';
import { createWebUndoStorage } from './undoGanttWebStorage';

export const UndoGanttStorageContext = createContext<UndoGanttStorage | null>(null);

let fallback: UndoGanttStorage | null = null;

/** Storage from the nearest PMUndoProvider (expo-sqlite on native, localStorage on web). */
export function useUndoGanttStorage(): UndoGanttStorage {
  const s = useContext(UndoGanttStorageContext);
  if (s) return s;
  // outside a provider (should not happen): keep working in memory/localStorage
  if (!fallback) fallback = createWebUndoStorage();
  return fallback;
}
