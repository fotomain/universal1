// useAssistantEnvironment - everything the assistant needs from the rest of the app, in one place (so the screens and the tests stay simple):
// the user, the projects of his organization (count + names: "no project yet" opens the currencies step), the defaults / currencies of the organization.
import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { usePMOwnerGUID } from '../../../../pm/crud/queries';
import { useReadProjectsQuery } from '../../../../pm/crud/project/projectQueries';
import { projectsOfOrganization } from '../../../../catalog/organization/switch/organizationSwitchModel';
import { useActiveOrganizationGUID } from '../../../../catalog/organization/switch/useActiveOrganizationGUID';
import { useMyOrganization } from '../../../../catalog/organization/useMyOrganization';
import { defaultProjectSettingsOf, type DefaultProjectSettings } from '../../../../catalog/organization/defaultProjectSettings';
import { consolidationSettingsOf } from '../../../../catalog/organization/consolidation/consolidationModel';
import { usePMStore } from '../../../../pm/store/store_pm';
import { normalizeCurrency } from '../model/assistantModel';

export interface AssistantEnvironment {
  /** the key of the saved run on this device (the user) */
  userKey: string;
  ownerGUID: string;
  /** null until the projects are read */
  projectCount: number | null;
  existingNames: string[];
  /** defaultProjectSettings of the organization (null while never saved / not read yet) */
  organizationDefaults: Record<string, any> | null;
  organizationLoaded: boolean;
  /** the currencies of the organization ('' = not set) */
  organizationCurrencies: { currencyForBudget: string; currencyForAccounting: string; currencyForContract: string };
  /** currencyForConsolidation of the organization ('' = not read yet / not set): shown read only */
  consolidationCurrency: string;
  /** the rowJSON of a project of the store (the assistant called for an existing project) */
  projectJSONOf: (guid: string) => Record<string, any> | null;
  /** target 'organization': saves the answers as the default project settings of the active organization (what the user answered over what is stored); the administrator only */
  saveOrganizationDefaults?: (patch: Record<string, any>) => Promise<{ ok: boolean; error?: string }>;
}

export function useAssistantEnvironment(): AssistantEnvironment {
  const userKey: string = useSelector((s: any) => s?.activeUserState?.userGUID || '') || 'guest';
  const ownerGUID = usePMOwnerGUID();
  const organizationGUID = useActiveOrganizationGUID();
  const projectsQuery = useReadProjectsQuery(ownerGUID);
  const organization = useMyOrganization();

  const projects = useMemo(() => (projectsQuery.data ? projectsOfOrganization(projectsQuery.data, organizationGUID) : null), [projectsQuery.data, organizationGUID]);
  const projectCount = projects ? projects.length : null;
  const existingNames = useMemo(() => (projects || []).map((p) => String(p.rowJSON?.name || '')).filter(Boolean), [projects]);

  const defaults = organization.defaults ? defaultProjectSettingsOf(organization.defaults) : null;
  const organizationCurrencies = {
    currencyForBudget: normalizeCurrency(defaults?.currencyForBudget),
    currencyForAccounting: normalizeCurrency(defaults?.currencyForAccounting),
    currencyForContract: normalizeCurrency(defaults?.currencyForContract),
  };

  const consolidationCurrency = consolidationSettingsOf(organization.organizationJSON).currency;
  const projectJSONOf = useCallback((guid: string) => (usePMStore.getState().projectsById[guid]?.rowJSON as Record<string, any> | undefined) ?? null, []);

  const { saveDefaultProjectSettings, defaults: storedDefaults } = organization;
  const saveOrganizationDefaults = useCallback(
    async (patch: Record<string, any>) => {
      // a key the assistant does not ask keeps its stored value; the name and the dates of the patch are no settings and are dropped by defaultProjectSettingsOf
      const saved = await saveDefaultProjectSettings(defaultProjectSettingsOf({ ...(storedDefaults || {}), ...patch } as DefaultProjectSettings));
      return saved.ok ? { ok: true } : { ok: false, error: saved.error };
    },
    [saveDefaultProjectSettings, storedDefaults],
  );

  return {
    userKey,
    ownerGUID,
    projectCount,
    existingNames,
    organizationDefaults: defaults as Record<string, any> | null,
    organizationLoaded: organization.loaded,
    organizationCurrencies,
    consolidationCurrency,
    projectJSONOf,
    saveOrganizationDefaults,
  };
}
