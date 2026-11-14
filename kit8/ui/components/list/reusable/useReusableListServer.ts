// ReusableList, serverDataMode - only the loaded pages are in memory. The DATABASE does search / filter / sort / count (serverQuery.ts: PostgREST range + count);
// the next page is read when the list reaches its end. Writes go through the same redux sagas as the table (optimistic, snackbar, Undo), the loaded rows are patched by hand.
// Not in this mode (documented in the README): Realtime (press refresh), "select all" of the whole result (only the loaded rows), Archive, Undo of a delete (refresh).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { useSupabase } from '../../../../providers/WithSupabase';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import type { ReusableTableRow } from '../../table/reusable/reusableTableTypes';
import { builtInCellError, cellPatch, emptyRowJSON, insertRow, newRowColumns, tableScope } from '../../table/reusable/tableRows';
import { queryKey } from './listEngine';
import { applyServerQuery, defaultSearchFields, hasMorePages, rowsOf } from './serverQuery';
import type { ReusableListProps, ReusableListQuery, ReusableListSource } from './reusableListTypes';

/** rows ordered by orderInList in the given direction (stable) */
const byOrder = (rows: ReusableTableRow[], direction: 'asc' | 'desc') =>
  rows.map((r, i) => ({ r, i })).sort((a, b) => ((Number(a.r.orderInList) || 0) - (Number(b.r.orderInList) || 0)) * (direction === 'desc' ? -1 : 1) || a.i - b.i).map((x) => x.r);

