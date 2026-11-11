// OrganizationFilter - "Organization" select in the project bar for a user of two or more organizations (organization_my_memberships). Picking one calls organization_switch and makes it the
// ACTIVE organization (redux userState.userOrganization): the Project dashboard then offers the projects of that organization only. Not shown for a user of one organization.
import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { setActiveUser } from '../../../redux/activeUserSlice';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import { pmT } from '../../../pm/i18n/pmT';
import { membershipsOf, showOrganizationFilter, type OrganizationMembership } from './organizationSwitchModel';
import { useActiveOrganizationGUID } from './useActiveOrganizationGUID';

export default function OrganizationFilter({ testID = 'organization-filter' }: { testID?: string }) {
  const { supabase } = useSupabase();
  const dispatch = useDispatch();
  const active = useActiveOrganizationGUID();
  const user = useSelector((s: any) => s?.activeUserState);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);

  useEffect(() => {
    let alive = true;
    if (!active) return undefined;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('organization_my_memberships');
        if (!error && alive) setMemberships(membershipsOf(data));
      } catch {
        // the function does not exist yet (PART 45 not installed): no filter
      }
    })();
    return () => { alive = false; };
  }, [supabase, active]);

  const pick = useCallback(async (organizationGUID: string) => {
    if (organizationGUID === active) return;
    const { data, error } = await (supabase as any).rpc('organization_switch', { p_organization: organizationGUID });
    if (error) return;
    dispatch(setActiveUser({
      activeUserGUID: user.activeUserGUID, activeUserEmail: user.activeUserEmail, activeUserFirstName: user.activeUserFirstName, activeUserLastName: user.activeUserLastName,
      userGUID: user.userGUID, userOrganization: { rowGUID: organizationGUID, title: String(data?.organizationTitle ?? '') },
    }));
  }, [supabase, active, dispatch, user]);

  if (!showOrganizationFilter(memberships)) return null;
  return (
    <SelectItemFromListApp
      testID={testID}
      items={memberships.map((m) => ({ value: m.organizationGUID, label: m.organizationTitle, icon: m.isAdministrator ? 'admin_panel_settings' : undefined }))}
      value={active}
      onSelect={pick}
      trigger="link"
      lowerCaseTrigger={false}
      label={pmT('Organization')}
    />
  );
}
