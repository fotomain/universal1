// PMTimesheetDocumentList - the LIST of time sheets (hamburger menu → Documents → Time sheets; route /pm/timesheet/list), a ReusableTable with quick filters.
//   columns   Document · Work center · Start date · Finish date · Hours · Lines · Status
//   CRUD      Read = realtime rows (entity projectTimesheetHeader) · Open = a click on a row / the row menu (PMTimesheetDocumentForm) · Delete = the selected DRAFTS (the database refuses a posted one) ·
//             Create = the + makes a new draft of the user's work center for the current month (timesheet_create) and opens it
//   quick filters (ONE row, scrolls sideways): work center · status · period from - to - applied by the DATABASE (timesheet_list)
//   scope     "Go to → Time sheets" of a task opens this list with ?taskGUID=…: a chip "Task: …" with an x clears it (kit8/documents/taskScope)
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import IconApp from '../../ui/components/common/IconApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import DateInputApp from '../../ui/components/common/date_input/DateInputApp';
import ReusableTable from '../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../ui/components/table/reusable/reusableTableTypes';
import { pmT } from '../../pm/i18n/pmT';
import { parseDayInput } from '../fact/input/factInputModel';
import TaskScopeChip from '../taskScope/TaskScopeChip';
import { useTaskScope } from '../taskScope/useTaskScope';
import { taskScopeToRpc } from '../taskScope/taskScopeModel';
import { EMPTY_TIMESHEET_FILTER, TIMESHEET_HEADER_ENTITY, TIMESHEET_ROUTE, TimesheetListFilter, TimesheetListRow, roundHours, timesheetFilterActive } from './timesheetModel';
import { timesheetListColumns } from './timesheetListColumns';
import { useNewTimesheet, useTimesheetList, useTimesheetOptions } from './useTimesheet';

export const TIMESHEET_LIST_FILTER_DEBOUNCE_MS = 150;

export interface PMTimesheetDocumentListProps {
  testID?: string;
  /** the sheets that have a line of ONE task (route param taskGUID; menu "Go to → Time sheets"): a chip says so, its x shows all the sheets */
  taskGUID?: string | null;
}

