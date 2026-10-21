// The data hooks of the time sheet (React Query; the writes are RPCs, every write refetches what it changed):
//   useTimesheetList           the list (timesheet_list)
//   useTimesheetDocument       ONE sheet: header + lines + entered hours, and the commands (set header / line / hours, add / delete line, post, unpost, delete)
//   useTimesheetOptions        the selects: projects, the tasks of a project, the roles / budget items / business units a task offers a work center, the work centers the user may pick, the switches
//   useMyWorkCenter            the work center of the user's Person and "Create work center"
//   useCreateTimesheetFromTask "Create based on → Time sheet" (a new browser tab on the web)
//   useOpenTimesheet           open a sheet from anywhere its GUID is known
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '../../providers/WithSupabase';
import {
  TimesheetLinePatch, addTimesheetLine, insertTimesheetLine, moveTimesheetLine, createMyWorkCenter, createTimesheet, createTimesheetFromTask, deleteTimesheet, deleteTimesheetLine, fetchMyWorkCenter, fetchPossibleBudgetItems, fetchPossibleBusinessUnits, fetchPossibleRoles,
  fetchProjectTasks, fetchRowsByGuid, fetchSelectableWorkCenters, fetchTimesheetEntered, fetchTimesheetHeader, fetchTimesheetLines, fetchTimesheetList, fetchTimesheetProjects, fetchTimesheetSwitches, postTimesheet, setTimesheetHeader,
  setTimesheetHours, setTimesheetLine, unpostTimesheet,
} from './timesheetApi';
import { EMPTY_TIMESHEET_FILTER, MyWorkCenterAnswer, TimesheetMove, TIMESHEET_ROUTE, TimesheetCreateAnswer, TimesheetEntered, TimesheetHeader, TimesheetLine, TimesheetListFilter, TimesheetListRow, TimesheetPostAnswer, rowTitleOf, timesheetRouteParams } from './timesheetModel';
import { openBlankWindow, sendWindowTo, showCreatedTimesheet, timesheetLink } from './timesheetNavigation';

export const timesheetListKey = (filter: TimesheetListFilter, extra: Record<string, any>) => ['pm', 'timesheetList', filter, extra] as const;
export const timesheetDocumentKey = (guid: string) => ['pm', 'timesheetDocument', guid] as const;
const EMPTY_LIST: TimesheetListRow[] = [];

/** the sheets of my organization for the filters (the database applies them) */
export function useTimesheetList(filter: TimesheetListFilter = EMPTY_TIMESHEET_FILTER, extra: Record<string, any> = {}) {
  const { supabase } = useSupabase();
  const q = useQuery({
    queryKey: timesheetListKey(filter, extra),
    staleTime: 3_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: () => fetchTimesheetList(supabase, filter, extra),
  });
  return { rows: q.data ?? EMPTY_LIST, isLoading: q.isLoading, error: (q.error as Error | null)?.message ?? null, refetch: () => { void q.refetch(); } };
}

export interface UseTimesheetDocument {
  header: TimesheetHeader | null;
  lines: TimesheetLine[];
  entered: TimesheetEntered[];
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  setHeader: (patch: { timesheetWorkCenter?: string | null; startDate?: string; finishDate?: string }) => Promise<boolean>;
  addLine: (patch?: TimesheetLinePatch) => Promise<string | null>;
  /** a line above / below another (the context menu of a line) */
  insertLine: (refLineGUID: string, before: boolean, patch?: TimesheetLinePatch) => Promise<string | null>;
  moveLine: (lineGUID: string, where: TimesheetMove) => Promise<boolean>;
  setLine: (lineGUID: string, patch: TimesheetLinePatch) => Promise<boolean>;
  deleteLine: (lineGUID: string) => Promise<boolean>;
  setHours: (lineGUID: string, day: string, hours: number | null) => Promise<boolean>;
  post: () => Promise<TimesheetPostAnswer | null>;
  unpost: () => Promise<TimesheetPostAnswer | null>;
  remove: () => Promise<boolean>;
  clearError: () => void;
  refetch: () => void;
}

