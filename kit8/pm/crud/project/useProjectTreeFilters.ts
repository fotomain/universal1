// Filter & sort of the task tree columns (view/tree/filter) - saved per project AND user in
// project_user_settings_table.rowJSON.uxuiSettings:
//   treeColumnsFilters { [columnKey]: { filterVariantForColumn, value, value2 } } · treeColumnSort { key, direction } | null
//   columnFilterIconColor (settings window, Tree tab)
//
// Flow: click the ▾ / filter icon at the right of a tree header, or right-click (touch: long-press) the header
// -> "Filter & sort" -> PMTreeColumnFilterPopup -> Apply / Clear / Sort. Every change is optimistic: the store
// re-computes the visible rows at once (tree + Gantt follow), then the setting is upserted.

import { useMemo } from 'react';
import { usePMStore } from '../../store/store_pm';
import { PMTreeColumnKey } from '../../model/types';
import { useSaveProjectUserSettings } from './projectUserSettingsQueries';
import { collapsedContextRows, PMTreeColumnFilter, PMTreeColumnSort } from '../../view/tree/filter/treeColumnFilter';

export function useProjectTreeFilters(ownerGUID: string, projectGUID: string | null) {
  const { saveUxuiSettings } = useSaveProjectUserSettings(ownerGUID);
  return useMemo(() => {
    const st = () => usePMStore.getState();
    const save = (patch: Parameters<typeof saveUxuiSettings>[1]) => saveUxuiSettings(projectGUID, patch);
    return {
      /** "Filter & sort" popup of a column at a window point (its top-left corner). */
      openTreeColumnFilter: (key: PMTreeColumnKey, x: number, y: number) => {
        st().setCellEdit(null);
        st().setTreeColumnFilterPopup({ key, x, y });
      },
      closeTreeColumnFilter: () => st().setTreeColumnFilterPopup(null),

      /** Sets (or clears: null) the filter of one column; stages hiding a match are expanded once. */
      setTreeColumnFilter: (key: PMTreeColumnKey, filter: PMTreeColumnFilter | null) => {
        const next = { ...st().treeColumnsFilters };
        if (filter) next[key] = filter;
        else delete next[key];
        st().setTreeColumnsSettings({ treeColumnsFilters: next });
        const s = st();
        const pg = s.selectedProjectGUID;
        if (filter && pg) {
          const hidden = collapsedContextRows(s.treeFilterContextGUIDs, s.expandedByProject[pg] || {});
          if (hidden.length) s.expandRows(hidden);
        }
        save({ treeColumnsFilters: next });
      },

      /** Sorts the siblings of every parent by a column (null = tree order). */
      setTreeColumnSort: (sort: PMTreeColumnSort | null) => {
        st().setTreeColumnsSettings({ treeColumnSort: sort });
        save({ treeColumnSort: sort });
      },

      /** Removes every column filter and the sort. */
      clearTreeColumnsFilters: () => {
        st().setTreeColumnsSettings({ treeColumnsFilters: {}, treeColumnSort: null });
        save({ treeColumnsFilters: {}, treeColumnSort: null });
      },
    };
  }, [saveUxuiSettings, projectGUID]);
}
