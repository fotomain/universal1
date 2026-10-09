// PMProjectTaskFinancesCRUD - the finance lines of ONE task, one table per management genus (tabs):
//   Time (a role + a person + his variant + his contract) · Material · Expenses · Revenues (a role + a product + a contract template + a partner)
// Each line is a row of task_line_table (rowOwnerGUID = the task, rowParentGUID = the genus), edited in place in a ReusableTable: add,
// duplicate, move, sql_for_delete (+ Undo), search, sort, filter, export. The money (sum = qty * price, VAT) and the defaults (unit, VAT, price from
// the role / product catalogs) are computed on every change (taskLineCompute.ts) and saved with it. When the project has an accounting / budget
// currency, the sums are also converted into them with the exchange rates, D365 style (taskLineFx.ts): a SNAPSHOT saved with the rate and its date;
// the "Recalculate" commands (row menu, bar) make it again with the rates of today's choice of day.
//
// Shown by the task page (PMProjectTaskInfo) and the Finances view of the dashboard (PMProjectFinancesView). It does not know PMCrud:
// `onEditPlace` tells the parent where the user edited (the parent saves rowJSON.lastEditPlace of the task, with its own surface) and
// `initialPlace` is the place to open at (the genus tab + the line, marked). Stages have no lines: only tasks and milestones.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import { SystemMetaData } from '../../../../redux/SystemMetaData';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import { todayISO } from '../../../../catalog/currency/exchange/currencyExchangeModel';
import { formatDateISO } from '../../project/scheduling';
import ReusableTable from '../../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../../ui/components/table/reusable/reusableTableTypes';
import type { ReusableTableRow, ReusableTableRowEditKind } from '../../../../ui/components/table/reusable/reusableTableTypes';
import { usePMStore } from '../../../store/store_pm';
import { financesPlaceOf, PMLastEditPlace } from '../../../model/lastEditPlace';
import { pmT } from '../../../i18n/pmT';
import { emptyTaskLine, TASK_LINE_ENTITY, TASK_LINE_GENUS, taskLineGenusDef, taskLineGenusOf } from './taskLineModel';
import type { TaskLineRow } from './taskLineModel';
import { formatMoney, taskLineTotals } from './taskLineMoney';
import { computeTaskLineRowJSON } from './taskLineCompute';
import { buildTaskLineColumns } from './taskLineColumns';
import { useTaskLineCatalogs } from './useTaskLineCatalogs';
import { fxEnabled, fxProjectOf, LineFxContext, recalculateLineFx } from './taskLineFx';
import { lineContractCurrency } from './taskLineCatalogs';
import { useLineRateBook } from './useLineRateBook';

export interface PMProjectTaskFinancesCRUDProps {
  projectGUID: string;
  taskGUID: string;
  /** the place to open at (task.rowJSON.lastEditPlace): the genus tab and the line to mark. Read when the component starts: give it key={taskGUID} */
  initialPlace?: PMLastEditPlace | null;
  /** the user created / changed / moved / deleted a line: remember the place (crud.recordEditPlace) */
  onEditPlace?: (place: { genus: string; lineGUID?: string }) => void;
  testID?: string;
}

const NO_LINES: TaskLineRow[] = [];

