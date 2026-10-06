// undoGanttAction: one record = one undoable Gantt action.
//
// Storage table (expo-sqlite, auto-created - see undoGanttSQLite.ts):
//   undoGanttActionTable
//     rowGUID        TEXT PRIMARY KEY      one undo action
//     undoKey        TEXT                  "undoGanttAction-<userGUID>-<projectGUID>" (indexed)
//     rowOwnerGUID   TEXT                  = currentProjectGUID
//     rowParentGUID  TEXT                  = userGUID
//     orderInList    REAL                  = timestamp (ms) -> chronological order of undo
//     rowJSON        TEXT (JSON)           UndoGanttActionJSON below
//
// The undo key improves on "undoGanttAction-" + currentProjectGUID by also carrying the
// user, so two accounts on one device never undo each other's actions.

import { PMProjectData } from '../../model/types';

export type UndoGanttActionType =
  | 'task-create'
  | 'task-update'
  | 'task-move'
  | 'task-resize'
  | 'task-progress'
  | 'task-delete'
  | 'task-reorder'
  | 'dependency-create'
  | 'dependency-update'
  | 'dependency-delete'
  | 'other';

export interface UndoGanttActionJSON {
  undoKey: string;
  actionType: UndoGanttActionType;
  /** Human readable, shown in the Undo button tip ("Undo: Delete dependency"). */
  label: string;
  createdAt: string;
  projectGUID: string;
  userGUID: string;
  /** The whole project (tasks + dependencies) as it was BEFORE the action. */
  before: PMProjectData;
}

export interface UndoGanttEntry {
  rowGUID: string;
  undoKey: string;
  rowOwnerGUID: string; // currentProjectGUID
  rowParentGUID: string; // userGUID
  orderInList: number; // timestamp
  rowJSON: UndoGanttActionJSON;
}

export interface UndoGanttStorage {
  push(entry: UndoGanttEntry, keepLast: number): Promise<void>;
  /** Latest entry of the key (does not remove it). */
  peek(undoKey: string): Promise<UndoGanttEntry | null>;
  remove(rowGUID: string): Promise<void>;
  count(undoKey: string): Promise<number>;
  clear(undoKey: string): Promise<void>;
}

export const UNDO_GANTT_KEEP_LAST = 100;

export function undoGanttKey(userGUID: string, projectGUID: string): string {
  return `undoGanttAction-${userGUID}-${projectGUID}`;
}

/**
 * Redo: the same table, a second stack per user + project. One record = one UNDONE action; its `before` is the
 * project as it was right before the undo (= with the action applied), so Redo restores that state.
 * A new action clears the stack - what was undone can no longer be redone.
 */
export function redoGanttKey(userGUID: string, projectGUID: string): string {
  return `redoGanttAction-${userGUID}-${projectGUID}`;
}
