// ReusableList, clientDataMode - every row of the scope is in memory. The data layer is the one of ReusableTable (useReusableTableCrud):
// redux entity + realtime + optimistic CRUD, or `localRows`. Search / filter / sort are done by the list (listEngine.buildView).
import { useCallback, useMemo } from 'react';
import { useReusableTableCrud } from '../../table/reusable/useReusableTableCrud';
import type { ReusableListProps, ReusableListSource } from './reusableListTypes';

export function useReusableListClient(props: ReusableListProps, direction: 'asc' | 'desc'): ReusableListSource {
  const crud = useReusableTableCrud({
    entityName: props.entityName, entityForArchivationName: props.entityForArchivationName, listOwnerGUID: props.listOwnerGUID, listParentGUID: props.listParentGUID,
    readParams: props.readParams, realtime: props.realtime, visualColumns: props.visualColumns, defaultRowJSON: props.defaultRowJSON, reorderEnabled: props.reorderEnabled,
    onRowsChange: props.onRowsChange, onRowEdit: props.onRowEdit, rowFilter: props.rowFilter, newRowDefaults: props.newRowDefaults, computeRowJSON: props.computeRowJSON,
    duplicateOverrides: props.duplicateOverrides, localRows: props.localRows, onLocalRowsChange: props.onLocalRowsChange,
  });
  const desc = direction === 'desc';
  const { rows } = crud;

  /** a new row at an index of the SHOWN list: the crud works on the ascending list, so a descending view mirrors the index */
  const createAt = useCallback((viewIndex: number, rowJSON?: Record<string, any>) => {
    const n = rows.length;
    const at = Math.max(0, Math.min(desc ? n - viewIndex : viewIndex, n));
    if (rowJSON) {
      // a row with its own values: the crud has no "create with values at" - duplicate-like path
      const id = at <= 0 ? crud.createFirst() : at >= n ? crud.createLast() : crud.createBefore(rows[at].rowGUID);
      if (id) crud.patchRow(id, rowJSON);
      return id;
    }
    return at <= 0 ? crud.createFirst() : at >= n ? crud.createLast() : crud.createBefore(rows[at].rowGUID);
  }, [crud, rows, desc]);
  const duplicate = useCallback((guid: string, before = false) => crud.duplicate(guid, desc ? !before : before), [crud, desc]);

  return useMemo<ReusableListSource>(() => ({
    mode: 'clientDataMode', rows, loading: crud.loading, loadingMore: false, error: crud.error, total: rows.length, hasMore: false,
    loadMore: () => {}, refresh: crud.refresh, createAt, duplicate, setCell: crud.setCell, patchRow: crud.patchRow, remove: crud.remove,
    archive: crud.archive, canArchive: crud.canArchive, setOrder: crud.setOrder,
  }), [rows, crud, createAt, duplicate]);
}