export function useReusableListServer(props: ReusableListProps, query: ReusableListQuery, direction: 'asc' | 'desc', enabled: boolean): ReusableListSource {
  const { entityName, listOwnerGUID, listParentGUID = 'empty', readParams, visualColumns, reorderEnabled = true, serverPageSize = 100, serverCount = 'exact', serverSearchFields,
    serverTableName, onRowsChange, onRowEdit, newRowDefaults, defaultRowJSON, computeRowJSON, duplicateOverrides } = props;
  const { supabase } = useSupabase();
  const dispatch = useDispatch();
  const meta: any = (SystemMetaData as any)[entityName];
  const actions = meta?.actions;
  const table: string | undefined = serverTableName ?? meta?.tableName;
  const scope = useMemo(() => tableScope(listOwnerGUID, listParentGUID, readParams?.match), [listOwnerGUID, listParentGUID, readParams]);
  const scopedOwner: string | undefined = scope.rowOwnerGUID;
  const searchFields = useMemo(() => serverSearchFields ?? defaultSearchFields(visualColumns), [serverSearchFields, visualColumns]);
  const ready = enabled && !!table && !!listOwnerGUID;

  const [rows, setRowsState] = useState<ReusableTableRow[]>([]);
  const rowsRef = useRef<ReusableTableRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const totalRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const token = useRef(0);

  const setRows = useCallback((next: ReusableTableRow[], byUser = false) => {
    rowsRef.current = next;
    setRowsState(next);
    if (byUser) onRowsChange?.(next);
  }, [onRowsChange]);
  const setTotalBoth = (n: number | null) => { totalRef.current = n; setTotal(n); };

  /** reset = the first page of a (new) query; else the next page */
  const run = useCallback(async (reset: boolean) => {
    if (!ready) return;
    const mine = reset ? ++token.current : token.current;
    const offset = reset ? 0 : rowsRef.current.length;
    if (reset) setLoading(true); else setLoadingMore(true);
    setError(null);
    try {
      const req = { scope, columns: visualColumns, search: query.search, searchFields, filters: query.filters, sort: query.sort, direction, from: offset, to: offset + serverPageSize - 1, count: reset ? serverCount : null };
      const { data, error: err, count } = await applyServerQuery(supabase.from(table!), req);
      if (mine !== token.current) return; // a newer query started: this answer is old
      if (err) throw err;
      const page = rowsOf(data);
      let next: ReusableTableRow[];
      if (reset) next = page;
      else { const seen = new Set(rowsRef.current.map((r) => r.rowGUID)); next = [...rowsRef.current, ...page.filter((r) => !seen.has(r.rowGUID))]; }
      const counted = reset ? (typeof count === 'number' ? count : null) : totalRef.current;
      setTotalBoth(counted);
      setHasMore(hasMorePages(next.length, page.length, serverPageSize, counted));
      setRows(next);
    } catch (e: any) {
      if (mine === token.current) { setError(e); if (reset) { setRows([]); setHasMore(false); } }
    } finally {
      if (mine === token.current) { setLoading(false); setLoadingMore(false); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, supabase, table, scope, visualColumns, searchFields, query, direction, serverPageSize, serverCount, setRows]);

  const qk = queryKey(query);
  const scopeKey = JSON.stringify(scope);
  useEffect(() => { if (ready) run(true); else { token.current++; setRows([]); setHasMore(false); setTotalBoth(null); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, qk, scopeKey, table, direction, serverPageSize]);

  const loadMore = useCallback(() => { if (hasMore && !loading && !loadingMore) run(false); }, [hasMore, loading, loadingMore, run]);
  const refresh = useCallback(() => { run(true); }, [run]);

  // ---- writes: the redux sagas save (optimistic + snackbar), the loaded rows are patched here ----
  const newRow = useCallback((rowJSON?: Record<string, any>): ReusableTableRow => {
    const defaults = typeof newRowDefaults === 'function' ? newRowDefaults() : newRowDefaults;
    const base = (typeof defaultRowJSON === 'function' ? defaultRowJSON() : defaultRowJSON) ?? emptyRowJSON(visualColumns);
    return { rowGUID: Crypto.randomUUID(), ...newRowColumns(listOwnerGUID, listParentGUID, defaults), orderInList: Date.now(), rowJSON: rowJSON ?? { ...base, ...(defaults?.rowJSON || {}) } };
  }, [newRowDefaults, defaultRowJSON, visualColumns, listOwnerGUID, listParentGUID]);

  const createAt = useCallback((viewIndex: number, rowJSON?: Record<string, any>): string | null => {
    if (!listOwnerGUID) return null;
    const { rows: next, inserted } = insertRow(rowsRef.current, newRow(rowJSON), viewIndex);
    setRows(next, true);
    setTotalBoth(totalRef.current === null ? null : totalRef.current + 1);
    if (actions?.createOne) { const { rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON: json } = inserted; dispatch(actions.createOne({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON: json })); }
    onRowEdit?.(inserted.rowGUID, 'create');
    return inserted.rowGUID;
  }, [listOwnerGUID, newRow, actions, dispatch, onRowEdit, setRows]);

  const duplicate = useCallback((guid: string, before = false): string | null => {
    const i = rowsRef.current.findIndex((r) => r.rowGUID === guid);
    if (i < 0) return null;
    return createAt(before ? i : i + 1, { ...(rowsRef.current[i].rowJSON || {}), ...(duplicateOverrides || {}) });
  }, [createAt, duplicateOverrides]);

  const patchRow = useCallback((guid: string, rowJSONPatch: Record<string, any>, columnsPatch?: Record<string, any>) => {
    const hasJSON = !!rowJSONPatch && Object.keys(rowJSONPatch).length > 0;
    const hasColumns = !!columnsPatch && Object.keys(columnsPatch).length > 0;
    if (!hasJSON && !hasColumns) return;
    const current = rowsRef.current.find((r) => r.rowGUID === guid);
    if (!current) return;
    setRows(rowsRef.current.map((r) => (r.rowGUID === guid ? { ...r, ...(hasColumns ? columnsPatch : {}), rowJSON: { ...(r.rowJSON || {}), ...(hasJSON ? rowJSONPatch : {}) } } : r)), true);
    if (actions?.updateOne) dispatch(actions.updateOne({ rowGUID: guid, rowOwnerGUID: scopedOwner ?? current.rowOwnerGUID, ...(hasJSON ? { rowJSON: rowJSONPatch } : {}), ...(hasColumns ? { columns: columnsPatch } : {}) }));
    onRowEdit?.(guid, 'update');
  }, [actions, dispatch, scopedOwner, onRowEdit, setRows]);

  const setCell = useCallback((guid: string, columnKey: string, value: any): boolean => {
    const col = visualColumns.find((c) => c.key === columnKey);
    const row = rowsRef.current.find((r) => r.rowGUID === guid);
    if (!col || !row) return false;
    const error = builtInCellError(col, value) || (col.validate ? col.validate(value, row) : null);
    if (error) { dispatch(showSnackbar({ message: error })); return false; }
    const patch = cellPatch(visualColumns, columnKey, value);
    if (computeRowJSON) {
      const nextJSON = { ...(row.rowJSON || {}), ...patch.rowJSON };
      const extra = computeRowJSON(nextJSON, { ...row, ...patch.columns, rowJSON: nextJSON });
      if (extra && typeof extra === 'object') Object.assign(patch.rowJSON, extra);
    }
    patchRow(guid, patch.rowJSON, patch.columns);
    return true;
  }, [visualColumns, computeRowJSON, dispatch, patchRow]);

  const remove = useCallback((guids: string[]) => {
    if (guids.length === 0) return;
    const gone = new Set(guids);
    setRows(rowsRef.current.filter((r) => !gone.has(r.rowGUID)), true);
    setTotalBoth(totalRef.current === null ? null : Math.max(0, totalRef.current - guids.length));
    if (actions?.deleteOne) guids.forEach((rowGUID) => dispatch(actions.deleteOne({ rowGUID, ...(scopedOwner ? { rowOwnerGUID: scopedOwner } : {}) })));
    guids.forEach((g) => onRowEdit?.(g, 'delete'));
  }, [actions, dispatch, scopedOwner, onRowEdit, setRows]);

  const setOrder = useCallback((guid: string, orderInList: number) => {
    if (!reorderEnabled) return;
    const current = rowsRef.current.find((r) => r.rowGUID === guid);
    if (!current) return;
    setRows(byOrder(rowsRef.current.map((r) => (r.rowGUID === guid ? { ...r, orderInList } : r)), direction), true);
    if (actions?.updateOne) dispatch(actions.updateOne({ rowGUID: guid, rowOwnerGUID: scopedOwner ?? current.rowOwnerGUID, field: 'orderInList', value: orderInList }));
    onRowEdit?.(guid, 'move');
  }, [reorderEnabled, direction, actions, dispatch, scopedOwner, onRowEdit, setRows]);

  return useMemo<ReusableListSource>(() => ({
    mode: 'serverDataMode', rows, loading, loadingMore, error, total, hasMore, loadMore, refresh, createAt, duplicate, setCell, patchRow, remove,
    archive: () => {}, canArchive: false, setOrder,
  }), [rows, loading, loadingMore, error, total, hasMore, loadMore, refresh, createAt, duplicate, setCell, patchRow, remove, setOrder]);
}
