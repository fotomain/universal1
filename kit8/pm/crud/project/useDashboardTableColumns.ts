// useDashboardTableColumns - the column widths of ONE table of the project dashboard are part of its last state: saved per user, project AND work place
// (project_dashboard_user_settings_table.rowJSON.uxuiSettings.tableColumnsWidth[tableKey]) and read back at once from the zustand store.
//   <ReusableTable resizeColumnWidth {...useDashboardTableColumns(projectGUID, 'taskLines.timeGenus')} />
import { useMemo } from 'react';
import { usePMStore } from '../../store/store_pm';
import { usePMOwnerGUID } from '../queries';
import { useProjectViewSettings } from './useProjectViewSettings';

export function useDashboardTableColumns(projectGUID: string | null | undefined, tableKey: string) {
  const ownerGUID = usePMOwnerGUID();
  const { setTableColumnsWidth } = useProjectViewSettings(ownerGUID, projectGUID ?? null);
  const columnsWidths = usePMStore((s) => (projectGUID ? s.userSettingsByProject[projectGUID]?.tableColumnsWidth?.[tableKey] : undefined));
  return useMemo(
    () => ({ columnsWidths, onColumnsWidthsChange: (widths: Record<string, number>) => setTableColumnsWidth(tableKey, widths) }),
    [columnsWidths, setTableColumnsWidth, tableKey]
  );
}