export default function PMProjectTaskFinancesCRUD({ projectGUID, taskGUID, initialPlace, onEditPlace, testID = 'task-finances' }: PMProjectTaskFinancesCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const task = usePMStore((s) => s.tasksById[taskGUID]);
  const isStage = usePMStore((s) => !!s.schedule[taskGUID]?.isSummary || (s.tree.childrenById[taskGUID]?.length ?? 0) > 0 || s.tasksById[taskGUID]?.rowJSON?.rowKind === 'stage');
  const projectCurrency = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON?.currencyForContract ?? null);
  const selectRowCheckBoxForm = usePMStore((s) => s.selectRowCheckBoxForm);
  const data = useTaskLineCatalogs(true);
  const dispatch = useDispatch();
  const projectJSON = usePMStore((s) => s.projectsById[projectGUID]?.rowJSON);
  const startMs = usePMStore((s) => s.schedule[taskGUID]?.startMs);

  const startPlace = useRef(financesPlaceOf(initialPlace)).current;
  const [genus, setGenus] = useState<string>(() => taskLineGenusOf(startPlace?.genus));
  /** the line marked in the table: the one the place says, then the one the user edited last */
  const [focusLine, setFocusLine] = useState<string | null>(() => (startPlace?.lineGUID ?? null));
  const def = taskLineGenusDef(genus) ?? TASK_LINE_GENUS[0];

  // every line of the task (all genus): the tab counts and sums. The table of the active tab reads the same rows (all-rows mode).
  const lines: TaskLineRow[] = useSelector((s: any) => s?.[TASK_LINE_ENTITY]?.entityDataFromServer, shallowEqual) ?? NO_LINES;
  const taskLines = useMemo(() => (Array.isArray(lines) ? lines.filter((l) => l.rowOwnerGUID === taskGUID) : NO_LINES), [lines, taskGUID]);
  const totals = useMemo(() => taskLineTotals(taskLines), [taskLines]);

  // ---- exchange rates: the sums in the accounting / budget currency of the project ----
  const fxProject = useMemo(() => fxProjectOf(projectJSON), [projectJSON]);
  const fxOn = fxEnabled(fxProject);
  const taskStartDay = typeof startMs === 'number' && Number.isFinite(startMs) ? formatDateISO(startMs) : null;
  const today = todayISO();
  const currencyCodes = useMemo(
    () => (fxOn ? [fxProject.accountingCurrency, fxProject.budgetCurrency, fxProject.contractCurrency, ...taskLines.map((l) => lineContractCurrency(data, l.rowJSON || {}, fxProject.contractCurrency))].filter(Boolean) as string[] : []),
    [fxOn, fxProject, taskLines, data],
  );
  const { book } = useLineRateBook(currencyCodes, fxOn);
  /** null while the rates are being read: a line is never converted with half of them (and its saved sums are left alone) */
  const fx = useMemo<LineFxContext | null>(() => (fxOn && book ? { book, project: fxProject, taskStartDay, today } : null), [fxOn, book, fxProject, taskStartDay, today]);

  const columns = useMemo(
    () => buildTaskLineColumns({ data, genus: def, projectCurrency, textColor: c.text, errorColor: c.error, fxProject: fxOn ? fxProject : null, fx }),
    [data, def, projectCurrency, c.text, c.error, fxOn, fxProject, fx],
  );
  const rowFilter = useCallback((row: ReusableTableRow) => row.rowParentGUID === def.genus, [def.genus]);
  // taskManagementGenusLine = the genus of the tab: the contract templates the line can pick depend on it
  const newRowDefaults = useMemo(() => ({ rowOwnerGUID: taskGUID, rowParentGUID: def.genus, rowJSON: { taskManagementGenusLine: def.genus } as Record<string, any> }), [taskGUID, def.genus]);
  const computeRowJSON = useCallback((json: Record<string, any>) => computeTaskLineRowJSON(data, def, json, undefined, fx), [data, def, fx]);

  /** "Recalculate": the separate algorithm - the snapshot of the rate is ignored and the rates are taken again; true = the line changed */
  const recalcRow = useCallback((row: { rowGUID: string; rowJSON?: Record<string, any> }): boolean => {
    const actions = SystemMetaData[TASK_LINE_ENTITY]?.actions;
    if (!fx || !actions?.updateOne) return false;
    const patch = recalculateLineFx(fx, data, def, row.rowJSON || {});
    if (!Object.keys(patch).length) return false;
    dispatch(actions.updateOne({ rowGUID: row.rowGUID, rowOwnerGUID: taskGUID, rowJSON: patch }));
    return true;
  }, [fx, data, def, dispatch, taskGUID]);
  const recalcAll = useCallback(() => {
    if (!fx) { dispatch(showSnackbar({ message: pmT('The exchange rates are not read yet') })); return; }
    const n = taskLines.filter((l) => l.rowParentGUID === def.genus).filter((l) => recalcRow(l)).length;
    dispatch(showSnackbar({ message: n ? pmT('{{count}} line(s) recalculated', { count: n }) : pmT('The sums are up to date') }));
  }, [fx, taskLines, def.genus, recalcRow, dispatch]);

  const onRowEdit = useCallback((rowGUID: string, kind: ReusableTableRowEditKind) => {
    if (kind === 'delete') {
      setFocusLine((cur) => (cur === rowGUID ? null : cur));
      onEditPlace?.({ genus: def.genus });
      return;
    }
    setFocusLine(rowGUID);
    onEditPlace?.({ genus: def.genus, lineGUID: rowGUID });
  }, [def.genus, onEditPlace]);

  if (!task) return null;
  if (isStage) {
    return (
      <View testID={`${testID}-stage`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="info" size={18} color={c.primary} />
        <Text style={{ color: c.text, flex: 1 }}>{pmT('A stage has no lines: select a task or a milestone to see and edit its lines.')}</Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.root}>
      <View accessibilityRole="tablist" testID={`${testID}-tabs`} style={[styles.tabs, { borderBottomColor: c.border }]}>
        {TASK_LINE_GENUS.map((g) => {
          const active = g.genus === genus;
          const t = totals.find((x) => x.genus === g.genus);
          return (
            <Pressable
              key={g.genus}
              accessibilityRole="tab"
              aria-selected={active}
              testID={`${testID}-tab-${g.genus}`}
              onPress={() => setGenus(g.genus)}
              style={[styles.tab, { borderBottomColor: active ? c.primary : 'transparent' }]}
            >
              <IconApp name={g.icon} size={16} color={active ? c.primary : c.text} />
              <Text style={{ color: active ? c.primary : c.text, fontWeight: active ? '700' : '500', fontSize: 13 }}>{pmT(g.title)}</Text>
              {!!t?.count && (
                <Text testID={`${testID}-tab-${g.genus}-sum`} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>
                  {fxProject.accountingCurrency ? `${formatMoney(t.sumForAccounting)} ${fxProject.accountingCurrency}` : formatMoney(t.sumForContract)}
                </Text>
              )}
              {/* the number of lines: a round badge at the top right corner of the tab, like the number on a shopping cart */}
              {!!t?.count && (
                <View testID={`${testID}-tab-${g.genus}-count`} style={[styles.badge, { backgroundColor: c.primary }]}>
                  <Text style={styles.badgeText}>{t.count > 99 ? '99+' : String(t.count)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <ReusableTable
        key={def.genus}
        testID={`${testID}-table`}
        entityName={TASK_LINE_ENTITY}
        crudListTitle={pmT(def.title)}
        itemLabel="Line"
        listOwnerGUID={taskGUID}
        // all-rows mode on the parent: the read is by task only (never by genus), the table of the tab filters its genus - the tab counts above
        // are made of the same rows
        listParentGUID={REUSABLE_TABLE_ALL}
        rowFilter={rowFilter}
        newRowDefaults={newRowDefaults}
        computeRowJSON={computeRowJSON}
        visualColumns={columns}
        defaultRowJSON={emptyTaskLine}
        selectRowCheckBoxForm={selectRowCheckBoxForm}
        dragAndDropColumns
        resizeColumnWidth
        focusRowGUID={focusLine}
        onRowEdit={onRowEdit}
        emptyText={pmT('No lines yet. Press "+ Add".')}
        extraMenuItems={fxOn ? (row, close) => [{ testID: `${testID}-recalc-${row.rowGUID}`, label: pmT('Recalculate currency sums'), icon: 'currency_exchange', onPress: () => { close(); recalcRow(row); } }] : undefined}
        toolbarExtra={fxOn ? (
          <PMIconButton tipScope="app" testID={`${testID}-recalc-all`} icon="currency_exchange" title={pmT('Recalculate the sums in the accounting / budget currency of every line of this tab with the rates now')} color={c.text} onPress={recalcAll} />
        ) : undefined}
        realtime
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  // paddingTop / paddingRight leave room for the count badge in the corner
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 8, paddingLeft: 14, paddingRight: 20, borderBottomWidth: 2 },
  badge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
});
