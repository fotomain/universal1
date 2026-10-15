// SumExplorerListReusable - export of the lists of the window (pure, unit-tested): ONE flat table, a column "List" first (the title of the source, "− " before a negative one).
import type { TableExportData } from '../table/reusable/tableExport';
import type { SumExplorerSource } from './SumExplorerListReusable';

export const SUM_EXPLORER_LIST_HEADER = 'List';

/** every source with ALL its rows (the pages that are not read yet are read by the caller: `rows`) */
export function buildSumExplorerExportData(title: string, sources: SumExplorerSource[], rows: Record<string, any[]>): TableExportData {
  const columns = (s: SumExplorerSource) => s.columns;
  const headers = [SUM_EXPLORER_LIST_HEADER, ...Array.from(new Set(sources.flatMap((s) => columns(s).map((c) => c.title))))];
  const outRows: string[][] = [];
  const records: Record<string, any>[] = [];
  for (const s of sources) {
    const list = `${(s.sign ?? 1) < 0 ? '− ' : ''}${s.title}`;
    for (const row of rows[s.key] ?? []) {
      const byTitle: Record<string, string> = {};
      for (const c of columns(s)) byTitle[c.title] = c.render(row);
      outRows.push([list, ...headers.slice(1).map((h) => byTitle[h] ?? '')]);
      records.push({ [SUM_EXPLORER_LIST_HEADER]: list, ...byTitle });
    }
  }
  return { title, headers, rows: outRows, records };
}

/** reads the pages that are missing: the window may have shown only the first ones (`lastPage` = the last page it read, -1 = none) */
export async function readAllRows(source: SumExplorerSource, loaded: any[], totalCount: number, lastPage: number): Promise<any[]> {
  const all = [...loaded];
  let page = lastPage + 1;
  while (all.length < totalCount) {
    const result = await source.fetchPage(page);
    if (result.rows.length === 0) break;
    all.push(...result.rows);
    page += 1;
  }
  return all;
}
