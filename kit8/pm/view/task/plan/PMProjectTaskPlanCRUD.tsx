// PMProjectTaskPlanCRUD - the posted days (task_line_plan) of ALL the lines of ONE task, in ONE table (the Finances view shows one genus per tab).
// NO CRUD: the rows are written by Post only (SQL create_task_line_plan), so the table has no add / duplicate / delete / reorder, no row menu, no check
// boxes, and no cell is edited. Search, column sort / filter and export stay. Above the table: one line per posted line - its days, coefficients and sums
// against the totals of the line (a ✓ when they are equal: the Correct033 rule leaves nothing lost by the rounding).
// A line changed after posting (taskIsPosted false) is dimmed with "changed after posting - press Post" (the Post button is on the Finances tab).
// Shown by the Plan view of the dashboard (PMTaskLinePlanView) and the route /pm/project/task/plan.
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shallowEqual, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../../../ui/components/common/IconApp';
import ReusableTable from '../../../../ui/components/table/reusable/ReusableTable';
import { REUSABLE_TABLE_ALL } from '../../../../ui/components/table/reusable/reusableTableTypes';
import { usePMStore } from '../../../store/store_pm';
import { pmT } from '../../../i18n/pmT';
import { MANAGEMENT_GENUS } from '../../../../catalog/management/genus/managementGenusModel';
import { TASK_LINE_ENTITY, TASK_LINE_GENUS } from '../finances/taskLineModel';
import type { TaskLineRow } from '../finances/taskLineModel';
import { useTaskLineCatalogs } from '../finances/useTaskLineCatalogs';
import { buildPlanColumns, planLineLabel } from './planColumns';
import PMTaskLinePlanTimeline from './PMTaskLinePlanTimeline';
import { buildTaskLinePlanTimeline, summarizeTaskLinePlan, TASK_LINE_PLAN_ENTITY, TaskLinePlanRow } from './taskLinePlanModel';

export const PLAN_BUDGET_TABS = [
  { id: 'TabPlanTime', genus: MANAGEMENT_GENUS.time, label: 'Time' },
  { id: 'TabPlanMaterial', genus: MANAGEMENT_GENUS.material, label: 'Material' },
  { id: 'TabPlanExpencies', genus: MANAGEMENT_GENUS.expense, label: 'Expenses' },
  { id: 'TabPlanAll', genus: 'all', label: 'All' },
  { id: 'TabPlanTimeline', genus: 'timeline', label: 'Timeline' },
] as const;

export type PlanBudgetTabId = (typeof PLAN_BUDGET_TABS)[number]['id'];

export interface PMProjectTaskPlanCRUDProps {
  projectGUID: string;
  taskGUID: string;
  testID?: string;
}

const NO_LINES: TaskLineRow[] = [];
const NO_ROWS: TaskLinePlanRow[] = [];
/** one task can have thousands of days (lines × days): the page of the read (the server may cap it lower) */
const READ_PARAMS = { paginationSize: 5000 };

