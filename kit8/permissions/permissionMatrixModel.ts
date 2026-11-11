// The matrix editor's rows (pure): the delivered CRUD rows + the organization's own rows -> one row per table with the letters of every profile (documentation/PERMISSIONS_WBS.html, 6.1).
import { PROFILE_TITLES } from './permissionModel';

export const MATRIX_PROFILES = Object.keys(PROFILE_TITLES);
export const DELIVERED_OWNER = 'permissionCatalog';
/** the letters a cell may hold */
export const MATRIX_SETS = ['CRUD', 'RUD', 'RU', 'RD', 'RC', 'R', 'C', 'N', 'own'] as const;

export interface CrudRow {
  rowGUID: string;
  rowOwnerGUID: string;
  rowParentGUID: string;
  rowJSON: { permissionTable?: string; permissionSet?: string; [k: string]: any };
}

export interface MatrixCell {
  /** the effective letters (the organization's row, else the delivered one) */
  set: string;
  /** the organization's own row (null = the delivered one is used) */
  overrideGUID: string | null;
  delivered: string | null;
}

export interface MatrixRow {
  table: string;
  cells: Record<string, MatrixCell>;
  overridden: number;
}

export function matrixRowsOf(raw: CrudRow[] | null | undefined, organizationGUID: string): MatrixRow[] {
  const by: Record<string, MatrixRow> = {};
  for (const r of raw || []) {
    const table = r.rowJSON?.permissionTable;
    const set = r.rowJSON?.permissionSet;
    if (!table || !set) continue;
    const row = (by[table] ??= { table, cells: {}, overridden: 0 });
    const cell = (row.cells[r.rowParentGUID] ??= { set: '', overrideGUID: null, delivered: null });
    if (r.rowOwnerGUID === DELIVERED_OWNER) {
      cell.delivered = set;
      if (!cell.overrideGUID) cell.set = set;
    } else if (r.rowOwnerGUID === organizationGUID) {
      cell.overrideGUID = r.rowGUID;
      cell.set = set;
    }
  }
  const rows = Object.values(by);
  for (const r of rows) r.overridden = Object.values(r.cells).filter((c) => c.overrideGUID).length;
  return rows.sort((a, b) => a.table.localeCompare(b.table));
}

/** the writes a user's edit of the table needs: a changed cell becomes (or updates) the organization's row; a cell set back to the delivered letters removes it */
export type MatrixWrite =
  | { kind: 'insert'; table: string; profile: string; set: string }
  | { kind: 'update'; guid: string; set: string }
  | { kind: 'delete'; guid: string };

export function matrixWrites(before: MatrixRow[], after: Record<string, Record<string, string>>): MatrixWrite[] {
  const out: MatrixWrite[] = [];
  for (const row of before) {
    for (const profile of MATRIX_PROFILES) {
      const next = after[row.table]?.[profile];
      const cell = row.cells[profile];
      if (next === undefined || !cell || next === cell.set) continue;
      if (next === cell.delivered) { if (cell.overrideGUID) out.push({ kind: 'delete', guid: cell.overrideGUID }); continue; }
      out.push(cell.overrideGUID ? { kind: 'update', guid: cell.overrideGUID, set: next } : { kind: 'insert', table: row.table, profile, set: next });
    }
  }
  return out;
}
