// OrganizationFilter - "Organization" select for a user of two or more organizations (organization_my_memberships). Picking one calls organization_switch and makes it the
// ACTIVE organization (redux userState.userOrganization): the Project dashboard then offers the projects of that organization only, and every Monitor report shows its data
// (kit8/pm/reports/common/useReportOrganizationScope). Not shown for a user of one organization - and then it needs no redux / Supabase provider either (a screen or a test
// without them renders nothing): the select with the switch lives in OrganizationSelect, mounted only when there is something to choose.
import React, { useCallback } from 'react';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import { pmT } from '../../../pm/i18n/pmT';
import { showOrganizationFilter, type OrganizationMembership } from './organizationSwitchModel';
import { useOrganizationMemberships } from './useOrganizationMemberships';
import { useSwitchOrganization } from './useSwitchOrganization';

function OrganizationSelect({ memberships, active, testID }: { memberships: OrganizationMembership[]; active: string; testID: string }) {
  const switchOrganization = useSwitchOrganization();
  const pick = useCallback(async (organizationGUID: string) => {
    await switchOrganization(organizationGUID);
  }, [switchOrganization]);
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

export default function OrganizationFilter({ testID = 'organization-filter' }: { testID?: string }) {
  const { memberships, active } = useOrganizationMemberships();
  if (!showOrganizationFilter(memberships)) return null;
  return <OrganizationSelect memberships={memberships} active={active} testID={testID} />;
}
