// ReusableTable - data + commands. The same flow as ListWebCardsComponent: read once by owner, optional
// Supabase Realtime, a local optimistic list, every change dispatched to the reusable saga
// (SystemMetaData[entityName].actions: readData / createOne / updateOne / deleteOne).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import * as Crypto from 'expo-crypto';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { useRealtimeEntity } from '../../../../redux/reusable/useRealtimeEntity';
import { matchRow } from '../../../../redux/reusable/realtimeRows';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import type { ReusableTableProps, ReusableTableRow } from './reusableTableTypes';
import { builtInCellError, cellPatch, emptyRowJSON, insertRow, moveRow, moveSelectedRows, newRowColumns, sortRows, tableScope } from './tableRows';

type Args = Pick<ReusableTableProps, 'entityName' | 'entityForArchivationName' | 'listOwnerGUID' | 'listParentGUID' | 'readParams' | 'realtime' | 'visualColumns' | 'defaultRowJSON' | 'reorderEnabled' | 'onRowsChange' | 'onRowEdit' | 'rowFilter' | 'newRowDefaults' | 'computeRowJSON'>;

export function useReusableTableCrud({ entityName, entityForArchivationName, listOwnerGUID, listParentGUID = 'empty', readParams, realtime = true, visualColumns, defaultRowJSON, reorderEnabled = true, onRowsChange, onRowEdit, rowFilter, newRowDefaults, computeRowJSON }: Args) {
  const dispatch = useDispatch();
  const entityState = useSelector((s: any) => s?.[entityName]);
  const actions = SystemMetaData[entityName]?.actions;
  const archiveActions = entityForArchivationName ? SystemMetaData[entityForArchivationName]?.actions : undefined;

  /**
   * scope of this table: the rows of ONE owner + ONE parent (server read, realtime and the shown rows);
   * REUSABLE_TABLE_ALL ('*') leaves that column out (all-rows mode)
   */
  const scope = useMemo(() => tableScope(listOwnerGUID, listParentGUID, readParams?.match), [listOwnerGUID, listParentGUID, readParams]);
  /** the owner every row of this table has (undefined in all-rows mode) */
  const scopedOwner: string | undefined = scope.rowOwnerGUID;
  const fullReadParams = useMemo(() => {
    const p: Record<string, any> = { paginationSize: 1000, originationCurrentPage: 0, ...(readParams || {}) };
    if (Object.keys(scope).length > 0) p.match = scope; else delete p.match;
    return p;
  }, [readParams, scope]);
  const readKey = JSON.stringify(fullReadParams);

  useRealtimeEntity(entityName, { enabled: realtime && !!listOwnerGUID, readParams: fullReadParams });
  useEffect(() => {
    if (actions?.readData && listOwnerGUID) dispatch(actions.readData(fullReadParams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, entityName, listOwnerGUID, readKey, dispatch]);

  /** read the rows of this table from the server again */
  const refresh = useCallback(() => { if (actions?.readData && listOwnerGUID) dispatch(actions.readData(fullReadParams)); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actions, listOwnerGUID, readKey, dispatch]);

  const [rows, setRowsState] = useState<ReusableTableRow[]>([]);
  const rowsRef = useRef<ReusableTableRow[]>([]);
  const setRows = useCallback((next: ReusableTableRow[], byUser = true) => {
    rowsRef.current = next;
    setRowsState(next);
    if (byUser) onRowsChange?.(next);
  }, [onRowsChange]);

  // redux (server read / realtime / *Success) -> the local list
  useEffect(() => {
    const all = entityState?.entityDataFromServer;
    if (!Array.isArray(all)) return;
    const scoped = all.filter((r: any) => matchRow(r, scope) && (!rowFilter || rowFilter(r)));
    // an empty list is real only after a read or a realtime change (not the initial empty state)
    if (scoped.length === 0 && all.length === 0 && !(entityState?.readSuccessful === 1 || entityState?.lastRealtimeEvent)) return;
    setRows(sortRows(scoped), false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityState?.entityDataFromServer, readKey, rowFilter]);

  const loading = !!listOwnerGUID && entityState?.readSuccessful !== 1 && !entityState?.lastRealtimeEvent && rows.length === 0 && !entityState?.readErrorData;

  // ---- create ----
  const newRow = useCallback((rowJSON?: Record<string, any>): ReusableTableRow => {
    const defaults = typeof newRowDefaults === 'function' ? newRowDefaults() : newRowDefaults;
    const base = (typeof defaultRowJSON === 'function' ? defaultRowJSON() : defaultRowJSON) ?? emptyRowJSON(visualColumns);
    return {
      rowGUID: Crypto.randomUUID(),
      ...newRowColumns(listOwnerGUID, listParentGUID, defaults),
      orderInList: Date.now(),
      rowJSON: rowJSON ?? { ...base, ...(defaults?.rowJSON || {}) },
    };
  }, [listOwnerGUID, listParentGUID, defaultRowJSON, visualColumns, newRowDefaults]);

  const createAt = useCallback((index: number, rowJSON?: Record<string, any>): string | null => {
    if (!listOwnerGUID) return null;
    const { rows: next, inserted } = insertRow(rowsRef.current, newRow(rowJSON), index);
    setRows(next);
    if (actions?.createOne) {
      const { rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON: json } = inserted;
      dispatch(actions.createOne({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON: json }));
    }
    onRowEdit?.(inserted.rowGUID, 'create');
    return inserted.rowGUID;
  }, [actions, dispatch, listOwnerGUID, newRow, setRows, onRowEdit]);

  const indexOf = (id: string) => rowsRef.current.findIndex((r) => r.rowGUID === id);
  const createFirst = useCallback(() => createAt(0), [createAt]);
  const createLast = useCallback(() => createAt(rowsRef.current.length), [createAt]);
  const createBefore = useCallback((id: string) => createAt(Math.max(0, indexOf(id))), [createAt]);
  const createAfter = useCallback((id: string) => { const i = indexOf(id); return createAt(i < 0 ? rowsRef.current.length : i + 1); }, [createAt]);
  /** copy / paste: a new row with the same rowJSON right after (or before) the row */
  const duplicate = useCallback((id: string, before = false) => {
    const i = indexOf(id);
    if (i < 0) return null;
    return createAt(before ? i : i + 1, { ...(rowsRef.current[i].rowJSON || {}) });
  }, [createAt]);

  // ---- update ----
  /**
   * merge a rowJSON patch (+ root columns rowOwnerGUID / rowParentGUID) into the row (optimistic) and save it.
   * In a scoped table a row whose owner / parent changed leaves the table (it belongs to another scope now).
   */
  const patchRow = useCallback((id: string, rowJSONPatch: Record<string, any>, columnsPatch?: Record<string, any>) => {
    const hasJSON = !!rowJSONPatch && Object.keys(rowJSONPatch).length > 0;
    const hasColumns = !!columnsPatch && Object.keys(columnsPatch).length > 0;
    if (!hasJSON && !hasColumns) return;
    const current = rowsRef.current.find((r) => r.rowGUID === id);
    setRows(rowsRef.current
      .map((r) => (r.rowGUID === id ? { ...r, ...(hasColumns ? columnsPatch : {}), rowJSON: { ...(r.rowJSON || {}), ...(hasJSON ? rowJSONPatch : {}) } } : r))
      .filter((r) => r.rowGUID !== id || (matchRow(r, scope) && (!rowFilter || rowFilter(r)))));
    if (actions?.updateOne) {
      dispatch(actions.updateOne({
        rowGUID: id,
        rowOwnerGUID: scopedOwner ?? current?.rowOwnerGUID,
        ...(hasJSON ? { rowJSON: rowJSONPatch } : {}),
        ...(hasColumns ? { columns: columnsPatch } : {}),
      }));
    }
    onRowEdit?.(id, 'update');
  }, [actions, dispatch, scopedOwner, scope, rowFilter, setRows, onRowEdit]);
  /**
   * one edited cell: checked (column validate + date / color form), its value + the cells that depend on it are
   * cleared, derived fields (computeRowJSON) are added. false = refused (a snackbar says why)
   */
  const setCell = useCallback((id: string, columnKey: string, value: any): boolean => {
    const col = visualColumns.find((c) => c.key === columnKey);
    const row = rowsRef.current.find((r) => r.rowGUID === id);
    if (!col || !row) return false;
    const error = builtInCellError(col, value) || (col.validate ? col.validate(value, row) : null);
    if (error) { dispatch(showSnackbar({ message: error })); return false; }
    const patch = cellPatch(visualColumns, columnKey, value);
    if (computeRowJSON) {
      const nextJSON = { ...(row.rowJSON || {}), ...patch.rowJSON };
      const extra = computeRowJSON(nextJSON, { ...row, ...patch.columns, rowJSON: nextJSON });
      if (extra && typeof extra === 'object') Object.assign(patch.rowJSON, extra);
    }
    patchRow(id, patch.rowJSON, patch.columns);
    return true;
  }, [computeRowJSON, dispatch, patchRow, visualColumns]);

  // ---- reorder (orderInList) ----
  const moveTo = useCallback((from: number, to: number) => {
    if (!reorderEnabled) return;
    const { rows: next, moved } = moveRow(rowsRef.current, from, to);
    if (!moved) return;
    setRows(next);
    if (actions?.updateOne) dispatch(actions.updateOne({ rowGUID: moved.rowGUID, rowOwnerGUID: scopedOwner ?? moved.rowOwnerGUID, field: 'orderInList', value: moved.orderInList }));
    onRowEdit?.(moved.rowGUID, 'move');
  }, [actions, dispatch, scopedOwner, reorderEnabled, setRows, onRowEdit]);
  /** the selected rows one step up (-1) / down (1), together */
  const moveSelected = useCallback((ids: string[], direction: 1 | -1) => {
    if (!reorderEnabled) return;
    const { rows: next, moved } = moveSelectedRows(rowsRef.current, ids, direction);
    if (moved.length === 0) return;
    setRows(next);
    if (actions?.updateOne) moved.forEach((m) => dispatch(actions.updateOne({ rowGUID: m.rowGUID, rowOwnerGUID: scopedOwner ?? m.rowOwnerGUID, field: 'orderInList', value: m.orderInList })));
    moved.forEach((m) => onRowEdit?.(m.rowGUID, 'move'));
  }, [actions, dispatch, scopedOwner, reorderEnabled, setRows, onRowEdit]);
  const moveUp = useCallback((id: string) => { const i = indexOf(id); moveTo(i, i - 1); }, [moveTo]);
  const moveDown = useCallback((id: string) => { const i = indexOf(id); moveTo(i, i + 1); }, [moveTo]);
  const makeFirst = useCallback((id: string) => moveTo(indexOf(id), 0), [moveTo]);
  const makeLast = useCallback((id: string) => moveTo(indexOf(id), rowsRef.current.length - 1), [moveTo]);

  // ---- sql_for_delete / archive (the saga shows "… successfully deleted" + Undo) ----
  const remove = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRows(rowsRef.current.filter((r) => !ids.includes(r.rowGUID)));
    if (actions?.deleteOne) ids.forEach((rowGUID) => dispatch(actions.deleteOne({ rowGUID, ...(scopedOwner ? { rowOwnerGUID: scopedOwner } : {}) })));
    ids.forEach((rowGUID) => onRowEdit?.(rowGUID, 'delete'));
  }, [actions, dispatch, scopedOwner, setRows, onRowEdit]);
  const canArchive = !!archiveActions?.createOne;
  const archive = useCallback((id: string) => {
    // no archive entity: archiving must not silently sql_for_delete the row
    if (!archiveActions?.createOne) return;
    const row = rowsRef.current.find((r) => r.rowGUID === id);
    if (!row) return;
    const { rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON } = row;
    dispatch(archiveActions.createOne({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList, rowJSON }));
    remove([id]);
  }, [archiveActions, dispatch, remove]);

  return { rows, loading, error: entityState?.readErrorData as any, realtimeStatus: entityState?.realtimeStatus as string | undefined, canArchive, refresh,
    createFirst, createLast, createBefore, createAfter, duplicate, patchRow, setCell, moveTo, moveSelected, moveUp, moveDown, makeFirst, makeLast, remove, archive };
}

export type ReusableTableCrud = ReturnType<typeof useReusableTableCrud>;
