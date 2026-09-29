// expo-sqlite implementation of the undo stack (iOS / Android).
// The table is created automatically by migrateUndoGanttDb (SQLiteProvider onInit).

import type { SQLiteDatabase } from 'expo-sqlite';
import { UndoGanttEntry, UndoGanttStorage } from './undoGanttTypes';

export const UNDO_GANTT_DB_NAME = 'pm_gantt_undo.db';
export const UNDO_GANTT_TABLE = 'undoGanttActionTable';

/** Auto-create (idempotent). Passed to <SQLiteProvider onInit>. */
export async function migrateUndoGanttDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS ${UNDO_GANTT_TABLE} (
      rowGUID       TEXT PRIMARY KEY NOT NULL,
      undoKey       TEXT NOT NULL,
      rowOwnerGUID  TEXT NOT NULL,
      rowParentGUID TEXT NOT NULL,
      orderInList   REAL NOT NULL,
      rowJSON       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${UNDO_GANTT_TABLE}_key_order ON ${UNDO_GANTT_TABLE} (undoKey, orderInList);
  `);
}

interface Row {
  rowGUID: string;
  undoKey: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  orderInList: number;
  rowJSON: string;
}

function fromRow(r: Row | null): UndoGanttEntry | null {
  if (!r) return null;
  try {
    return { ...r, orderInList: Number(r.orderInList), rowJSON: JSON.parse(r.rowJSON) };
  } catch {
    return null;
  }
}

export function createSQLiteUndoStorage(db: SQLiteDatabase): UndoGanttStorage {
  return {
    async push(e, keepLast) {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${UNDO_GANTT_TABLE} (rowGUID, undoKey, rowOwnerGUID, rowParentGUID, orderInList, rowJSON) VALUES (?, ?, ?, ?, ?, ?)`,
        [e.rowGUID, e.undoKey, e.rowOwnerGUID, e.rowParentGUID, e.orderInList, JSON.stringify(e.rowJSON)]
      );
      // keep only the newest `keepLast` actions of this key
      await db.runAsync(
        `DELETE FROM ${UNDO_GANTT_TABLE} WHERE undoKey = ? AND rowGUID NOT IN (
           SELECT rowGUID FROM ${UNDO_GANTT_TABLE} WHERE undoKey = ? ORDER BY orderInList DESC LIMIT ?)`,
        [e.undoKey, e.undoKey, keepLast]
      );
    },
    async peek(undoKey) {
      const r = await db.getFirstAsync<Row>(
        `SELECT * FROM ${UNDO_GANTT_TABLE} WHERE undoKey = ? ORDER BY orderInList DESC LIMIT 1`,
        [undoKey]
      );
      return fromRow(r);
    },
    async remove(rowGUID) {
      await db.runAsync(`DELETE FROM ${UNDO_GANTT_TABLE} WHERE rowGUID = ?`, [rowGUID]);
    },
    async count(undoKey) {
      const r = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${UNDO_GANTT_TABLE} WHERE undoKey = ?`, [undoKey]);
      return Number(r?.n) || 0;
    },
    async clear(undoKey) {
      await db.runAsync(`DELETE FROM ${UNDO_GANTT_TABLE} WHERE undoKey = ?`, [undoKey]);
    },
  };
}
