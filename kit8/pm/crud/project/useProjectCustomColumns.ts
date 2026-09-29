// AddCustomProjectTaskColumn: custom tree columns of the selected project.
//
//   definitions + header colors -> project_table.rowJSON.customColumns
//                                  { columns: [{ key, name, type }], headersBackgroundColors: { [key]: color } }
//   column order / widths       -> project_table.rowJSON.uxuiSettings.treeColumnsOrder / treeColumnsWidths
//   values                      -> project_task_table.rowJSON.customColumns { [key]: value }  (crud.setCustomColumnValue)
//
// Flow: right-click (long-press on touch) a tree header -> PMTreeHeaderMenu -> "Add custom column" ▸ type ->
// PMCustomColumnNameModalWindow -> addCustomColumn(type, name): the column is appended as the LAST column
// and the tree scrolls horizontally to it. "Delete custom column" asks first, then removes the definition,
// its order / width / header color and its values in every task.
// Every change is optimistic (store first, then the project / task mutations).

import { useMemo } from 'react';
import { approvePM } from '../../inner/PMApproveYesNoCancelModalWindow';
import { usePMStore } from '../../store/store_pm';
import { PMTreeColumnKey, PMUxUiSettings, uxuiSettingsOf } from '../../model/types';
import {
  isCustomColumnKey,
  newCustomColumnKey,
  PMCustomColumnDef,
  PMCustomColumnType,
  projectCustomColumnsOf,
  taskCustomValuesOf,
  validateCustomColumnName,
  withCustomColumnAdded,
  withCustomColumnDeleted,
  withHeaderBackgroundColor,
  PM_CUSTOM_COLUMN_TYPE_LABEL,
} from '../../view/tree/columns/customColumns';
import { useUpdateProjectMutation } from './projectQueries';
import { useUpdateTaskMutation } from '../task/taskQueries';

