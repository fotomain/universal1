// Native (iOS / Android): the undo stack lives in expo-sqlite. SQLiteProvider opens a
// dedicated database and auto-creates undoGanttActionTable in onInit.

import React, { useMemo } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { UndoGanttStorageContext } from './undoGanttContext';
import { createSQLiteUndoStorage, migrateUndoGanttDb, UNDO_GANTT_DB_NAME } from './undoGanttSQLite';

function SQLiteUndoBridge({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const storage = useMemo(() => createSQLiteUndoStorage(db), [db]);
  return <UndoGanttStorageContext.Provider value={storage}>{children}</UndoGanttStorageContext.Provider>;
}

export default function PMUndoProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider databaseName={UNDO_GANTT_DB_NAME} onInit={migrateUndoGanttDb}>
      <SQLiteUndoBridge>{children}</SQLiteUndoBridge>
    </SQLiteProvider>
  );
}
