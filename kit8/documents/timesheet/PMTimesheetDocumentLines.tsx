// PMTimesheetDocumentLines - the LINES of a time sheet in the form (documentation/TIME_SHEET_WBS.html section 5).
//   one line  Project → Task → Role → Budget item → Business unit → (the cost of one hour) → ONE COLUMN FOR EVERY DAY of the period (both dates included) → Total
//   input order  each select is enabled after the one before it (lineEnabled): the task after the project, the role after the task (all the roles of the task's Time lines that fit the work center, else all
//                the roles of the kind), the budget item after the role, the business unit only when the task has task lines that book the work center; the hour cells after the role.
//   hour cells   EMPTY at the start; a number above 0 up to 24 is saved as a row of project_timesheet_lines_data_entered (timesheet_set_hours), empty / 0 removes the row; the hours of a day over the lines of
//                the sheet are at most 24 (the cell is refused with a message). Weekends are shaded. Only entered hours are posted.
//   footer       the hours of every day and the grand total.
// Not a ReusableTable: its rows are redux entities written by the generic saga, here every write is an RPC and the day columns are made from the dates. One horizontal scroll for the whole table.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import ButtonApp from '../../ui/components/common/ButtonApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import PMNumberInputApp from '../../pm/components/PMNumberInputApp';
import PMContextMenu from '../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../pm/inner/menu/PMMenuItem';
import { pmT } from '../../pm/i18n/pmT';
import {
  TIMESHEET_ENTERED_TABLE, TIMESHEET_MAX_HOURS_A_DAY, TimesheetEntered, TimesheetMove, TimesheetHeader, TimesheetLine, cellKey, dayColumnTitle, daysBetween, enteredMap, hoursOfDay, hoursOfLine, hoursOfSheet, hourCostText, isWeekend, lineEnabled, lineMenuAvailability,
  timesheetHoursProblem, timesheetHoursProblemText,
} from './timesheetModel';
import type { SelectOption, useTimesheetOptions } from './useTimesheet';
import type { TimesheetLinePatch } from './timesheetApi';

export interface PMTimesheetDocumentLinesProps {
  /** the open sheet; null = none (the loading / "not found" text) */
  header: TimesheetHeader | null;
  lines: TimesheetLine[];
  entered: TimesheetEntered[];
  options: ReturnType<typeof useTimesheetOptions>;
  /** the sheet is a draft: the selects and the hour cells can be used */
  edit: boolean;
  loading?: boolean;
  onAddLine: () => void;
  onSetLine: (lineGUID: string, patch: TimesheetLinePatch) => void | Promise<unknown>;
  onDeleteLine: (lineGUID: string) => void;
  /** the context menu of a line: a line above / below another (patch = what the new line starts with), and the moves */
  onInsertLine?: (refLineGUID: string, before: boolean, patch?: TimesheetLinePatch) => void | Promise<unknown>;
  onMoveLine?: (lineGUID: string, where: TimesheetMove) => void | Promise<unknown>;
  onSetHours: (lineGUID: string, day: string, hours: number | null) => void | Promise<unknown>;
  testID?: string;
}

const ROW_H = 44;
const W = { n: 34, project: 180, task: 200, role: 170, budget: 160, unit: 150, rate: 112, day: 66, total: 74, action: 40 } as const;
const FIELD_H = 36;

