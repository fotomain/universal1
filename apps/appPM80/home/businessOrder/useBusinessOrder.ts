// useBusinessOrder - reads and saves the Business order setup of the PM80 home.
//   projects   usePM80Projects: the REAL projects of the user (React Query, same cache as the dashboard); the demo projects while
//              there are none (a guest, nothing loaded yet)
//   stored     the organization's and the projects' rowJSON.businessOrderSettings (+ the copy kept on this device)
//   save       businessOrderTargets(): ONE project -> it, SOME -> each of them, ALL -> the organization and each project
// Every hook works without a Supabase / redux provider (screens and tests without them keep working).
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../../../kit8/providers/WithSupabase';
import { usePMOwnerGUID } from '../../../../kit8/pm/crud/queries';
import { createPMApi } from '../../../../kit8/pm/crud/api/api_pm';
import { pmKeys } from '../../../../kit8/pm/crud/shared/queryShared';
import { useMyOrganization } from '../../../../kit8/catalog/organization/useMyOrganization';
import { useActiveOrganizationGUID } from '../../../../kit8/catalog/organization/switch/useActiveOrganizationGUID';
import { projectsOfOrganization } from '../../../../kit8/catalog/organization/switch/organizationSwitchModel';
import type { PMProjectRow } from '../../../../kit8/pm/model/types';
import { PM80_PROJECTS, pm80ProjectsFromRows, type PM80Project } from '../pm80HomeModel';
import {
  BUSINESS_ORDER_KEY,
  BusinessOrderSelection,
  BusinessOrderSettings,
  StoredBusinessOrders,
  businessOrderTargets,
  normalizeBusinessOrder,
  resolveBusinessOrder,
  storedBusinessOrder,
} from './businessOrderModel';
import { saveBusinessOrderLocal, useBusinessOrderLocal } from './businessOrderLocal';

function useSafeClient(): any {
  try {
    return useSupabase().supabase;
  } catch {
    return null;
  }
}
function useSafeOwner(): string {
  try {
    return usePMOwnerGUID();
  } catch {
    return '';
  }
}
function useSafeOrganization() {
  try {
    return useMyOrganization();
  } catch {
    return null;
  }
}

export interface PM80ProjectsSource {
  /** the items of the project filter */
  projects: PM80Project[];
  /** true = the user's own projects; false = the demo list */
  real: boolean;
  /** the rows of the real projects (their rowJSON holds the Business order setup) */
  rows: PMProjectRow[];
  ownerGUID: string;
}

const NO_ROWS: PMProjectRow[] = [];

export function usePM80Projects(): PM80ProjectsSource {
  const client = useSafeClient();
  const ownerGUID = useSafeOwner();
  const organizationGUID = useActiveOrganizationGUID();
  const query = useQuery({
    queryKey: pmKeys.projects(ownerGUID),
    queryFn: () => createPMApi(client).readProjects(ownerGUID),
    enabled: !!ownerGUID && !!client,
  });
  const rows = useMemo(
    () => (query.data ? projectsOfOrganization(query.data as PMProjectRow[], organizationGUID) : NO_ROWS),
    [query.data, organizationGUID]
  );
  return useMemo(() => {
    if (rows.length === 0) return { projects: PM80_PROJECTS, real: false, rows: NO_ROWS, ownerGUID };
    return { projects: pm80ProjectsFromRows(rows as any), real: true, rows, ownerGUID };
  }, [rows, ownerGUID]);
}

/** what is stored: the database copy wins, the copy of this device fills what the database does not have */
export function useStoredBusinessOrders(rows: PMProjectRow[]): StoredBusinessOrders {
  const org = useSafeOrganization();
  const local = useBusinessOrderLocal();
  return useMemo(() => {
    const projects: StoredBusinessOrders['projects'] = { ...local.projects };
    rows.forEach((r) => {
      const s = storedBusinessOrder(r.rowJSON);
      if (s) projects[r.rowGUID] = s;
    });
    return { organization: storedBusinessOrder(org?.organizationJSON) ?? local.organization, projects };
  }, [org?.organizationJSON, local, rows]);
}

/** the setup the home shows for the selection */
export function useBusinessOrderFor(selection: BusinessOrderSelection, rows: PMProjectRow[]): BusinessOrderSettings {
  const stored = useStoredBusinessOrders(rows);
  return useMemo(() => resolveBusinessOrder(selection, stored), [selection, stored]);
}

export interface BusinessOrderSaveReport {
  /** everything asked was written to the database */
  ok: boolean;
  /** what went to the database */
  savedOrganization: boolean;
  savedProjects: string[];
  /** what stayed on this device only (a demo project, a guest, a refused write) */
  localOnly: string[];
  /** what the database refused */
  failures: Array<{ target: string; error: string }>;
}

/**
 * Saves the setup. ONE project: that project's rowJSON.businessOrderSettings; SOME: each of them; ALL: the organization and each
 * project. A target the database cannot take (a guest, a demo project, the organization of somebody else, a read-only project) keeps
 * the setup on this device and is named in the report.
 */
export function useSaveBusinessOrder(rows: PMProjectRow[], ownerGUID: string, allProjectIds: string[]) {
  const client = useSafeClient();
  const org = useSafeOrganization();
  const qc = useQueryClient();
  const realIds = useMemo(() => new Set(rows.map((r) => r.rowGUID)), [rows]);

  return useCallback(
    async (settings: BusinessOrderSettings, selection: BusinessOrderSelection): Promise<BusinessOrderSaveReport> => {
      const value = normalizeBusinessOrder(settings);
      const targets = businessOrderTargets(selection, allProjectIds);
      const report: BusinessOrderSaveReport = { ok: true, savedOrganization: false, savedProjects: [], localOnly: [], failures: [] };
      const localOrg: boolean[] = [];
      const localProjects: string[] = [];

      if (targets.organization) {
        const r = org ? await org.saveOrganizationKey(BUSINESS_ORDER_KEY, value) : ({ ok: false, error: 'No organization: sign in first.' } as const);
        if (r.ok) report.savedOrganization = true;
        else {
          localOrg.push(true);
          report.failures.push({ target: 'organization', error: r.error });
        }
      }

      const api = client ? createPMApi(client) : null;
      for (const id of targets.projectIds) {
        if (!api || !realIds.has(id)) {
          localProjects.push(id); // a demo project or a guest: this device only
          continue;
        }
        try {
          const fresh = await api.readProject(id);
          if (!fresh) throw new Error('The project was not found.');
          await api.updateProject(id, { rowJSON: { ...fresh.rowJSON, [BUSINESS_ORDER_KEY]: value } } as any);
          report.savedProjects.push(id);
        } catch (e: any) {
          localProjects.push(id);
          report.failures.push({ target: id, error: e?.message || String(e) });
        }
      }

      if (localOrg.length || localProjects.length) {
        saveBusinessOrderLocal({ organization: localOrg.length > 0, projectIds: localProjects }, value);
        report.localOnly = [...(localOrg.length ? ['organization'] : []), ...localProjects];
      }
      report.ok = report.failures.length === 0 && report.localOnly.length === 0;
      if (report.savedProjects.length) await qc.invalidateQueries({ queryKey: pmKeys.projects(ownerGUID) });
      return report;
    },
    [allProjectIds, client, org, ownerGUID, qc, realIds]
  );
}
