// Web: expo-sqlite needs cross-origin isolation (COOP/COEP headers) which the web build
// does not serve, so the same undoGanttActionTable layout is kept in localStorage.

import React, { useMemo } from 'react';
import { UndoGanttStorageContext } from './undoGanttContext';
import { createWebUndoStorage } from './undoGanttWebStorage';

export default function PMUndoProvider({ children }: { children: React.ReactNode }) {
  const storage = useMemo(() => createWebUndoStorage(), []);
  return <UndoGanttStorageContext.Provider value={storage}>{children}</UndoGanttStorageContext.Provider>;
}