/** the selects of ONE line: each loads its options when the one before it is chosen */
function LineSelects({ line, header, edit, options, onSetLine, testID, setUnitsCount }: {
  line: TimesheetLine; header: TimesheetHeader; edit: boolean; options: PMTimesheetDocumentLinesProps['options']; onSetLine: PMTimesheetDocumentLinesProps['onSetLine']; testID: string;
  setUnitsCount: (n: number) => void;
}) {
  const [tasks, setTasks] = useState<SelectOption[]>([]);
  const [roles, setRoles] = useState<SelectOption[]>([]);
  const [items, setItems] = useState<SelectOption[]>([]);
  const [units, setUnits] = useState<SelectOption[]>([]);
  /** a list is READY once its options came (a value is looked up by title only when its list is ready and does not hold it) */
  const [ready, setReady] = useState({ role: false, item: false, unit: false });
  const wc = header.workCenter;
  useEffect(() => { let alive = true; void options.tasksOf(line.project).then((o) => { if (alive) setTasks(o); }).catch(() => { if (alive) setTasks([]); }); return () => { alive = false; }; }, [line.project]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let alive = true; setReady((r) => ({ ...r, role: false })); void options.rolesOf(line.task).then((o) => { if (alive) { setRoles(o); setReady((r) => ({ ...r, role: true })); } }).catch(() => { if (alive) { setRoles([]); setReady((r) => ({ ...r, role: true })); } }); return () => { alive = false; }; }, [line.task, wc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let alive = true; setReady((r) => ({ ...r, item: false })); void options.budgetItemsOf(line.task, line.role).then((o) => { if (alive) { setItems(o); setReady((r) => ({ ...r, item: true })); } }).catch(() => { if (alive) { setItems([]); setReady((r) => ({ ...r, item: true })); } }); return () => { alive = false; }; }, [line.task, line.role]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { let alive = true; setReady((r) => ({ ...r, unit: false })); void options.businessUnitsOf(line.task).then((o) => { if (alive) { setUnits(o); setUnitsCount(o.length); setReady((r) => ({ ...r, unit: true })); } }).catch(() => { if (alive) { setUnits([]); setUnitsCount(0); setReady((r) => ({ ...r, unit: true })); } }); return () => { alive = false; }; }, [line.task, wc]); // eslint-disable-line react-hooks/exhaustive-deps
  // a value that came from the Time line this sheet line was made from may not be in the lists above (the role is not "possible" for the work center, the work center is not chosen yet): it is shown with its title
  const [extra, setExtra] = useState<Record<string, string>>({});
  const missing = (list: SelectOption[], id: string, table: string): { id: string; table: string } | null => (id && !list.some((o) => o.value === id) && extra[id] === undefined ? { id, table } : null);
  const needRole = ready.role ? missing(roles, line.role, 'resourceRoleTable') : null;
  const needItem = ready.item ? missing(items, line.budgetItem, 'budgetItemTable') : null;
  const needUnit = ready.unit ? missing(units, line.businessUnit, 'businessUnitTable') : null;
  useEffect(() => {
    let alive = true;
    for (const n of [needRole, needItem, needUnit]) {
      if (n) void options.titleOf(n.table, n.id).then((t: string) => { if (alive) setExtra((m) => ({ ...m, [n.id]: t })); }).catch(() => undefined);
    }
    return () => { alive = false; };
  }, [needRole?.id, needItem?.id, needUnit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const withCurrent = (list: SelectOption[], id: string): SelectOption[] => (id && !list.some((o) => o.value === id) ? [{ value: id, label: extra[id] ?? id }, ...list] : list);
  const on = lineEnabled(line, header, units.length);
  const pick = (key: keyof TimesheetLinePatch) => (v: string) => { void onSetLine(line.rowGUID, { [key]: v || null } as TimesheetLinePatch); };
  const field = (id: string, w: number, list: SelectOption[], value: string, enabled: boolean, key: keyof TimesheetLinePatch, placeholder: string) => (
    <View style={[styles.cell, { width: w }]}>
      <SelectItemFromListApp
        testID={`${testID}-${id}`} items={list} value={value} onSelect={pick(key)} placeholder={placeholder} searchPlaceholder={placeholder} disabled={!edit || !enabled}
        clearable searchable fieldHeight={FIELD_H} fieldRadius={4}
      />
    </View>
  );
  return (
    <>
      {field('project', W.project, options.projects, line.project, on.project, 'timesheetLineProject', pmT('Project'))}
      {field('task', W.task, tasks, line.task, on.task, 'timesheetLineTask', pmT('Task'))}
      {field('role', W.role, withCurrent(roles, line.role), line.role, on.role, 'timesheetLineRole', pmT('Role'))}
      {field('budgetItem', W.budget, withCurrent(items, line.budgetItem), line.budgetItem, on.budgetItem, 'timesheetLineBudgetItem', pmT('Budget item'))}
      {field('businessUnit', W.unit, withCurrent(units, line.businessUnit), line.businessUnit, on.businessUnit, 'timesheetLineBusinessUnit', pmT('Business unit'))}
    </>
  );
}

export default function PMTimesheetDocumentLines({ header, lines, entered, options, edit, loading, onAddLine, onSetLine, onDeleteLine, onInsertLine, onMoveLine, onSetHours, testID = 'timesheet' }: PMTimesheetDocumentLinesProps) {
  const { themeColors: c } = useDesignSystem();
  const [cellError, setCellError] = useState('');
  const [unitCounts, setUnitCounts] = useState<Record<string, number>>({});
  const [menu, setMenu] = useState<{ guid: string; x: number; y: number } | null>(null);
  const days = useMemo(() => (header ? daysBetween(header.startDate, header.finishDate) : []), [header?.startDate, header?.finishDate]); // eslint-disable-line react-hooks/exhaustive-deps
  const cells = useMemo(() => enteredMap(entered), [entered]);
  useEffect(() => setCellError(''), [header?.rowGUID]);

  if (!header) {
    return <Text testID={`${testID}-lines-empty`} style={{ color: c.text, padding: 12 }}>{loading ? pmT('Loading…') : pmT('The time sheet was not found.')}</Text>;
  }
  const shade = `${c.text}0d`;
  const tableWidth = W.n + W.project + W.task + W.role + W.budget + W.unit + W.rate + days.length * W.day + W.total + W.action;

  const commit = (line: TimesheetLine, day: string, hours: number | null) => {
    const problem = timesheetHoursProblem(entered, line.rowGUID, day, hours, header);
    if (problem) { setCellError(pmT(timesheetHoursProblemText(problem))); return; }
    setCellError('');
    void onSetHours(line.rowGUID, day, hours);
  };

  /** the context menu of a line (right click on the web, long press on a phone, the ⋮ button): add above / below, duplicate, moves, copy the GUID, delete */
  const menuItems = (guid: string): PMMenuItemProps[] => {
    const index = lines.findIndex((l) => l.rowGUID === guid);
    const ln = lines[index];
    if (!ln) return [];
    const a = lineMenuAvailability({ canEdit: edit, index, count: lines.length });
    const id = (k: string) => `${testID}-line-menu-${k}`;
    const run = (fn: () => unknown) => () => { setMenu(null); void fn(); };
    return [
      ...(a.add ? [
        { testID: id('add-below'), label: 'Add line below', icon: 'add_row_below', onPress: run(() => onInsertLine?.(guid, false)) },
        { testID: id('add-above'), label: 'Add line above', icon: 'add_row_above', onPress: run(() => onInsertLine?.(guid, true)) },
      ] : []),
      // a second line with the same role / budget item / business unit would break the unique key of a sheet: the copy starts with the project and the task
      ...(a.duplicate ? [{ testID: id('duplicate'), label: 'Duplicate (project and task)', icon: 'control_point_duplicate', disabled: !ln.project, onPress: run(() => onInsertLine?.(guid, false, { timesheetLineProject: ln.project || null, timesheetLineTask: ln.task || null })) }] : []),
      ...(edit ? [
        { testID: id('move-up'), label: 'Move up', icon: 'arrow_upward', disabled: !a.moveUp, onPress: run(() => onMoveLine?.(guid, 'up')) },
        { testID: id('move-down'), label: 'Move down', icon: 'arrow_downward', disabled: !a.moveDown, onPress: run(() => onMoveLine?.(guid, 'down')) },
        { testID: id('make-first'), label: 'Make first', icon: 'vertical_align_top', disabled: !a.moveUp, onPress: run(() => onMoveLine?.(guid, 'first')) },
        { testID: id('make-last'), label: 'Make last', icon: 'vertical_align_bottom', disabled: !a.moveDown, onPress: run(() => onMoveLine?.(guid, 'last')) },
      ] : []),
      { testID: id('copy-guid'), label: 'Copy GUID', icon: 'fingerprint', onPress: run(() => { Clipboard.setStringAsync(guid).catch(() => {}); }) },
      ...(a.delete ? [{ testID: id('delete'), label: 'Delete', icon: 'delete', danger: true, onPress: run(() => onDeleteLine(guid)) }] : []),
    ];
  };

  return (
    <View testID={`${testID}-lines`} style={styles.root}>
      <View style={styles.bar}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{pmT('Lines')} · {lines.length}</Text>
        <Text style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{days.length} {pmT('days')} · {hoursOfSheet(entered)} {pmT('hours')}</Text>
        <View style={{ flex: 1 }} />
        {edit && <ButtonApp testID={`${testID}-add-line`} title={pmT('Add line')} icon="add" variant="outlined" size="small" onPress={onAddLine} />}
      </View>
      {!!cellError && <Text testID={`${testID}-cell-error`} style={{ color: c.error, paddingHorizontal: 12, paddingBottom: 4, fontSize: 12 }}>{cellError}</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }} testID={`${testID}-scroll`}>
        <ScrollView style={{ width: tableWidth }} contentContainerStyle={{ width: tableWidth }} nestedScrollEnabled>
          {/* the header row */}
          <View style={[styles.row, { backgroundColor: `${c.text}10`, borderBottomColor: c.border }]} testID={`${testID}-header-row`}>
            <View style={[styles.cell, { width: W.n }]}><Text style={styles.head}>#</Text></View>
            {[[W.project, 'Project'], [W.task, 'Task'], [W.role, 'Role'], [W.budget, 'Budget item'], [W.unit, 'Business unit'], [W.rate, 'Hour cost']].map(([w, t]) => (
              <View key={String(t)} style={[styles.cell, { width: w as number }]}><Text numberOfLines={1} style={[styles.head, { color: c.text }]}>{pmT(String(t))}</Text></View>
            ))}
            {days.map((d) => (
              <View key={d} testID={`${testID}-day-${d}`} style={[styles.cell, { width: W.day, backgroundColor: isWeekend(d) ? shade : undefined }]}>
                <Text numberOfLines={1} style={[styles.head, { color: c.text, textAlign: 'center' }]}>{dayColumnTitle(d)}</Text>
              </View>
            ))}
            <View style={[styles.cell, { width: W.total }]}><Text style={[styles.head, { color: c.text, textAlign: 'right' }]}>{pmT('Total')}</Text></View>
            <View style={{ width: W.action }} />
          </View>

          {lines.length === 0 && (
            <Text testID={`${testID}-no-lines`} style={{ color: c.text, opacity: 0.7, padding: 12 }}>{edit ? pmT('No lines yet. Add a line, choose the project, the task and the role, then type the hours.') : pmT('No lines.')}</Text>
          )}

          {lines.map((line, i) => {
            const lt = `${testID}-line-${line.rowGUID}`;
            const on = lineEnabled(line, header, unitCounts[line.rowGUID] ?? 0);
            return (
              <Pressable
                key={line.rowGUID} testID={lt} delayLongPress={350} accessible={false}
                onLongPress={(e: any) => setMenu({ guid: line.rowGUID, x: e?.nativeEvent?.pageX ?? 0, y: e?.nativeEvent?.pageY ?? 0 })}
                {...({ onContextMenu: (e: any) => { e.preventDefault?.(); setMenu({ guid: line.rowGUID, x: e.clientX ?? 0, y: e.clientY ?? 0 }); } } as any)}
                style={[styles.row, { borderBottomColor: c.border }]}
              >
                <View style={[styles.cell, { width: W.n }]}><Text style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{i + 1}</Text></View>
                <LineSelects line={line} header={header} edit={edit} options={options} onSetLine={onSetLine} testID={lt} setUnitsCount={(n) => setUnitCounts((m) => (m[line.rowGUID] === n ? m : { ...m, [line.rowGUID]: n }))} />
                <View style={[styles.cell, { width: W.rate }]}>
                  <Text testID={`${lt}-rate`} numberOfLines={1} style={{ color: hourCostText(line).missing ? c.error : c.text, fontSize: 12, textAlign: 'right' }}>
                    {hourCostText(line).missing ? pmT('no rate') : hourCostText(line).text}
                  </Text>
                </View>
                {days.map((d) => {
                  const v = cells.get(cellKey(line.rowGUID, d));
                  return (
                    <View key={d} style={[styles.cell, { width: W.day, backgroundColor: isWeekend(d) ? shade : undefined }]}>
                      <PMNumberInputApp
                        testID={`${lt}-hours-${d}`} tableName={TIMESHEET_ENTERED_TABLE} tableFieldName="timesheetHours" value={v ?? null} editable={edit && on.hours}
                        min={0} max={TIMESHEET_MAX_HOURS_A_DAY} align="center" h={FIELD_H} onCommit={(n) => commit(line, d, n)}
                      />
                    </View>
                  );
                })}
                <View style={[styles.cell, { width: W.total }]}><Text testID={`${lt}-total`} style={{ color: c.text, fontWeight: '700', fontSize: 12, textAlign: 'right' }}>{hoursOfLine(entered, line.rowGUID)}</Text></View>
                <View style={[styles.cell, { width: W.action }]}>
                  <Pressable testID={`${lt}-menu-button`} accessibilityRole="button" accessibilityLabel={pmT('Line menu')} onPress={(e: any) => setMenu({ guid: line.rowGUID, x: e?.nativeEvent?.pageX ?? e?.clientX ?? 0, y: e?.nativeEvent?.pageY ?? e?.clientY ?? 0 })} hitSlop={6}>
                    <IconApp name="more_vert" size={18} color={c.text} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })}

          {/* the footer: the hours of every day and the grand total */}
          <View style={[styles.row, { backgroundColor: `${c.text}08`, borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth }]} testID={`${testID}-footer`}>
            <View style={[styles.cell, { width: W.n + W.project + W.task + W.role + W.budget + W.unit + W.rate }]}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 12, textAlign: 'right' }}>{pmT('Hours per day')}</Text>
            </View>
            {days.map((d) => (
              <View key={d} style={[styles.cell, { width: W.day, backgroundColor: isWeekend(d) ? shade : undefined }]}>
                <Text testID={`${testID}-day-total-${d}`} style={{ color: c.text, fontSize: 12, textAlign: 'center' }}>{hoursOfDay(entered, d) || ''}</Text>
              </View>
            ))}
            <View style={[styles.cell, { width: W.total }]}><Text testID={`${testID}-grand-total`} style={{ color: c.text, fontWeight: '700', fontSize: 12, textAlign: 'right' }}>{hoursOfSheet(entered)}</Text></View>
            <View style={{ width: W.action }} />
          </View>
        </ScrollView>
      </ScrollView>
      {menu && lines.some((l) => l.rowGUID === menu.guid) && (
        <PMContextMenu testID={`${testID}-line-menu`} x={menu.x} y={menu.y} caption={`${pmT('Line')} ${lines.findIndex((l) => l.rowGUID === menu.guid) + 1}`} items={menuItems(menu.guid)} onClose={() => setMenu(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, width: '100%' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', height: ROW_H, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { height: ROW_H, justifyContent: 'center', paddingHorizontal: 3 },
  head: { fontSize: 12, fontWeight: '700' },
});
