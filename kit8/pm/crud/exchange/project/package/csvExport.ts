// The csv/ folder of the project package: the same data as the JSON / ndjson entries, one CSV file per table, to open in Excel / Sheets (BUILT 2026-11-20).
//
//   csv/project.csv          one row: the project (keys of rowJSON as columns)
//   csv/tasks.csv            one row per stage / task / milestone
//   csv/dependencies.csv     one row per link between two tasks
//   csv/task_lines.csv       one row per Time / Material / Expense / Revenue line (only when the task lines are exported)
//   csv/bim_storeys.csv      the storeys of the BIM model                 (only with the BIM model)
//   csv/bim_elements.csv     one row per element
//   csv/bim_chunks.csv       the geometry files (hash, size, counts)
//   csv/bim_properties.csv   the IFC properties in the LONG form: ifc guid, property path, value (only with the BIM properties)
//
// Rules: UTF-8 with a byte order mark (Excel opens it right), comma separated, CRLF, a value with a comma / quote / line break is quoted, a nested key is a dotted column
// (`budget.currency`), an array is written as JSON text, an empty cell = no value. The CSV is a READ copy for people: the import reads the JSON, never the CSV.
// Pure (no React / Supabase / network): unit-tested in __tests__/pm/crud/exchange/projectPackage.test.ts.
import { strToU8 } from 'fflate';
import type { PMProjectExchangeFile } from '../projectExchangeFormat';
import type { PMBimExportData } from './packageModel';

export const CSV_FOLDER = 'csv';
export const csvEntryName = (name: string): string => `${CSV_FOLDER}/${name}.csv`;

/** one cell: quoted when it holds a comma, a quote or a line break; a formula start (= + - @) is NOT changed: the file is data, the reader of it decides */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const text = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** the file text: header + rows, CRLF, with the byte order mark */
export function csvText(columns: string[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map(csvCell).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

/** { a: { b: 1 }, c: [1] } -> { 'a.b': 1, c: [1] } (arrays stay one cell; empty objects give no column) */
export function flattenJson(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) flattenJson(v, key, out);
    else out[key] = v;
  }
  return out;
}

/** the fixed columns first, then every key the rows have (in the order they first appear) */
function table(fixed: string[], rows: Record<string, unknown>[]): { columns: string[]; rows: Record<string, unknown>[] } {
  const seen = new Set(fixed);
  const columns = [...fixed];
  for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
  return { columns, rows };
}

const entry = (name: string, t: { columns: string[]; rows: Record<string, unknown>[] }): [string, Uint8Array] => [csvEntryName(name), strToU8(csvText(t.columns, t.rows))];

/** the label of a parent in `treePath` (labels are the GUIDs with '-' -> '_'): the parent task = the label before the last one */
const parentGUIDOf = (treePath: string | undefined): string => {
  const labels = (treePath || '').split('.');
  return labels.length >= 3 ? labels[labels.length - 2].replace(/_/g, '-') : '';
};

/** the csv/ entries of a package (name -> bytes) */
export function buildCsvEntries(file: PMProjectExchangeFile, bim: PMBimExportData | null): Record<string, Uint8Array> {
  const entries: [string, Uint8Array][] = [];
  const nameOf = new Map<string, string>(file.tasks.map((t) => [t.rowGUID, String(t.rowJSON?.taskDescription ?? '')]));

  const p = file.project;
  entries.push(entry('project', table(['rowGUID', 'name'], [{ rowGUID: p.rowGUID, name: p.rowJSON?.name ?? '', rowProgress: p.rowProgress, ...flattenJson(p.rowJSON) }])));

  entries.push(
    entry(
      'tasks',
      table(
        ['rowGUID', 'parentGUID', 'name', 'kind', 'orderInList', 'rowProgress', 'rowDuration', 'treePath'],
        file.tasks.map((t) => ({
          rowGUID: t.rowGUID,
          parentGUID: parentGUIDOf(t.treePath),
          name: t.rowJSON?.taskDescription ?? '',
          kind: (t.rowJSON as any)?.rowKind ?? '',
          orderInList: t.orderInList,
          rowProgress: t.rowProgress,
          rowDuration: t.rowDuration,
          treePath: t.treePath,
          ...flattenJson(t.rowJSON),
        }))
      )
    )
  );

  entries.push(
    entry(
      'dependencies',
      table(
        ['blockedTaskGUID', 'blockedTask', 'blockerTaskGUID', 'blockerTask', 'linkType', 'lagDays'],
        file.dependencies.map((d) => ({
          blockedTaskGUID: d.rowGUID,
          blockedTask: nameOf.get(d.rowGUID) ?? '',
          blockerTaskGUID: d.rowDependsOnGUID,
          blockerTask: nameOf.get(d.rowDependsOnGUID) ?? '',
          linkType: d.linkType,
          lagDays: d.lagDays,
          ...flattenJson(d.rowJSON),
        }))
      )
    )
  );

  if (file.taskLines) {
    entries.push(
      entry(
        'task_lines',
        table(
          ['rowGUID', 'taskGUID', 'task', 'genusGUID', 'orderInList'],
          file.taskLines.map((l) => ({ rowGUID: l.rowGUID, taskGUID: l.rowOwnerGUID, task: nameOf.get(l.rowOwnerGUID) ?? '', genusGUID: l.rowParentGUID, orderInList: l.orderInList, ...flattenJson(l.rowJSON) }))
        )
      )
    );
  }

  if (bim) {
    const storeyName = new Map(bim.storeys.map((s) => [s.ifcGuid, s.name]));
    entries.push(entry('bim_storeys', table(['ifcGuid', 'name', 'elevation', 'orderInList', 'stageGUID', 'stage'], bim.storeys.map((s) => ({ ...s, stage: s.stageGUID ? nameOf.get(s.stageGUID) ?? '' : '' })))));
    entries.push(
      entry(
        'bim_elements',
        table(
          ['ifcGuid', 'ifcClass', 'name', 'typeName', 'storeyIfcGuid', 'storey', 'taskGUID', 'task', 'chunkHash', 'elementNumber', 'bbox'],
          bim.elements.map((e) => ({ ...e, storey: e.storeyIfcGuid ? storeyName.get(e.storeyIfcGuid) ?? '' : '', task: e.taskGUID ? nameOf.get(e.taskGUID) ?? '' : '' }))
        )
      )
    );
    entries.push(
      entry('bim_chunks', table(['hash', 'storeyIfcGuid', 'part', 'byteSize', 'formatVersion', 'vertexCount', 'elementCount', 'bboxMin', 'bboxSize'], bim.chunks.map(({ storagePath: _s, ...c }) => ({ ...c }))))
    );
    if (bim.propertiesIncluded) {
      const rows: Record<string, unknown>[] = [];
      for (const pr of bim.properties) for (const [path, value] of Object.entries(flattenJson(pr.rowJSON))) rows.push({ ifcGuid: pr.ifcGuid, property: path, value });
      entries.push(entry('bim_properties', table(['ifcGuid', 'property', 'value'], rows)));
    }
  }
  return Object.fromEntries(entries);
}
