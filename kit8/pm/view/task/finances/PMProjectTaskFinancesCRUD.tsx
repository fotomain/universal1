// PMProjectTaskFinancesCRUD - the finance lines of ONE task, one table per management genus (tabs):
//   Time (a role + a person + his variant + his contract) · Material · Expenses · Revenues (a role + a product + a contract template + a partner)
// Each line is a row of task_line_table (rowOwnerGUID = the task, rowParentGUID = the genus), edited in place in a ReusableTable: add,
// duplicate, move, sql_for_delete (+ Undo), search, sort, filter, export. The money (sum = qty * price, VAT) and the defaults (unit, VAT, price from
// the role / product catalogs) are computed on every change (taskLineCompute.ts) and saved with it. When the project has an accounting / budget
// currency, the sums are also converted into them with the exchange rates, D365 style (taskLineFx.ts): a SNAPSHOT saved with the rate and its date;
// the "Recalculate" commands (row menu, bar) make it again with the rates of today's choice of day.
//
// POST (kit8/pm/view/task/plan): the Post button is the first button of the bar. It posts the WHOLE task (all tabs): the days of every line with a budget item
// go to task_line_plan in one SQL transaction. A line is "posted" until anything in it changes (taskIsPosted, taskLineCompute.ts).
//
// Shown by the task page (PMProjectTaskInfo) and the Finances view of the dashboard (PMProjectFinancesView). It does not know PMCrud:
// `onEditPlace` tells the parent where the user edited (the parent saves rowJSON.lastEditPlace of the task, with its own surface) and
// `initialPlace` is the place to open at (the genus tab + the line, marked). Stages have no lines: only tasks and milestones.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { DISTRIBUTION } from '../../../../catalog/distribution/distributionModel';
import { emptyTaskLine, TASK_LINE_ENTITY, TASK_LINE_GENUS, taskLineGenusDef, taskLineGenusOf } from './taskLineModel';
import type { TaskLineRow } from './taskLineModel';
import { formatMoney, taskLineTotals } from './taskLineMoney';
import { computeTaskLineRowJSON } from './taskLineCompute';
import { buildTaskLineColumns, taskLineErrors } from './taskLineColumns';
import { useTaskLineCatalogs } from './useTaskLineCatalogs';
import { computeFx, fxEnabled, fxProjectOf, LineFxContext, recalculateLineFx } from './taskLineFx';
import { lineContractCurrency } from './taskLineCatalogs';
import { useLineRateBook } from './useLineRateBook';
import { useTaskPost } from '../plan/useTaskPost';
import { defaultBudgetItemOfGenus } from '../plan/taskLinePlanModel';

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
/** a duplicated line was never posted */
const DUPLICATE_UNPOSTED = { taskIsPosted: false, baseOfDistribution: null };

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
  const postButtonColor = usePMStore((s) => s.postButtonBackgroundColor);

  const startPlace = useRef(financesPlaceOf(initialPlace)).current;
  const [genus, setGenus] = useState<string>(() => taskLineGenusOf(startPlace?.genus));
  /** the line marked in the table: the one the place says, then the one the user edited last */
  const [focusLine, setFocusLine] = useState<string | null>(() => (startPlace?.lineGUID ?? null));
  const def = taskLineGenusDef(genus) ?? TASK_LINE_GENUS[0];

  // every line of the task (all genus): the tab counts and sums. The table of the active tab reads the same rows (all-rows mode).
  const lines: TaskLineRow[] = useSelector((s: any) => s?.[TASK_LINE_ENTITY]?.entityDataFromServer, shallowEqual) ?? NO_LINES;
  const taskLines = useMemo(() => (Array.isArray(lines) ? lines.filter((l) => l.rowOwnerGUID === taskGUID) : NO_LINES), [lines, taskGUID]);
  const totals = useMemo(() => taskLineTotals(taskLines), [taskLines]);
  // Post: the whole task; the state of the button (Post · Posted · Post needed) comes from the lines of ALL tabs
  const { state: postState, post } = useTaskPost({ projectGUID, taskGUID, lines: taskLines, distributions: data.distribution });

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

  // the Errors column (the first one) is there only while a line of this tab has an error
  const hasErrors = useMemo(
    () => taskLines.some((l) => l.rowParentGUID === def.genus && taskLineErrors(data, def, l.rowJSON || {}, fx).length > 0),
    [taskLines, def, data, fx],
  );
  const columns = useMemo(
    () => buildTaskLineColumns({ data, genus: def, projectCurrency, textColor: c.text, errorColor: c.error, fxProject: fxOn ? fxProject : null, fx, showErrors: hasErrors }),
    [data, def, projectCurrency, c.text, c.error, fxOn, fxProject, fx, hasErrors],
  );
  const rowFilter = useCallback((row: ReusableTableRow) => row.rowParentGUID === def.genus, [def.genus]);
  // taskManagementGenusLine = the genus of the tab: the contract templates the line can pick depend on it
  const newRowDefaults = useMemo(() => ({ rowOwnerGUID: taskGUID, rowParentGUID: def.genus, rowJSON: { taskManagementGenusLine: def.genus, distributionForBudgetTaskLine: DISTRIBUTION.uniform, budgetItemTaskLine: defaultBudgetItemOfGenus(data.budgetItem, def.genus), taskIsPosted: false } as Record<string, any> }), [taskGUID, def.genus, data.budgetItem]);
  const computeRowJSON = useCallback((json: Record<string, any>) => computeTaskLineRowJSON(data, def, json, undefined, fx), [data, def, fx]);

  /** "Recalculate": the separate algorithm - the snapshot of the rate is ignored and the rates are taken again; true = the line changed */
  const recalcRow = useCallback((row: { rowGUID: string; rowJSON?: Record<string, any> }): boolean => {
    const actions = SystemMetaData[TASK_LINE_ENTITY]?.actions;
    if (!fx || !actions?.updateOne) return false;
    const fxPatch = recalculateLineFx(fx, data, def, row.rowJSON || {});
    if (!Object.keys(fxPatch).length) return false;
    // the sums changed: the posted days are out of date
    const patch = { ...fxPatch, taskIsPosted: false };
    dispatch(actions.updateOne({ rowGUID: row.rowGUID, rowOwnerGUID: taskGUID, rowJSON: patch }));
    return true;
  }, [fx, data, def, dispatch, taskGUID]);
  // The rates arrive after the lines (or a line was saved while they were being read): a line with a sum but without its snapshot gets it now,
  // so a price changed at that moment never stays without the sums in the accounting / budget currency. A line that cannot be converted stays as it is (the ⚠ says why).
  useEffect(() => {
    if (!fx) return;
    for (const l of taskLines) {
      const j = l.rowJSON || {};
      if (j.sumForContract != null && !j.fxSnapshotTaskLine && taskLineGenusDef(l.rowParentGUID)) {
        const g = taskLineGenusDef(l.rowParentGUID)!;
        const patch = computeFx(fx, data, g, j);
        const actions = SystemMetaData[TASK_LINE_ENTITY]?.actions;
        if (Object.keys(patch).length && actions?.updateOne) dispatch(actions.updateOne({ rowGUID: l.rowGUID, rowOwnerGUID: taskGUID, rowJSON: { ...patch, taskIsPosted: false } }));
      }
    }
  }, [fx, taskLines, data, dispatch, taskGUID]);
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
        postDataNeeded
        postState={postState}
        onPost={post}
        postButtonColor={postButtonColor}
        duplicateOverrides={DUPLICATE_UNPOSTED}
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
