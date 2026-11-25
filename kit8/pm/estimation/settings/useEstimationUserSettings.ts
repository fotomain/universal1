// Hooks of the last state of the estimation dashboard (estimationUserSettingsStore.ts). The dashboard calls useEstimationUserSettingsSession once;
// every other component reads its slice with useEstimationProjectSettings / useEstimationTableColumns (zustand selectors: no provider needed).
import { useCallback, useEffect, useMemo } from 'react';
import { usePMWorkPlaceGUID } from '../../crud/shared/useWorkPlaceGUID';
import {
  ESTIMATION_DASHBOARD_ROW, type EstimationDashboardSettings, type EstimationProjectSettings,
} from './estimationUserSettingsModel';
import { flushEstimationSettings, patchEstimationSettings, startEstimationSettings, useEstimationSettingsStore } from './estimationUserSettingsStore';

const NONE_PROJECT: EstimationProjectSettings = {};
const NONE_DASHBOARD: EstimationDashboardSettings = {};

/** Starts the memory for (user, work place) while the dashboard is open; saves what is waiting when it closes. Returns `ready`. */
export function useEstimationUserSettingsSession(client: any, userGUID: string | null | undefined): boolean {
  const workPlaceGUID = usePMWorkPlaceGUID();
  useEffect(() => {
    if (!client || !userGUID || !workPlaceGUID) return;
    void startEstimationSettings({ client, userGUID, workPlaceGUID });
  }, [client, userGUID, workPlaceGUID]);
  useEffect(() => () => { void flushEstimationSettings(); }, []);
  return useEstimationSettingsStore((s) => s.ready);
}

export function useEstimationDashboardSettings() {
  const dashboard = useEstimationSettingsStore((s) => s.state.dashboard) ?? NONE_DASHBOARD;
  const save = useCallback((patch: EstimationDashboardSettings) => patchEstimationSettings(ESTIMATION_DASHBOARD_ROW, patch), []);
  return { dashboard, save };
}

export function useEstimationProjectSettings(projectGUID: string | null | undefined) {
  const settings = useEstimationSettingsStore((s) => (projectGUID ? s.state.byProject[projectGUID] : undefined)) ?? NONE_PROJECT;
  const save = useCallback((patch: EstimationProjectSettings) => { if (projectGUID) patchEstimationSettings(projectGUID, patch); }, [projectGUID]);
  return { settings, save };
}

/** The widths of the columns of one table of the estimation dashboard: <ReusableTable resizeColumnWidth {...useEstimationTableColumns(projectGUID, 'normBooks')} /> (no project = the row of the whole dashboard) */
export function useEstimationTableColumns(projectGUID: string | null | undefined, tableKey: string) {
  const ownerKey = projectGUID || ESTIMATION_DASHBOARD_ROW;
  const columnsWidths = useEstimationSettingsStore((s) => (projectGUID ? s.state.byProject[projectGUID] : s.state.dashboard)?.tableColumnsWidth?.[tableKey]);
  return useMemo(() => ({
    columnsWidths,
    onColumnsWidthsChange: (widths: Record<string, number>) => {
      const st = useEstimationSettingsStore.getState().state;
      const cur = (ownerKey === ESTIMATION_DASHBOARD_ROW ? st.dashboard : st.byProject[ownerKey])?.tableColumnsWidth ?? {};
      patchEstimationSettings(ownerKey, { tableColumnsWidth: { ...cur, [tableKey]: widths } });
    },
  }), [columnsWidths, ownerKey, tableKey]);
}