export default function PMTimesheetDocumentList({ testID = 'timesheet-list', taskGUID }: PMTimesheetDocumentListProps) {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const options = useTimesheetOptions('', true);
  const fresh = useNewTimesheet();

  // the typed filter (draft) is applied after a pause; dates are typed, a valid one is sent
  const [draft, setDraft] = useState<TimesheetListFilter>(EMPTY_TIMESHEET_FILTER);
  const [applied, setApplied] = useState<TimesheetListFilter>(draft);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (patch: Partial<TimesheetListFilter>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setApplied({ ...next, startFrom: parseDayInput(next.startFrom) ?? '', finishTo: parseDayInput(next.finishTo) ?? '' }), TIMESHEET_LIST_FILTER_DEBOUNCE_MS);
  };
  const taskScope = useTaskScope({ taskGUID: taskGUID || '', taskLineGUID: '' });
  const list = useTimesheetList(applied, taskScopeToRpc(taskScope.scope));

  // the table shows the header rows of the redux entity (realtime) that the database listed for the filters; a cell reads its text from the list row of the same GUID
  const byGuid = useMemo(() => new Map<string, TimesheetListRow>(list.rows.map((r) => [r.documentGUID, r])), [list.rows]);
  const columns = useMemo(() => timesheetListColumns((row) => byGuid.get(row.rowGUID)), [byGuid]);
  const rowFilter = useCallback((row: { rowGUID: string }) => byGuid.has(row.rowGUID), [byGuid]);
  // a sheet made / posted / deleted elsewhere (realtime) changes the entity: the list is read again
  const entityRows: any[] | undefined = useSelector((s: any) => s?.[TIMESHEET_HEADER_ENTITY]?.entityDataFromServer);
  const signature = (entityRows ?? []).map((r) => `${r.rowGUID}:${r.updated_at ?? ''}:${r.rowJSON?.documentHeader?.documentStatus ?? ''}`).join('|');
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current !== null && seen.current !== signature) list.refetch();
    seen.current = signature;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const open = (guid: string) => router.push({ pathname: TIMESHEET_ROUTE, params: { documentGUID: guid } } as any);
  const addNew = async () => { const guid = await fresh.make(); if (guid) open(guid); };
  const statusItems = useMemo(() => [{ value: 'draft', label: pmT('Draft') }, { value: 'posted', label: pmT('Posted') }], []);
  const hoursTotal = useMemo(() => roundHours(list.rows.reduce((s, r) => s + r.hours, 0)), [list.rows]);

  return (
    <View testID={testID} style={styles.root}>
      <View style={[styles.bar, { borderBottomColor: c.border }]}>
        <IconApp name="schedule" size={20} color={c.primary} />
        <Text testID={`${testID}-title`} style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pmT('Time sheets')}</Text>
        <Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{pmT('One sheet = one work center + one period')}</Text>
        <View style={{ flex: 1 }} />
        {timesheetFilterActive(draft) && (
          <ButtonApp testID={`${testID}-clear`} title={pmT('Clear filters')} icon="filter_alt_off" variant="text" size="small" onPress={() => { setDraft(EMPTY_TIMESHEET_FILTER); setApplied(EMPTY_TIMESHEET_FILTER); }} />
        )}
        <ButtonApp testID={`${testID}-new`} title={pmT('New time sheet')} icon="add" size="small" disabled={fresh.busy} onPress={() => { void addNew(); }} />
        <ButtonApp testID={`${testID}-refresh`} title={pmT('Refresh')} icon="refresh" variant="text" size="small" onPress={list.refetch} />
      </View>

      <TaskScopeChip testID={`${testID}-scope`} scope={taskScope.scope} taskName={taskScope.taskName} onClear={taskScope.clear} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.filters} testID={`${testID}-filters`}>
        <View style={[styles.cell, { width: 260 }]}>
          <SelectItemFromListApp testID={`${testID}-workCenterFilter`} items={options.workCenters} value={draft.workCenter} onSelect={(v) => change({ workCenter: v })} placeholder={pmT('Work center')} clearable searchPlaceholder={pmT('Work center')} fieldHeight={42} fieldRadius={4} />
        </View>
        <View style={[styles.cell, { width: 150 }]}>
          <SelectItemFromListApp testID={`${testID}-statusFilter`} items={statusItems} value={draft.status} onSelect={(v) => change({ status: v })} placeholder={pmT('Status')} clearable searchPlaceholder={pmT('Status')} fieldHeight={42} fieldRadius={4} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-periodFilter-from`} label={pmT('Period from')} value={draft.startFrom} onChangeText={(t) => change({ startFrom: t })} compact error={!!draft.startFrom.trim() && !parseDayInput(draft.startFrom)} style={styles.field} />
        </View>
        <View style={[styles.cell, { width: 200 }]}>
          <DateInputApp testID={`${testID}-periodFilter-to`} label={pmT('Period to')} value={draft.finishTo} onChangeText={(t) => change({ finishTo: t })} compact error={!!draft.finishTo.trim() && !parseDayInput(draft.finishTo)} style={styles.field} />
        </View>
      </ScrollView>

      {!!fresh.error && <Text testID={`${testID}-create-error`} style={{ color: c.error, padding: 10 }}>{fresh.error}</Text>}
      {!!list.error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 10 }}>{list.error}</Text>}

      <View style={{ flex: 1 }} testID={`${testID}-table`}>
        <ReusableTable
          testID={`${testID}-lines`}
          entityName={TIMESHEET_HEADER_ENTITY}
          crudListTitle={pmT('Time sheets')}
          itemLabel="Time sheet"
          openLabel={pmT('Open time sheet')}
          listOwnerGUID={REUSABLE_TABLE_ALL}
          listParentGUID={REUSABLE_TABLE_ALL}
          readParams={{ orderBy: 'created_at', ascending: false }}
          visualColumns={columns}
          rowFilter={rowFilter}
          reorderEnabled={false}
          onAdd={() => { void addNew(); }}
          onRowOpen={(row) => { if (byGuid.has(row.rowGUID)) open(row.rowGUID); }}
          emptyText={list.isLoading ? pmT('Loading…') : timesheetFilterActive(applied) || taskScope.active ? pmT('No time sheet matches the filters.') : pmT('No time sheets yet. Press New time sheet, or open a task → Create based on this → Time sheet.')}
          uxuiTable={{ tableBarLayoutVariant: 'leftCrudPanel_rightSearch' }}
        />
      </View>

      <View testID={`${testID}-totals`} style={[styles.totals, { borderTopColor: c.border }]}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{list.rows.length} {pmT('time sheets')}</Text>
        <Text testID={`${testID}-total-hours`} style={{ color: c.text, fontSize: 12 }}>{pmT('Hours')}: {hoursTotal}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { height: 48, justifyContent: 'flex-end' },
  field: { marginBottom: 0 },
  filters: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
