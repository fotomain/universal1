// useOrganizationCurrencyRecalc - gathers what recalculateOrganizationProjects needs from redux / the Supabase provider (the catalogs of the task lines, the currencies,
// the distributions and calendars Post uses, the business unit check) and returns run(organizationGUID, currencies, onProgress). The catalogs are read when the hook is
// enabled (the organization screen of an administrator), long before the answer to the approval window is given.
import { useCallback, useEffect, useRef } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useSupabase } from '../../../providers/WithSupabase';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { CURRENCY_ENTITY, CURRENCY_READ_PARAMS } from '../../currency/currencyModel';
import { DISTRIBUTION_TABLE } from '../../distribution/distributionModel';
import { MANAGEMENT_CALENDAR_TABLE } from '../../management/calendar/managementCalendarModel';
import { PRODUCT_READ_PARAMS } from '../../product/dashboard/useProductCatalogData';
import { useTaskLineCatalogs } from '../../../pm/view/task/finances/useTaskLineCatalogs';
import { useBusinessUnitPostCheck } from '../../../pm/view/task/plan/useBusinessUnitPostCheck';
import { recalculateOrganizationProjects, recalculateSingleProject, type RecalcProgress } from './recalculateOrganizationProjects';
import type { OrganizationCurrencies, ProjectRecalcResult } from './organizationCurrenciesModel';

/** what a recalculation needs, read from redux / the Supabase provider; the run reads the LATEST values (the user answers the window long after the catalogs were read) */
function useRecalcInputs(enabled: boolean) {
  const dispatch = useDispatch();
  const { supabase } = useSupabase();
  const catalogs = useTaskLineCatalogs(enabled);
  const lineCheck = useBusinessUnitPostCheck();
  const currencyRows: any[] = useSelector((s: any) => s?.[CURRENCY_ENTITY]?.entityDataFromServer, shallowEqual) ?? [];
  const distributions: any[] = useSelector((s: any) => s?.[DISTRIBUTION_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  const calendars: any[] = useSelector((s: any) => s?.[MANAGEMENT_CALENDAR_TABLE.entity]?.entityDataFromServer, shallowEqual) ?? [];
  useEffect(() => {
    if (!enabled) return;
    const read = (entity: string, params: any) => { const a = SystemMetaData[entity]?.actions; if (a?.readData) dispatch(a.readData(params)); };
    read(CURRENCY_ENTITY, CURRENCY_READ_PARAMS);
    read(DISTRIBUTION_TABLE.entity, PRODUCT_READ_PARAMS);
    read(MANAGEMENT_CALENDAR_TABLE.entity, PRODUCT_READ_PARAMS);
  }, [enabled, dispatch]);
  const live = useRef({ supabase, catalogs, lineCheck, currencyRows, distributions, calendars });
  live.current = { supabase, catalogs, lineCheck, currencyRows, distributions, calendars };
  return live;
}

export function useOrganizationCurrencyRecalc(enabled: boolean) {
  const live = useRecalcInputs(enabled);
  return useCallback((organizationGUID: string, currencies: OrganizationCurrencies, onProgress?: (p: RecalcProgress) => void): Promise<ProjectRecalcResult[]> => {
    const L = live.current;
    return recalculateOrganizationProjects({ supabase: L.supabase, organizationGUID, currencies, catalogs: L.catalogs, currencyRows: L.currencyRows, distributions: L.distributions, calendars: L.calendars, lineCheck: L.lineCheck, onProgress });
  }, [live]);
}

/** ONE project: run(projectGUID, currencies of the project, onProgress) - after the user approved a change of the currencies of the Project settings window */
export function useProjectCurrencyRecalc(enabled: boolean) {
  const live = useRecalcInputs(enabled);
  return useCallback((projectGUID: string, currencies: OrganizationCurrencies, onProgress?: (p: RecalcProgress) => void): Promise<ProjectRecalcResult> => {
    const L = live.current;
    return recalculateSingleProject({ supabase: L.supabase, currencies, catalogs: L.catalogs, currencyRows: L.currencyRows, distributions: L.distributions, calendars: L.calendars, lineCheck: L.lineCheck, onProgress }, projectGUID);
  }, [live]);
}
