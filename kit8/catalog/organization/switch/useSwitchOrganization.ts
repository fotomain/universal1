// Makes an organization the ACTIVE one of the signed-in user: organization_switch (SQL PART 45) + the redux userState.userOrganization. Used by the project bar filter, the Monitor
// reports and the Create Organization Assistant (after it made a new organization). Resolves to true when the switch worked.
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { setActiveUser } from '../../../redux/activeUserSlice';
import { useActiveOrganizationGUID } from './useActiveOrganizationGUID';

export function useSwitchOrganization(): (organizationGUID: string) => Promise<boolean> {
  const { supabase } = useSupabase();
  const dispatch = useDispatch();
  const active = useActiveOrganizationGUID();
  const user = useSelector((s: any) => s?.activeUserState);

  return useCallback(
    async (organizationGUID: string) => {
      if (!organizationGUID) return false;
      if (organizationGUID === active) return true;
      const { data, error } = await (supabase as any).rpc('organization_switch', { p_organization: organizationGUID });
      if (error) return false;
      dispatch(
        setActiveUser({
          activeUserGUID: user.activeUserGUID, activeUserEmail: user.activeUserEmail, activeUserFirstName: user.activeUserFirstName, activeUserLastName: user.activeUserLastName,
          userGUID: user.userGUID, userOrganization: { rowGUID: organizationGUID, title: String(data?.organizationTitle ?? '') },
        }),
      );
      return true;
    },
    [supabase, active, dispatch, user],
  );
}
