// ReusableTable - export data (pure, unit-tested): what the table shows (titles, numbers) and, when asked,
// the stored GUIDs behind it (catalog GUIDs + rowGUID / rowOwnerGUID / rowParentGUID).
import type { ReusableTableRow, VisualColumn } from './reusableTableTypes';
import { cellValue, displayText } from './tableRows';
import type { CatalogTitleFn } from './tableFilter';

export interface TableExportData {
  title: string;
  headers: string[];
  /** one string per header */
  rows: string[][];
  /** JSON export: { rowNumber, rowGUID, rowOwnerGUID, rowParentGUID, orderInList, visible, rowJSON } */
  records: Record<string, any>[];
}

/** catalog / select columns store a GUID (or code) behind the visible title */
const hasGuid = (col: VisualColumn) => col.type === 'catalog' || col.type === 'select';
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** visible value of a cell (catalog = the title of the selected element) */
export function visibleCell(row: ReusableTableRow, col: VisualColumn, index: number, catalogTitle: CatalogTitleFn): string {
  if (col.type === 'rowNumber') return String(index + 1);
  return displayText(row, col, catalogTitle) || '';
}

/**
 * rows + columns as shown -> a flat table.
 * withGuids: after every catalog column its "<title> GUID" column, and rowGUID / rowOwnerGUID / rowParentGUID at the end.
 */
export function buildTableExport(args: { title: string; rows: ReusableTableRow[]; columns: VisualColumn[]; catalogTitle: CatalogTitleFn; withGuids: boolean }): TableExportData {
  const { title, rows, columns, catalogTitle, withGuids } = args;
  const cols = columns.filter((col) => col.type !== 'custom' || !!col.searchText);
  const headers: string[] = [];
  for (const col of cols) {
    headers.push(col.title);
    if (withGuids && hasGuid(col)) headers.push(`${col.title} GUID`);
  }
  if (withGuids) headers.push('rowGUID', 'rowOwnerGUID', 'rowParentGUID');

  const out: string[][] = [];
  const records: Record<string, any>[] = [];
  rows.forEach((row, index) => {
    const line: string[] = [];
    const visible: Record<string, string | number | null> = {};
    for (const col of cols) {
      const shown = visibleCell(row, col, index, catalogTitle);
      line.push(shown);
      if (withGuids && hasGuid(col)) line.push(text(cellValue(row, col)));
      if (col.type !== 'rowNumber') {
        const raw = cellValue(row, col);
        visible[col.title] = (col.type === 'integer' || col.type === 'number') && typeof raw === 'number' ? raw : shown === '' ? null : shown;
      }
    }
    if (withGuids) line.push(text(row.rowGUID), text(row.rowOwnerGUID), text(row.rowParentGUID));
    out.push(line);
    records.push({
      rowNumber: index + 1,
      rowGUID: row.rowGUID,
      rowOwnerGUID: row.rowOwnerGUID ?? null,
      rowParentGUID: row.rowParentGUID ?? null,
      orderInList: row.orderInList ?? null,
      visible,
      rowJSON: row.rowJSON ?? {},
    });
  });
  return { title, headers, rows: out, records };
}

export function exportToJSON(data: TableExportData, now = new Date()): string {
  return JSON.stringify({ table: data.title, exportedAt: now.toISOString(), rowCount: data.records.length, rows: data.records }, null, 2);
}

const csvCell = (v: string) => (/[",\r\n;]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
/** RFC 4180, with a BOM so Excel opens it as UTF-8 */
export function exportToCSV(data: TableExportData): string {
  return '﻿' + [data.headers, ...data.rows].map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** "Task expenses" + 2026-10-07 14:05 -> task_expenses_2026-10-07_1405.csv */
export function exportFileName(title: string, ext: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const slug = (title || 'table').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'table';
  return `${slug}_${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}.${ext}`;
}
