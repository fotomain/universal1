// useReportOrganizationScope - the organization cut of the Monitor reports (documentation/PERMISSIONS_WBS.html section 13).
// A user of TWO OR MORE organizations picks the active one with the OrganizationFilter in the bar of every report (Monitor01, 02, 03, 07, 08); the report then shows the projects of THAT
// organization only. A user of one organization is not scoped: nothing is cut and no extra read is made.
//   * scoped        the user has 2+ active memberships (organization_my_memberships) and an active organization
//   * projectGUIDs  the projects of the active organization the user can read (project_table.rowParentGUID = the organization; RLS decides what he reads); null = not scoped
//                   While they are being read the set is EMPTY (the report shows nothing instead of flashing the data of the other organization); a failed read = null (nothing is cut)
//   * filter(rows, projectOf)  the rows of the scoped projects; the SAME array when not scoped
// The cut is made on the client for the reports whose SQL is not organization aware (01, 02, 03, 08); Monitor07's SQL (partner_balance_report) already reads the active organization, so it
// only needs the filter in its bar and a re-read on a switch (`organizationGUID` goes into its deps).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { readAllPages } from '../../crud/api/apiUtils';
import { showOrganizationFilter } from '../../../catalog/organization/switch/organizationSwitchModel';
import { useOrganizationMemberships } from '../../../catalog/organization/switch/useOrganizationMemberships';

const EMPTY: ReadonlySet<string> = new Set<string>();

/** the rows of the given projects; `projects` null = no cut (the same array comes back) */
export function cutToProjects<T>(rows: readonly T[], projectOf: (row: T) => string | null | undefined, projects: ReadonlySet<string> | null): T[] {
  if (!projects) return rows as T[];
  return rows.filter((r) => {
    const p = projectOf(r);
    return !!p && projects.has(p);
  });
}

export interface ReportOrganizationScope {
  scoped: boolean;
  /** the projects of the active organization are known (always true when not scoped): a report waits for it before it resets a choice that is not in the organization */
  ready: boolean;
  organizationGUID: string;
  projectGUIDs: ReadonlySet<string> | null;
  keep: (projectGUID: string | null | undefined) => boolean;
  filter: <T>(rows: readonly T[], projectOf: (row: T) => string | null | undefined) => T[];
  reload: () => void;
}

function useClient(): any {
  try {
    return useSupabase().supabase;
  } catch {
    return null;
  }
}

/** `enabled` false = never scoped (Monitor01 inside ONE project: no project of another organization is in it, nothing is read) */
export function useReportOrganizationScope(enabled: boolean = true): ReportOrganizationScope {
  const client = useClient();
  const { memberships, loaded, active } = useOrganizationMemberships();
  const scoped = enabled && loaded && !!active && showOrganizationFilter(memberships);
  // the answer is for ONE organization: after a switch the old set is not used for the new one
  const [read, setRead] = useState<{ organization: string; projects: ReadonlySet<string> | null } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!scoped || !client || typeof client.from !== 'function') return undefined;
    let alive = true;
    (async () => {
      try {
        const rows = await readAllPages<{ rowGUID: string }>((from, to) =>
          client.from('project_table').select('rowGUID').eq('rowParentGUID', active).order('rowGUID', { ascending: true }).range(from, to),
        );
        if (alive) setRead({ organization: active, projects: new Set(rows.map((r) => String(r.rowGUID))) });
      } catch {
        if (alive) setRead({ organization: active, projects: null }); // no answer: nothing is cut (the database still decides what the user reads)
      }
    })();
    return () => {
      alive = false;
    };
  }, [scoped, client, active, nonce]);

  const projectGUIDs: ReadonlySet<string> | null = !scoped ? null : read && read.organization === active ? read.projects : EMPTY;
  const ready = !scoped || (!!read && read.organization === active);
  const keep = useCallback((p: string | null | undefined) => !projectGUIDs || (!!p && projectGUIDs.has(p)), [projectGUIDs]);
  const filter = useCallback(<T,>(rows: readonly T[], projectOf: (row: T) => string | null | undefined) => cutToProjects(rows, projectOf, projectGUIDs), [projectGUIDs]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return useMemo(() => ({ scoped, ready, organizationGUID: active, projectGUIDs, keep, filter, reload }), [scoped, ready, active, projectGUIDs, keep, filter, reload]);
}
