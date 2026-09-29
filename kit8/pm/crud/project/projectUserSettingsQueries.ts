// React Query hooks for project_user_settings_table - the Gantt / tree settings of the signed-in
// user per project (rowOwnerGUID = project, rowParentGUID = user, rowJSON.uxuiSettings).
//
//   useReadProjectUserSettingsQuery(userGUID)  all rows of the user -> store.setAllProjectUserSettings
//   useSaveProjectUserSettings(userGUID)       saveUxuiSettings(projectGUID, patch): merged with the
//                                              effective settings, store first (no flicker), then upsert
//
// Table not created yet (update_pm_tables_userSettings.sql not run): the settings are saved the old
// way, in project_table.rowJSON.uxuiSettings, so the app keeps working.

import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePMStore } from '../../store/store_pm';
import { effectiveUxuiSettings } from '../../store/storeDerive';
import { PMProjectUserSettingsRow, PMUxUiSettings } from '../../model/types';
import { errorMessage } from '../api/apiUtils';
import { PMMissingTableError } from '../api/projectUserSettingsApi';
import { pmKeys, usePMApi } from '../shared/queryShared';
import { useUpdateProjectMutation } from './projectQueries';

type UserSettingsData = { rows: PMProjectUserSettingsRow[]; missing: boolean };

const byProjectOf = (rows: PMProjectUserSettingsRow[]): Record<string, PMUxUiSettings> =>
  Object.fromEntries(rows.map((r) => [r.rowOwnerGUID, r.rowJSON?.uxuiSettings || {}]));

export function useReadProjectUserSettingsQuery(userGUID: string | null | undefined) {
  const api = usePMApi();
  const setAll = usePMStore((s) => s.setAllProjectUserSettings);
  const query = useQuery({
    queryKey: pmKeys.userSettings(userGUID),
    queryFn: () => api.readProjectUserSettings(userGUID as string),
    enabled: !!userGUID,
  });
  useEffect(() => {
    if (query.data) setAll(byProjectOf(query.data.rows), query.data.missing);
  }, [query.data, setAll]);
  return query;
}

export function useSaveProjectUserSettings(userGUID: string | null | undefined) {
  const api = usePMApi();
  const qc = useQueryClient();
  const key = pmKeys.userSettings(userGUID);
  const updateProject = useUpdateProjectMutation(userGUID);

  /** Old storage: project_table.rowJSON.uxuiSettings (legacy top-level keys are moved into it). */
  const saveLegacy = useCallback(
    (projectGUID: string, uxuiSettings: PMUxUiSettings) => {
      const project = usePMStore.getState().projectsById[projectGUID];
      if (!project) return;
      const { showCriticalPath: _a, ganttArrowsForm: _b, showTaskProgressOnGantt: _c, ...json } = project.rowJSON;
      updateProject.mutate({ rowGUID: projectGUID, patch: { rowJSON: { ...json, uxuiSettings } } });
    },
    [updateProject]
  );

  const mutation = useMutation({
    mutationFn: (v: { projectGUID: string; settings: PMUxUiSettings }) => api.saveProjectUserSettings(v.projectGUID, userGUID as string, v.settings),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<UserSettingsData>(key);
      const prevSettings = usePMStore.getState().userSettingsByProject[v.projectGUID] ?? null;
      usePMStore.getState().setProjectUserSettings(v.projectGUID, v.settings);
      if (prev) {
        const row: PMProjectUserSettingsRow = prev.rows.find((r) => r.rowOwnerGUID === v.projectGUID) ?? {
          rowGUID: '',
          rowOwnerGUID: v.projectGUID,
          rowParentGUID: userGUID as string,
          orderInList: 0,
          rowJSON: {},
        };
        const rows = [...prev.rows.filter((r) => r.rowOwnerGUID !== v.projectGUID), { ...row, rowJSON: { ...row.rowJSON, uxuiSettings: v.settings } }];
        qc.setQueryData<UserSettingsData>(key, { ...prev, rows });
      }
      return { prev, prevSettings };
    },
    onError: (err, v, ctx) => {
      if (err instanceof PMMissingTableError) {
        // SQL upgrade not run yet: keep the new values and store them the old way
        usePMStore.getState().setAllProjectUserSettings(usePMStore.getState().userSettingsByProject, true);
        saveLegacy(v.projectGUID, v.settings);
        return;
      }
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      usePMStore.getState().setProjectUserSettings(v.projectGUID, ctx?.prevSettings ?? null);
      usePMStore.getState().setError(errorMessage(err));
    },
    onSettled: (_d, err) => {
      if (!(err instanceof PMMissingTableError)) qc.invalidateQueries({ queryKey: key });
    },
  });

  /** Merges `patch` into the effective settings of the project and saves the result for this user. */
  const saveUxuiSettings = useCallback(
    (projectGUID: string | null | undefined, patch: PMUxUiSettings) => {
      if (!projectGUID || !userGUID) return;
      const s = usePMStore.getState();
      if (!s.projectsById[projectGUID]) return;
      const settings: PMUxUiSettings = { ...effectiveUxuiSettings(s, projectGUID), ...patch };
      if (s.userSettingsTableMissing) {
        s.setProjectUserSettings(projectGUID, settings);
        saveLegacy(projectGUID, settings);
        return;
      }
      mutation.mutate({ projectGUID, settings });
    },
    [mutation, saveLegacy, userGUID]
  );

  return { saveUxuiSettings, isSaving: mutation.isPending };
}