export default function PMProjectTaskPlanCRUD({ projectGUID: _projectGUID, taskGUID, testID = 'task-plan' }: PMProjectTaskPlanCRUDProps) {
  const { themeColors: c } = useDesignSystem();
  const task = usePMStore((s) => s.tasksById[taskGUID]);
  const isStage = usePMStore((s) => !!s.schedule[taskGUID]?.isSummary || (s.tree.childrenById[taskGUID]?.length ?? 0) > 0 || s.tasksById[taskGUID]?.rowJSON?.rowKind === 'stage');
  const selectRowCheckBoxForm = usePMStore((s) => s.selectRowCheckBoxForm);
  const data = useTaskLineCatalogs(true);
  const [activeTab, setActiveTab] = useState<PlanBudgetTabId>('TabPlanAll');
  const activeTabDef = useMemo(() => PLAN_BUDGET_TABS.find((t) => t.id === activeTab), [activeTab]);

  const lines: TaskLineRow[] = useSelector((s: any) => s?.[TASK_LINE_ENTITY]?.entityDataFromServer, shallowEqual) ?? NO_LINES;
  const taskLines = useMemo(() => (Array.isArray(lines) ? lines.filter((l) => l.rowOwnerGUID === taskGUID) : NO_LINES), [lines, taskGUID]);
  const planRows: TaskLinePlanRow[] = useSelector((s: any) => s?.[TASK_LINE_PLAN_ENTITY]?.entityDataFromServer, shallowEqual) ?? NO_ROWS;
  const taskPlanRows = useMemo(() => (Array.isArray(planRows) ? planRows.filter((r) => r.rowOwnerGUID === taskGUID) : NO_ROWS), [planRows, taskGUID]);
  const linesById = useMemo(() => new Map(taskLines.map((l) => [l.rowGUID, l])), [taskLines]);
  const summaries = useMemo(() => {
    const rank = (g: string) => { const i = TASK_LINE_GENUS.findIndex((x) => x.genus === g); return i < 0 ? TASK_LINE_GENUS.length : i; };
    const ordered = taskLines.slice().sort((a, b) => rank(a.rowParentGUID) - rank(b.rowParentGUID) || (Number(a.orderInList) || 0) - (Number(b.orderInList) || 0));
    return summarizeTaskLinePlan(taskPlanRows, ordered);
  }, [taskPlanRows, taskLines]);

  const isTimeline = activeTab === 'TabPlanTimeline';
  const timelineDays = useMemo(() => (isTimeline ? buildTaskLinePlanTimeline(taskPlanRows) : []), [isTimeline, taskPlanRows]);

  const filteredSummaries = useMemo(() => {
    if (!activeTabDef || activeTabDef.genus === 'all' || activeTabDef.genus === 'timeline') return summaries;
    return summaries.filter((s) => {
      const line = linesById.get(s.lineGUID);
      return line?.rowParentGUID === activeTabDef.genus;
    });
  }, [summaries, activeTabDef, linesById]);

  const columns = useMemo(() => buildPlanColumns({ data, linesById, textColor: c.text, mutedColor: c.text + '99' }), [data, linesById, c.text]);
  const rowFilter = useCallback(
    (row: ReusableTableRow) => {
      if (!activeTabDef || activeTabDef.genus === 'all' || activeTabDef.genus === 'timeline') return true;
      const line = linesById.get(row.rowParentGUID);
      return line?.rowParentGUID === activeTabDef.genus;
    },
    [activeTabDef, linesById],
  );

  if (!task) return null;
  if (isStage) {
    return (
      <View testID={`${testID}-stage`} style={[styles.note, { borderColor: c.border, backgroundColor: c.surface }]}>
        <IconApp name="info" size={18} color={c.primary} />
        <Text style={{ color: c.text, flex: 1 }}>{pmT('A stage has no lines: select a task or a milestone to see the plan of its lines.')}</Text>
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.root}>
      {/* Budgets sub-tabs: TabPlanTime, TabPlanMaterial, TabPlanExpencies, TabPlanAll, TabPlanTimeline */}
      <View style={[styles.tabs, { borderBottomColor: c.border }]} testID={`${testID}-tabs`}>
        {PLAN_BUDGET_TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          const count = tab.genus === 'timeline'
            ? 0
            : tab.genus === 'all'
            ? taskLines.length
            : taskLines.filter((l) => l.rowParentGUID === tab.genus).length;
          return (
            <Pressable
              key={tab.id}
              testID={`${testID}-tab-${tab.id}`}
              onPress={() => setActiveTab(tab.id)}
              style={[
                styles.tab,
                {
                  borderBottomColor: isSelected ? c.primary : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: isSelected ? c.primary : c.text,
                  fontWeight: isSelected ? '700' : '500',
                  fontSize: 13,
                }}
              >
                {pmT(tab.label)}
              </Text>
              {count > 0 && (
                <View testID={`${testID}-tab-${tab.id}-count`} style={[styles.badge, { backgroundColor: isSelected ? c.primary : c.text + '55' }]}>
                  <Text style={styles.badgeText}>{count > 99 ? '99+' : String(count)}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {!isTimeline && filteredSummaries.length > 0 && (
        <View testID={`${testID}-summary`} style={[styles.summary, { borderColor: c.border, backgroundColor: c.surface }]}>
          {filteredSummaries.map((s) => {
            const line = linesById.get(s.lineGUID);
            const stale = line?.rowJSON?.taskIsPosted === false;
            return (
              <View key={s.lineGUID} testID={`${testID}-summary-${s.lineGUID}`} style={[styles.summaryRow, stale ? { opacity: 0.55 } : null]}>
                <IconApp name={s.ok ? 'check_circle' : 'error'} size={16} color={s.ok ? c.primary : c.error} />
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 13, fontWeight: '700', flexShrink: 1, minWidth: 140 }}>{planLineLabel(data, line) || s.lineGUID}</Text>
                <Text style={{ color: c.text, fontSize: 12 }}>{`${s.days} ${pmT('days')} · Σ ${pmT('coefficient')} ${s.coefficient} · ${pmT('qty')} ${s.qtyTaskLine ?? '–'} · ${pmT('budget')} ${s.sumForBudget ?? '–'} · ${pmT('contract')} ${s.sumForContract ?? '–'}`}</Text>
                {stale && <Text style={{ color: c.error, fontSize: 12 }}>{pmT('changed after posting - press Post (Edit)')}</Text>}
              </View>
            );
          })}
        </View>
      )}
      {isTimeline && <PMTaskLinePlanTimeline testID={`${testID}-timeline`} days={timelineDays} />}
      {/* the table stays mounted (hidden on Timeline): it is the one that reads the plan rows into redux */}
      <View style={isTimeline ? styles.hidden : undefined}>
      <ReusableTable
        key={isTimeline ? 'TabPlanAll' : activeTab}
        testID={`${testID}-table`}
        entityName={TASK_LINE_PLAN_ENTITY}
        crudListTitle={pmT('Budgets')}
        itemLabel="Day"
        listOwnerGUID={taskGUID}
        // every line of the task: the read is by task only
        listParentGUID={REUSABLE_TABLE_ALL}
        rowFilter={rowFilter}
        readParams={READ_PARAMS}
        visualColumns={columns}
        reorderEnabled={false}
        crudPanelEnabled={false}
        selectionEnabled={false}
        contextMenuEnabled={false}
        selectRowCheckBoxForm={selectRowCheckBoxForm}
        resizeColumnWidth
        realtime
        emptyText={pmT('Nothing posted yet. Choose a budget item on the lines and press Post (Edit).')}
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', gap: 10 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, paddingBottom: 8, paddingLeft: 12, paddingRight: 18, borderBottomWidth: 2 },
  badge: { position: 'absolute', top: 2, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', lineHeight: 14 },
  hidden: { display: 'none' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  summary: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 10, gap: 6 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
