// The organizations the signed-in user is an ACTIVE member of (SQL organization_my_memberships): [{ organizationGUID, organizationTitle, isAdministrator, isActive }].
// One hook for the project bar filter (OrganizationFilter), the Monitor reports (ReportOrganizationFilter / useReportOrganizationScope) and the Create Organization Assistant.
//   * `loaded` is false until the first answer; no Supabase provider / no function (PART 45 not installed) = an empty list that is loaded
//   * nothing is read while no ACTIVE organization is known (the login step is not finished); `reload()` reads again (a new organization was made)
import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '../../../providers/WithSupabase';
import { membershipsOf, type OrganizationMembership } from './organizationSwitchModel';
import { useActiveOrganizationGUID } from './useActiveOrganizationGUID';

function useClient(): any {
  try {
    return useSupabase().supabase;
  } catch {
    return null;
  }
}

export function useOrganizationMemberships(): { memberships: OrganizationMembership[]; loaded: boolean; active: string; reload: () => void } {
  const client = useClient();
  const active = useActiveOrganizationGUID();
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!active) return undefined;
    if (!client || typeof client.rpc !== 'function') {
      setLoaded(true);
      return undefined;
    }
    (async () => {
      try {
        const { data, error } = await client.rpc('organization_my_memberships');
        if (!error && alive) setMemberships(membershipsOf(data));
      } catch {
        // the function does not exist yet (PART 45 not installed): no filter
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [client, active, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { memberships, loaded, active, reload };
}