/** ONE sheet with its lines and its entered hours, and the commands */
export function useTimesheetDocument(guid: string): UseTimesheetDocument {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const q = useQuery({
    queryKey: timesheetDocumentKey(guid),
    enabled: !!guid,
    staleTime: 2_000,
    refetchOnMount: 'always',
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const header = await fetchTimesheetHeader(supabase, guid);
      if (!header) return { header: null, lines: [] as TimesheetLine[], entered: [] as TimesheetEntered[] };
      const [lines, entered] = await Promise.all([fetchTimesheetLines(supabase, guid), fetchTimesheetEntered(supabase, guid)]);
      return { header, lines, entered };
    },
  });
  const refetch = useCallback(() => {
    void qc.invalidateQueries({ queryKey: timesheetDocumentKey(guid) });
    void qc.invalidateQueries({ queryKey: ['pm', 'timesheetList'] });
  }, [qc, guid]);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setActionError(null);
    try {
      const out = await fn();
      refetch();
      return out;
    } catch (e: any) {
      setActionError(e?.message || String(e));
      // a refused write may have changed nothing, but the screen shows the truth of the database again
      refetch();
      return null;
    } finally {
      setBusy(false);
    }
  }, [refetch]);
  return {
    header: q.data?.header ?? null,
    lines: q.data?.lines ?? [],
    entered: q.data?.entered ?? [],
    isLoading: q.isLoading,
    error: actionError ?? ((q.error as Error | null)?.message || null),
    busy,
    setHeader: async (patch) => (await run(async () => { await setTimesheetHeader(supabase, guid, patch); return true; })) === true,
    addLine: (patch) => run(() => addTimesheetLine(supabase, guid, patch ?? {})),
    insertLine: (ref, before, patch) => run(() => insertTimesheetLine(supabase, guid, ref, before, patch ?? {})),
    moveLine: async (lineGUID, where) => (await run(async () => { await moveTimesheetLine(supabase, lineGUID, where); return true; })) === true,
    setLine: async (lineGUID, patch) => (await run(async () => { await setTimesheetLine(supabase, lineGUID, patch); return true; })) === true,
    deleteLine: async (lineGUID) => (await run(async () => { await deleteTimesheetLine(supabase, lineGUID); return true; })) === true,
    setHours: async (lineGUID, day, hours) => (await run(async () => { await setTimesheetHours(supabase, lineGUID, day, hours); return true; })) === true,
    post: () => run(() => postTimesheet(supabase, guid)),
    unpost: () => run(() => unpostTimesheet(supabase, guid)),
    remove: async () => (await run(async () => { await deleteTimesheet(supabase, guid); return true; })) === true,
    clearError: () => setActionError(null),
    refetch,
  };
}

export interface SelectOption { value: string; label: string }
const sortByLabel = (a: SelectOption, b: SelectOption) => a.label.localeCompare(b.label);

/** the selects of the lines table; every list is read once and cached */
export function useTimesheetOptions(workCenter: string, enabled = true) {
  const { supabase } = useSupabase();
  const switches = useQuery({ queryKey: ['pm', 'timesheetSwitches'], enabled, staleTime: 30_000, queryFn: () => fetchTimesheetSwitches(supabase) });
  const all = switches.data?.allWorkCenters ?? false;
  const workCenters = useQuery({
    queryKey: ['pm', 'timesheetWorkCenters', all], enabled: enabled && !!switches.data, staleTime: 15_000,
    queryFn: async () => (await fetchSelectableWorkCenters(supabase, all)).map((r) => ({ value: r.rowGUID, label: rowTitleOf(r) })).sort(sortByLabel),
  });
  const projects = useQuery({
    queryKey: ['pm', 'timesheetProjects'], enabled, staleTime: 30_000,
    queryFn: async () => (await fetchTimesheetProjects(supabase)).map((r) => ({ value: r.rowGUID, label: rowTitleOf(r) })).sort(sortByLabel),
  });
  /** the normal tasks of one project (cached per project) */
  const tasksOf = useCallback(async (projectGUID: string): Promise<SelectOption[]> => {
    if (!projectGUID) return [];
    return (await fetchProjectTasks(supabase, projectGUID)).map((r) => ({ value: r.rowGUID, label: rowTitleOf(r) }));
  }, [supabase]);
  const titled = useCallback(async (table: string, ids: string[]): Promise<SelectOption[]> => (await fetchRowsByGuid(supabase, table, ids)).map((r) => ({ value: r.rowGUID, label: rowTitleOf(r) })).sort(sortByLabel), [supabase]);
  const rolesOf = useCallback(async (taskGUID: string): Promise<SelectOption[]> => (taskGUID && workCenter ? titled('resourceRoleTable', await fetchPossibleRoles(supabase, taskGUID, workCenter)) : []), [supabase, workCenter, titled]);
  const budgetItemsOf = useCallback(async (taskGUID: string, role: string): Promise<SelectOption[]> => (taskGUID && role ? titled('budgetItemTable', await fetchPossibleBudgetItems(supabase, taskGUID, role)) : []), [supabase, titled]);
  const businessUnitsOf = useCallback(async (taskGUID: string): Promise<SelectOption[]> => (taskGUID && workCenter ? titled('businessUnitTable', await fetchPossibleBusinessUnits(supabase, taskGUID, workCenter)) : []), [supabase, workCenter, titled]);
  /** a title for any id of these tables (a cell shows the title of a value that is not in the loaded list) */
  const titleOf = useCallback(async (table: string, id: string): Promise<string> => (id ? (await titled(table, [id]))[0]?.label ?? id : ''), [titled]);
  return {
    switches: switches.data ?? { allWorkCenters: false, onlyCurrentMonth: true },
    workCenters: workCenters.data ?? [],
    projects: projects.data ?? [],
    tasksOf, rolesOf, budgetItemsOf, businessUnitsOf, titleOf,
    isLoading: switches.isLoading || workCenters.isLoading || projects.isLoading,
  };
}

