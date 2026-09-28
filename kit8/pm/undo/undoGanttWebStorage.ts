// Web implementation of the undo stack. expo-sqlite on web needs cross-origin isolation
// headers (SharedArrayBuffer) which this app does not serve, so the SAME table layout
// (one record = one undo action) is kept in localStorage instead:
//   localStorage["undoGanttActionTable:<undoKey>"] = UndoGanttEntry[] (oldest first).
// Every access is wrapped: private windows / blocked storage fall back to memory.

import { UndoGanttEntry, UndoGanttStorage } from './undoGanttTypes';

const PREFIX = 'undoGanttActionTable:';
const memory = new Map<string, UndoGanttEntry[]>();

function read(undoKey: string): UndoGanttEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + undoKey);
    if (raw) return JSON.parse(raw) as UndoGanttEntry[];
  } catch {
    // fall through to memory
  }
  return memory.get(undoKey) || [];
}

function write(undoKey: string, rows: UndoGanttEntry[]) {
  memory.set(undoKey, rows);
  try {
    globalThis.localStorage?.setItem(PREFIX + undoKey, JSON.stringify(rows));
  } catch {
    // quota / blocked: drop the oldest half and retry once, else memory only
    try {
      const half = rows.slice(Math.floor(rows.length / 2));
      memory.set(undoKey, half);
      globalThis.localStorage?.setItem(PREFIX + undoKey, JSON.stringify(half));
    } catch {
      // memory only
    }
  }
}

export function createWebUndoStorage(): UndoGanttStorage {
  return {
    async push(e, keepLast) {
      const rows = read(e.undoKey).filter((r) => r.rowGUID !== e.rowGUID);
      rows.push(e);
      rows.sort((a, b) => a.orderInList - b.orderInList);
      write(e.undoKey, rows.slice(-keepLast));
    },
    async peek(undoKey) {
      const rows = read(undoKey);
      return rows.length ? rows[rows.length - 1] : null;
    },
    async remove(rowGUID) {
      // the key is not known here: scan the (few) undo keys
      const keys = new Set<string>(memory.keys());
      try {
        const ls = globalThis.localStorage;
        for (let i = 0; ls && i < ls.length; i++) {
          const k = ls.key(i);
          if (k && k.startsWith(PREFIX)) keys.add(k.slice(PREFIX.length));
        }
      } catch {
        // ignore
      }
      for (const k of keys) {
        const rows = read(k);
        if (rows.some((r) => r.rowGUID === rowGUID)) write(k, rows.filter((r) => r.rowGUID !== rowGUID));
      }
    },
    async count(undoKey) {
      return read(undoKey).length;
    },
    async clear(undoKey) {
      write(undoKey, []);
    },
  };
}