export function useProjectCustomColumns(ownerGUID: string, projectGUID: string | null) {
  const updateProject = useUpdateProjectMutation(ownerGUID);
  const updateTaskMutation = useUpdateTaskMutation(projectGUID);

  return useMemo(() => {
    const st = () => usePMStore.getState();
    const project = () => (projectGUID ? st().projectsById[projectGUID] : undefined);

    /** One project write: new customColumns + uxuiSettings patch; the store switches first (no flicker). */
    const saveProject = (customColumns: ReturnType<typeof withCustomColumnAdded>, uxui: PMUxUiSettings) => {
      const p = project();
      if (!p) return;
      const { showCriticalPath: _a, ganttArrowsForm: _b, showTaskProgressOnGantt: _c, ...json } = p.rowJSON;
      const uxuiSettings: PMUxUiSettings = { ...uxuiSettingsOf(p.rowJSON), ...uxui };
      const cc = projectCustomColumnsOf({ customColumns });
      st().setTreeColumnsSettings({
        customColumns: cc.columns,
        treeHeadersBackgroundColors: cc.headersBackgroundColors,
        ...(uxui.treeColumnsOrder ? { treeColumnsOrder: uxui.treeColumnsOrder } : {}),
        ...(uxui.treeColumnsWidths ? { treeColumnsWidths: uxui.treeColumnsWidths } : {}),
      });
      updateProject.mutate({ rowGUID: p.rowGUID, patch: { rowJSON: { ...json, customColumns, uxuiSettings } } });
    };

    return {
      /** Tree header menu at a window point (web: right-click, touch: long-press on a header). */
      openTreeHeaderMenu: (columnKey: PMTreeColumnKey | null, x: number, y: number) => st().setTreeHeaderMenu({ x, y, columnKey }),
      closeTreeHeaderMenu: () => st().setTreeHeaderMenu(null),
      /** Opens the "column name" window for a new column of this type. */
      promptAddCustomColumn: (type: PMCustomColumnType) => st().setCustomColumnPrompt({ type }),
      /** Opens the "column name" window to rename a custom column. */
      promptRenameCustomColumn: (key: string) => {
        const def = st().customColumns.find((c) => c.key === key);
        if (def) st().setCustomColumnPrompt({ type: def.type, key: def.key, name: def.name });
      },
      closeCustomColumnPrompt: () => st().setCustomColumnPrompt(null),

      /** Checks a name before adding / renaming (null = ok); `exceptKey` = the column being renamed. */
      validateCustomColumnName: (name: string, exceptKey?: string) =>
        validateCustomColumnName(name, projectCustomColumnsOf(project()?.rowJSON).columns.filter((c) => c.key !== exceptKey)),

      /**
       * Adds the column as the LAST tree column and scrolls the tree to it.
       * Returns the new key, or null when the name is invalid / no project is selected.
       */
      addCustomColumn: (type: PMCustomColumnType, name: string): PMCustomColumnDef['key'] | null => {
        const p = project();
        if (!p) return null;
        const cur = projectCustomColumnsOf(p.rowJSON);
        if (validateCustomColumnName(name, cur.columns)) return null;
        const key = newCustomColumnKey(cur.columns.map((c) => c.key));
        const def: PMCustomColumnDef = { key, name: name.trim(), type, createdAt: new Date().toISOString() };
        const order = [...uxuiSettingsOf(p.rowJSON).treeColumnsOrder.filter((k) => k !== key), key];
        saveProject(withCustomColumnAdded(p.rowJSON, def), { treeColumnsOrder: order });
        st().setCustomColumnPrompt(null);
        st().requestTreeColumnReveal(key);
        return key;
      },

      /** Renames a custom column (same validation as adding). */
      renameCustomColumn: (key: string, name: string) => {
        const p = project();
        if (!p || !isCustomColumnKey(key)) return false;
        const cur = projectCustomColumnsOf(p.rowJSON);
        if (validateCustomColumnName(name, cur.columns.filter((c) => c.key !== key))) return false;
        saveProject({ ...cur, columns: cur.columns.map((c) => (c.key === key ? { ...c, name: name.trim() } : c)) }, {});
        st().setCustomColumnPrompt(null);
        return true;
      },

      /** Asks first; removes the column, its order / width / header color and the values in every task. */
      deleteCustomColumn: async (key: string) => {
        const p = project();
        if (!p || !isCustomColumnKey(key)) return false;
        const def = projectCustomColumnsOf(p.rowJSON).columns.find((c) => c.key === key);
        if (!def) return false;
        const withValues = st().tasks.filter((t) => Object.prototype.hasOwnProperty.call(taskCustomValuesOf(t.rowJSON), key));
        const ok = await approvePM({
          title: `Delete the column "${def.name}"?`,
          message: `${PM_CUSTOM_COLUMN_TYPE_LABEL[def.type]} column${withValues.length ? ` · its values in ${withValues.length} task${withValues.length === 1 ? '' : 's'} are deleted too` : ''}. This cannot be undone.`,
          yesLabel: 'Delete',
          destructive: true,
        });
        if (!ok) return false;
        const fresh = project() ?? p;
        const u = uxuiSettingsOf(fresh.rowJSON);
        const { [key]: _w, ...treeColumnsWidths } = u.treeColumnsWidths;
        saveProject(withCustomColumnDeleted(fresh.rowJSON, key), { treeColumnsOrder: u.treeColumnsOrder.filter((k) => k !== key), treeColumnsWidths });
        const s = st();
        if (s.cellEdit?.field === key) s.setCellEdit(null);
        for (const t of withValues) {
          const { [key]: _v, ...rest } = taskCustomValuesOf(t.rowJSON);
          updateTaskMutation.mutate({ rowGUID: t.rowGUID, patch: { rowJSON: { ...t.rowJSON, customColumns: rest } } });
        }
        return true;
      },

      /** project.rowJSON.customColumns.headersBackgroundColors[key] (null = theme header color). */
      setTreeHeaderBackgroundColor: (key: PMTreeColumnKey, color: string | null) => {
        const p = project();
        if (!p) return;
        saveProject(withHeaderBackgroundColor(p.rowJSON, key, color), {});
      },
    };
  }, [projectGUID, updateProject, updateTaskMutation]);
}