/** the work center of the user's Person and the button "Create work center" */
export function useMyWorkCenter(enabled = true) {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pm', 'timesheetMyWorkCenter'], enabled, staleTime: 10_000, queryFn: () => fetchMyWorkCenter(supabase) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** the business units to choose from while the database cannot tell which one the new work center belongs to (answer needsBusinessUnit); null = no question */
  const [unitChoices, setUnitChoices] = useState<SelectOption[] | null>(null);
  const create = useCallback(async (businessUnit?: string | null): Promise<MyWorkCenterAnswer | null> => {
    setBusy(true);
    setError(null);
    try {
      const a = await createMyWorkCenter(supabase, businessUnit);
      if (a.status === 'needsBusinessUnit') {
        const { data, error: e } = await supabase.from('businessUnitTable').select('rowGUID,rowJSON').order('orderInList', { ascending: true }).limit(500);
        if (e) throw new Error(e.message);
        setUnitChoices((data || []).map((r: any) => ({ value: r.rowGUID, label: rowTitleOf(r) })));
      } else {
        setUnitChoices(null);
      }
      await qc.invalidateQueries({ queryKey: ['pm', 'timesheetMyWorkCenter'] });
      await qc.invalidateQueries({ queryKey: ['pm', 'timesheetWorkCenters'] });
      return a;
    } catch (e: any) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [supabase, qc]);
  return { workCenter: q.data ?? '', isLoading: q.isLoading, create, busy, error, unitChoices, closeUnitChoices: () => setUnitChoices(null) };
}

/** a new, empty draft (work center = mine, period = the current month) */
export function useNewTimesheet() {
  const { supabase } = useSupabase();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const make = useCallback(async (): Promise<string | null> => {
    setBusy(true);
    setError(null);
    try {
      const guid = await createTimesheet(supabase);
      await qc.invalidateQueries({ queryKey: ['pm', 'timesheetList'] });
      return guid;
    } catch (e: any) {
      setError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [supabase, qc]);
  return { make, busy, error };
}

/** Open a sheet from ANYWHERE its GUID is known; on the web in a NEW browser tab (this window when blocked / on a phone). */
export function useOpenTimesheet(): (params: { documentGUID: string }) => void {
  const router = useRouter();
  return useCallback((params) => {
    if (!params?.documentGUID) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { if (window.open(timesheetLink(TIMESHEET_ROUTE, timesheetRouteParams(params.documentGUID)), '_blank')) return; } catch { /* this window below */ }
    }
    router.push({ pathname: TIMESHEET_ROUTE, params: timesheetRouteParams(params.documentGUID) } as any);
  }, [router]);
}

/** "Create based on this → Time sheet": ALWAYS a new draft; it opens in a new browser tab (the tab is opened inside the click) */
export function useCreateTimesheetFromTask() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCallback(async (taskGUID: string, taskLineGUID?: string | null): Promise<TimesheetCreateAnswer | null> => {
    if (!taskGUID) return null;
    const target = openBlankWindow();
    setBusy(true);
    setError(null);
    try {
      const answer = await createTimesheetFromTask(supabase, taskGUID, taskLineGUID);
      void qc.invalidateQueries({ queryKey: ['pm', 'timesheetList'] });
      if (answer.status === 'created' && answer.documentGUID) showCreatedTimesheet(router, answer.documentGUID, { newWindow: true, target, sendWindowTo });
      else if (target) { try { target.close(); } catch { /* nothing to close */ } }
      return answer;
    } catch (e: any) {
      if (target) { try { target.close(); } catch { /* nothing to close */ } }
      setError(e?.message || String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [supabase, router, qc]);
  return { create, busy, error, clearError: () => setError(null) };
}

