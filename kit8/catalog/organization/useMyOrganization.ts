// The organization of the signed-in user (userState.userOrganization.rowGUID), read ONE row by its GUID - not the whole organization list, so the
// organization screens' realtime channel (useRealtimeEntity) is not touched. Used by the Project settings window:
//   defaults  = organizationTable.rowJSON.defaultProjectSettings (null while never saved) - a NEW project starts from them
//   saveDefaultProjectSettings(settings) - "Save settings to organization": merges them into the CURRENT rowJSON of the row (no other key is lost).
//   numberOfVisitsEnabled = the Organization switch numberOfVisitsFunctionalityEnabled (true unless stored false): kit8/catalog/user/visit
//   Only the administrator (the creator) can change an organization: the database policy refuses anybody else (no row comes back = "not allowed").
// Without a Supabase provider or a signed-in user the hook is idle (screens and tests without them keep working).
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import { selectUserOrganizationGUID } from '../../redux/activeUserSlice';
import { organizationTable, type OrganizationRowJSON } from './organizationModel';
import { numberOfVisitsEnabledOf } from '../user/visit/routeVisitModel';
import {
  DEFAULT_PROJECT_SETTINGS_KEY,
  defaultProjectSettingsOf,
  storedDefaultProjectSettings,
  type DefaultProjectSettings,
} from './defaultProjectSettings';

const orgKey = (guid: string) => ['organization-row', guid] as const;

function useClient(): any {
  try {
    return useSupabase().supabase;
  } catch {
    return null;
  }
}

export type SaveDefaultsResult = { ok: true } | { ok: false; error: string };

export function useMyOrganization() {
  const organizationGUID: string = useSelector(selectUserOrganizationGUID) || '';
  const client = useClient();
  const qc = useQueryClient();

  const readRow = useCallback(async (): Promise<{ rowGUID: string; rowJSON: OrganizationRowJSON } | null> => {
    const { data, error } = await client.from(organizationTable).select('rowGUID,rowJSON').eq('rowGUID', organizationGUID).maybeSingle();
    if (error) throw error;
    return data || null;
  }, [client, organizationGUID]);

  const query = useQuery({
    queryKey: orgKey(organizationGUID),
    queryFn: readRow,
    enabled: !!organizationGUID && !!client,
    staleTime: 15_000,
  });

  const defaults: DefaultProjectSettings | null = storedDefaultProjectSettings(query.data?.rowJSON);

  const saveDefaultProjectSettings = useCallback(
    async (settings: DefaultProjectSettings): Promise<SaveDefaultsResult> => {
      if (!organizationGUID || !client) return { ok: false, error: 'No organization: sign in first.' };
      try {
        const fresh = await readRow(); // merge into the newest rowJSON
        if (!fresh) return { ok: false, error: 'Your organization was not found.' };
        const rowJSON = { ...fresh.rowJSON, [DEFAULT_PROJECT_SETTINGS_KEY]: defaultProjectSettingsOf(settings) };
        const { data, error } = await client.from(organizationTable).update({ rowJSON }).eq('rowGUID', organizationGUID).select('rowGUID');
        if (error) return { ok: false, error: error.message || String(error) };
        if (!data || data.length === 0) return { ok: false, error: 'Only the administrator of the organization (its creator) can change its settings.' };
        qc.setQueryData(orgKey(organizationGUID), { rowGUID: organizationGUID, rowJSON });
        return { ok: true };
      } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
      }
    },
    [client, organizationGUID, qc, readRow],
  );

  const numberOfVisitsEnabled = numberOfVisitsEnabledOf(query.data?.rowJSON);

  return { organizationGUID, defaults, loaded: query.isSuccess, numberOfVisitsEnabled, saveDefaultProjectSettings };
}
