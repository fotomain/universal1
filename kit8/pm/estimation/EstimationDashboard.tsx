// EstimationDashboard - the workbench of an estimate: inputs, edits and saves estimates, keeps the norm books, and exports Excel / PDF. Design: documentation/ESTIMATION/dashboard/claude/
// ESTIMATION_DASHBOARD_WBS.html (+ google/). Route /pm/project/estimation/dashboard (Drawer: right under Project Dashboard). WEB FIRST.
//   Which project: ?projectGUID=... or the project selected in the project dashboard; when that project names an ESTIMATION project (Project settings -> Estimation) this one is edited,
//   else the project itself.
//   Estimate tab = the Project dashboard with the estimate instead of the Gantt chart: [ task tree of the estimation project | the estimate GRID ] (view/project/tree/PMProjectTreeHost). The grid is ONE
//          Excel-like Skia sheet (grid/EstimateGridPane) with ONE row per tree row on the SAME scroll: a task row = its one position (rowJSON.taskGUID), a stage row = the sums of the tasks below it
//   Tabs:  Estimate (the board: 4 layouts, every cell edited in place, three currencies) · Document (its settings) · Norm books (tree World Norms v2, import / export zip) · Templates (examples +
//          input / output) · Summary (chapters 1 - 12) · Export (Excel, PDF)
//   Rights: permissionEstimationManager (SQL PART 58: the organization administrator and a project manager automatically) writes; everybody who can read the project reads.
//   Wording: neutral English unless the project switch useGOSTInformationInDocuments is ON (then the forms of the Methodology are named). Every text is a pmT key (14 languages).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { useSupabase } from '../../providers/WithSupabase';
import { useMyOrganization } from '../../catalog/organization/useMyOrganization';
import { usePermissions } from '../../permissions/usePermissions';
import SegmentButtonsApp from '../../ui/components/common/SegmentButtonsApp';
import ScrollableTabBar from '../../ui/components/tabs/ScrollableTabBar';
import { useReadProjectQuery } from '../crud/project/projectQueries';
import { pmT } from '../i18n/pmT';
import { PMDialogButton } from '../inner/buttons/PMDialogButton';
import { PMIconButton } from '../inner/buttons/PMIconButton';
import SelectProjectFromList from '../view/project/SelectProjectFromList';
import { projectIsReadonly } from '../model/projectReadonly';
import { usePMOwnerGUID } from '../crud/queries';
import { createTaskApi } from '../crud/api/taskApi';
import { pmKeys } from '../crud/shared/queryShared';
import { usePMStore } from '../store/store_pm';
import { estimationLinkOf } from '../view/project/estimation/estimationModel';
import { readCurrencyRate } from '../view/project/estimation/estimationApi';
import { applyNormToLine, estimateFromTable, exampleDocument, newLineRow, type DocumentRow, type ExampleKey } from './model/estimationDocumentModel';
import { newDocumentRow } from './model/estimationDocumentModel';
import { BASIS_TIPS, BASIS_TO_SUM_KEY, useGOSTInformationOf, type EstimationCurrencyBasis, type EstimationDocKind } from './model/estimationModel';
import { ESTIMATION_LAYOUTS, type EstimationLayout } from './model/estimationLayouts';
import EstimationExportPanel from './ui/EstimationExportPanel';
import EstimationProjectPicker from './ui/EstimationProjectPicker';
import EstimationSettingsPanel from './ui/EstimationSettingsPanel';
import EstimationSummaryPanel from './ui/EstimationSummaryPanel';
import EstimationTemplatesPanel from './ui/EstimationTemplatesPanel';
import ExportNormBooks from './ui/ExportNormBooks';
import ImportNormBooks from './ui/ImportNormBooks';
import NormBookPanel from './ui/NormBookPanel';
import SelectNormWindow from './ui/SelectNormWindow';
import { saveLastEstimation, useLastEstimation } from './ui/lastEstimationLocal';
import { useEstimationData } from './ui/useEstimationData';
import { docKindTitle } from './export/estimationForms';
import { ESTIMATION_TREE_LABELS } from '../view/tree/toolbars/treeToolbarLabels';
import { assignLinesToTask, canCarryEstimate, rootStagesByName, taskKindOf, taskRowsFromPlan, unassignedLines, type TaskPlanRow } from './model/estimationTaskModel';
import type { PMTaskRow } from '../model/types';
import { positionCountOf, removePositionOf } from './model/estimateGridModel';
import InfoModal from '../../ui/components/info/InfoModal';
import { layoutHelp } from './model/layoutHelpModel';
import PMProjectTreeHost from '../view/project/tree/PMProjectTreeHost';
import type { PMViewport } from '../view/gantt/useGanttViewport';
import type { PMPalette } from '../view/theme';
import type { EstimateGridPaneProps } from './grid/EstimateGridPane';

// the grid draws with Skia: its module is evaluated only when it is first shown (inside the Gantt surface, after CanvasKit has started on the web)
const LazyEstimateGrid = React.lazy(() => Promise.resolve(require('./grid/EstimateGridPane'))) as React.ComponentType<EstimateGridPaneProps>;

type TabId = 'estimate' | 'document' | 'norms' | 'templates' | 'summary' | 'export';
const TABS: { id: TabId; label: string }[] = [
  { id: 'estimate', label: 'Estimate' }, { id: 'summary', label: 'Summary' }, { id: 'document', label: 'Document settings' }, { id: 'norms', label: 'Norm books' }, { id: 'templates', label: 'Templates' }, { id: 'export', label: 'Export' },
];
const fmt = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BASIS_LABELS: Record<EstimationCurrencyBasis, string> = { budget: 'Budget', accounting: 'Accounting', consolidation: 'Consolidation' };

export default function EstimationDashboard() {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const ownerGUID = usePMOwnerGUID();
  const params = useLocalSearchParams<{ projectGUID?: string }>();
  const selected = usePMStore((s: any) => s.selectedProjectGUID) as string | null;
  const [pickedGUID, setPickedGUID] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // the project asked: the one picked here, a link (?projectGUID=), the one opened LAST time (kept on this device), the one selected in the project dashboard
  const { ready: lastReady, last } = useLastEstimation();
  const [lastGone, setLastGone] = useState(false);
  const linkGUID = typeof params?.projectGUID === 'string' && params.projectGUID ? params.projectGUID : null;
  const rememberedGUID = !lastGone && lastReady ? last.projectGUID : null;
  // the project selected in the project dashboard counts once (the tree below selects the estimation project in the same store: that must not change the project asked)
  const frozenSelected = React.useRef<string | null | undefined>(undefined);
  if (lastReady && frozenSelected.current === undefined) frozenSelected.current = selected ?? null;
  const askedGUID = pickedGUID || linkGUID || rememberedGUID || (lastReady ? frozenSelected.current : null) || null;
  const asked = useReadProjectQuery(askedGUID);
  const projectJSON: Record<string, any> = (asked.data?.rowJSON as any) ?? {};
  const projectGUID = (askedGUID && (estimationLinkOf(projectJSON) ?? askedGUID)) || null;
  const editsLinked = !!askedGUID && projectGUID !== askedGUID;
  const gost = useGOSTInformationOf(projectJSON);
  const { supabase: client } = useSupabase() as any;
  const { organizationJSON } = useMyOrganization();
  const perms = usePermissions(projectGUID);
  const canManage = perms.canManageEstimation !== false;
  const readOnly = !canManage || perms.projectIsReadonly;
  const data = useEstimationData(client, projectGUID, projectGUID ? last.documentByProject[projectGUID] : null);

  // remember the project once it is read, and the estimate while it is open; a remembered project that is gone (deleted, no access) is forgotten
  useEffect(() => {
    if (!askedGUID || asked.isLoading) return;
    if (asked.data) saveLastEstimation({ projectGUID: askedGUID });
    else if (askedGUID === rememberedGUID && !pickedGUID && !linkGUID) { saveLastEstimation({ projectGUID: null }); setLastGone(true); }
  }, [askedGUID, asked.isLoading, asked.data, rememberedGUID, pickedGUID, linkGUID]);
  useEffect(() => {
    // only an estimate that belongs to this project (right after a project switch the old one is still selected until the new list is read)
    if (projectGUID && data.documentGUID && data.documents.some((d) => d.rowGUID === data.documentGUID && d.rowOwnerGUID === projectGUID)) saveLastEstimation({ documentProjectGUID: projectGUID, documentGUID: data.documentGUID });
  }, [projectGUID, data.documentGUID, data.documents]);

  const [tab, setTab] = useState<TabId>('estimate');
  const [layout, setLayout] = useState<EstimationLayout>('simple');
  // the help for the CFO of a layout: right click / double click / double touch / long press on its button
  const [helpLayout, setHelpLayout] = useState<EstimationLayout | null>(null);
  const [basis, setBasis] = useState<EstimationCurrencyBasis>('budget');
  const [importOpen, setImportOpen] = useState(false);
  const [exportBook, setExportBook] = useState<string | null>(null);
  const [normsVersion, setNormsVersion] = useState(0);
  const [summarySettings, setSummarySettings] = useState({ contingencyPct: 2, vatPct: 20, objectKind: 'nonProduction' as any });
  const [note, setNote] = useState('');
  // the TASK whose position gets the norm being selected (the norm cell of the grid opens the norm books in a window)
  const [normTask, setNormTask] = useState<string | null>(null);
  // the norm window was closed: the grid takes the keyboard back (else the keys would reach the task tree)
  const [gridFocus, setGridFocus] = useState(0);
  const wasNorm = React.useRef(false);
  useEffect(() => { if (wasNorm.current && !normTask) setGridFocus((n) => n + 1); wasNorm.current = !!normTask; }, [normTask]);
  // the row picked in the task tree (PM store); the grid has one row per tree row, so it needs nothing else from the tree
  const pickedRaw = usePMStore((s: any) => s.selectedGUID) as string | null;
  const pickedTask = usePMStore((s: any) => (pickedRaw && s.tasksById?.[pickedRaw] ? pickedRaw : null)) as string | null;
  const childrenById = usePMStore((s: any) => s.tree?.childrenById) as Record<string, string[]> | undefined;
  const tasksById = usePMStore((s: any) => s.tasksById) as Record<string, any> | undefined;
  const pickedCanCarry = !!pickedTask && canCarryEstimate(taskKindOf(tasksById?.[pickedTask]), (childrenById?.[pickedTask]?.length ?? 0) > 0);
  const pickedPositions = pickedTask ? positionCountOf(data.lines, pickedTask) : 0;
  // an old / imported line has no task: it is given to the picked task one by one (a task carries ONE position)
  const knownTasks = useMemo(() => new Set(Object.keys(tasksById ?? {})), [tasksById]);
  const unassigned = useMemo(() => unassignedLines(data.lines, knownTasks).filter((l) => l.rowJSON.lineKind === 'position').sort((x, y) => x.orderInList - y.orderInList), [data.lines]);

  const currencies = useMemo(() => ({
    budget: String(projectJSON.currencyForBudget ?? ''), accounting: String(projectJSON.currencyForAccounting ?? ''), consolidation: String(organizationJSON?.currencyForConsolidation ?? ''),
  }), [projectJSON, organizationJSON]);
  const basisCurrency = currencies[basis] || '';
  const doc = data.document;
  const totals = data.calc.total;
  const shownTotal = doc ? data.calc.sums[BASIS_TO_SUM_KEY[basis]] : 0;

  const newDocument = useCallback(async (kind: EstimationDocKind) => {
    if (!projectGUID) return;
    await data.createDocument(newDocumentRow(projectGUID, kind, { title: '', currency: currencies.budget || undefined }));
    setTab('estimate');
  }, [data, projectGUID, currencies.budget]);

  const readRates = useCallback(async () => {
    if (!doc?.rowJSON.currency) return;
    const day = new Date().toISOString().slice(0, 10);
    const from = doc.rowJSON.currency.toUpperCase();
    const one = async (to: string) => (!to || to.toUpperCase() === from ? 1 : (await readCurrencyRate(client, from, to.toUpperCase(), day)) ?? null);
    const [b, a, k] = await Promise.all([one(currencies.budget), one(currencies.accounting), one(currencies.consolidation)]);
    const missing = [b === null && currencies.budget, a === null && currencies.accounting, k === null && currencies.consolidation].filter(Boolean);
    data.changeDocument({ rates: { budget: b ?? doc.rowJSON.rates?.budget ?? 1, accounting: a ?? doc.rowJSON.rates?.accounting ?? 1, consolidation: k ?? doc.rowJSON.rates?.consolidation ?? 1 } });
    setNote(missing.length ? pmT('No rate in the rate book for: {{c}}. Type the rate by hand.', { c: missing.join(', ') }) : pmT('The rates of the rate book were read.'));
  }, [client, currencies, data, doc]);

  const addNorm = useCallback((norm: any, costs: any, title: string) => {
    if (!projectGUID || !doc) { setNote(pmT('Open or make an estimate first (Estimate tab).')); return; }
    const order = data.lines.reduce((m, l) => Math.max(m, l.orderInList), 0) + 10;
    data.changeLines((prev) => [...prev, newLineRow(projectGUID, doc.rowGUID, 'position', 'empty', order, {
      ...(pickedTask && pickedCanCarry && !pickedPositions ? { taskGUID: pickedTask } : {}),
      title, normCode: norm.rowJSON.code, normGUID: norm.rowGUID, unit: norm.rowJSON.unit, qty: 1,
      unitLabour: costs.unitLabour, unitMachines: costs.unitMachines, unitOperators: costs.unitOperators, unitMaterials: costs.unitMaterials, unitOther: costs.unitOther, unitEquipment: costs.unitEquipment,
    })]);
    setNote(costs.missing.length ? pmT('The norm was added. {{n}} resource(s) have no price in the book: price them in the board.', { n: costs.missing.length }) : pmT('The norm was added to the estimate.'));
    setTab('estimate');
  }, [data, doc, projectGUID, pickedTask, pickedCanCarry, pickedPositions]);

  // the norm chosen in the window goes INTO the position of the task that asked for it (made when the task has none); its unit costs come from the priced resources of the book
  const selectNorm = useCallback((norm: any, costs: any, title: string) => {
    const target = normTask;
    setNormTask(null);
    if (!target || !projectGUID || !doc) return;
    data.changeLines((prev) => {
      const mine = prev.filter((l) => l.rowJSON.taskGUID === target && l.rowJSON.lineKind === 'position');
      if (mine.length > 1) return prev; // several positions: read only
      if (mine.length === 1) return prev.map((l) => (l.rowGUID === mine[0].rowGUID ? applyNormToLine(l, norm, costs, title) : l));
      const order = prev.reduce((m, l) => Math.max(m, l.orderInList), 0) + 10;
      return [...prev, applyNormToLine(newLineRow(projectGUID, doc.rowGUID, 'position', 'empty', order, { taskGUID: target }), norm, costs, title)];
    });
    setNote(costs.missing.length ? pmT('The norm was set. {{n}} resource(s) have no price in the book: price them in the board.', { n: costs.missing.length }) : pmT('The norm was set on the position.'));
  }, [data, normTask, projectGUID, doc]);

  // ---- the stages and tasks an example / an imported table needs: written into the TASK TREE of the project first (the positions name them), then the tree is read again
  const queryClient = useQueryClient();
  const makeTasks = useCallback(async (plan: readonly TaskPlanRow[], existing?: readonly PMTaskRow[]) => {
    if (!plan.length || !projectGUID) return;
    // the tasks are written for the signed-in user: without him nothing is made (the caller stops before it makes positions that name tasks which do not exist)
    if (!ownerGUID) throw new Error(pmT('Sign in to make the tasks of the estimate.'));
    const api = createTaskApi(client);
    const rows = taskRowsFromPlan(plan, { projectGUID, ownerGUID, existing: existing ?? (await api.readProjectData(projectGUID)).tasks });
    for (let i = 0; i < rows.length; i += 400) await api.importTasks(projectGUID, rows.slice(i, i + 400));
    await queryClient.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) });
  }, [client, ownerGUID, projectGUID, queryClient]);

  const createExample = useCallback(async (key: ExampleKey) => {
    if (!projectGUID) return;
    try {
      const ex = exampleDocument(projectGUID, key);
      await makeTasks(ex.tasks);
      await data.createFromExample(ex);
      setTab('estimate');
    } catch (e: any) { setNote(String(e?.message ?? e)); }
  }, [data, makeTasks, projectGUID]);

  // a pasted table / CSV: a task per row (under the stage named in the column `section`, a stage of the project with that name is joined), its position on it
  const importTable = useCallback(async (text: string): Promise<number> => {
    if (!projectGUID || !doc) return 0;
    const { tasks: existing } = await createTaskApi(client).readProjectData(projectGUID);
    const order = data.lines.reduce((m, l) => Math.max(m, l.orderInList), 0) + 10;
    const made = estimateFromTable(projectGUID, doc.rowGUID, text, { startOrder: order, existingStages: rootStagesByName(existing) });
    if (!made.lines.length) return 0;
    await makeTasks(made.tasks, existing);
    data.changeLines((prev) => [...prev, ...made.lines]);
    return made.lines.length;
  }, [client, data, doc, makeTasks, projectGUID]);

  // the right pane of the tree: [ a bar as high as the toolbar of the tree | the grid (header as high as the header of the tree) ]. The grid has one row per tree row on the tree's own scroll value.
  const estimatePane = (area: { width: number; height: number; palette: PMPalette; viewport: PMViewport; toolbarHeight: number }) => (
    <View style={{ flex: 1 }}>
      <View testID="estimation-pane-bar" style={[styles.paneBar, { height: area.toolbarHeight, borderBottomColor: c.border, backgroundColor: c.surface }]}>
        {doc ? (
          <View testID="estimation-totals" style={styles.paneTotals}>
            {area.width >= 760 && (
              <>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{pmT('Direct costs')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.direct)}</Text></Text>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{pmT('Overheads')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.overheads)}</Text></Text>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{pmT('Profit')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.profit)}</Text></Text>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{pmT('Total, base prices')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.base)}</Text></Text>
                <Text numberOfLines={1} style={{ color: c.text, fontSize: 12 }}>{pmT('Total, current prices')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.current)}</Text></Text>
              </>
            )}
            <Text testID="estimation-total-shown" numberOfLines={1} style={{ color: c.primary, fontSize: 13, fontWeight: '800' }}>{pmT('In the view currency')} {basisCurrency}: {fmt(shownTotal)}</Text>
          </View>
        ) : <View style={{ flex: 1 }} />}
        {/* lines of an older / imported estimate have no task: the next one is given to the picked task; the position of the picked task can be removed */}
        {!!doc && !!unassigned.length && (
          <PMIconButton tipScope="app" testID="estimation-assign-next" icon="assignment_ind" title={`${pmT('Give the next line without a task to the picked task')} (${unassigned.length})`} color={c.primary}
            disabled={readOnly || !pickedCanCarry || pickedPositions > 0} onPress={() => { if (pickedTask) data.changeLines((prev) => assignLinesToTask(prev, [unassigned[0].rowGUID], pickedTask)); }} />
        )}
        {!!doc && (
          <PMIconButton tipScope="app" testID="estimation-remove-position" icon="playlist_remove" title="Remove the position of the picked task" color={c.error}
            disabled={readOnly || !pickedTask || !pickedPositions} onPress={() => { if (pickedTask) data.changeLines((prev) => removePositionOf(prev, pickedTask)); }} />
        )}
      </View>
      {!doc ? (
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={{ color: c.text }}>{data.loading ? pmT('Reading...') : pmT('No estimate in this project yet.')}</Text>
          <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('Make one with New estimate, or start from an example in the Templates tab.')}</Text>
        </View>
      ) : (
        <React.Suspense fallback={null}>
          <LazyEstimateGrid
            width={area.width} height={Math.max(0, area.height - area.toolbarHeight)} palette={area.palette} viewport={area.viewport}
            projectGUID={projectGUID!} documentGUID={doc.rowGUID} doc={doc.rowJSON as any} lines={data.lines} calc={data.calc}
            layout={layout} basis={basis} currency={basisCurrency} readOnly={readOnly} onChangeLines={data.changeLines} onSelectNorm={readOnly ? undefined : setNormTask} focusToken={gridFocus}
          />
        </React.Suspense>
      )}
    </View>
  );

  const ready = !!projectGUID;
  const saveLabel = data.saveState === 'saving' ? pmT('Saving...') : data.saveState === 'error' ? pmT('Not saved') : data.saveState === 'saved' ? pmT('Saved') : '';

  const statusText = [
    !ready ? pmT('Pick a project below or make a new one for the estimation.') : '',
    ready && editsLinked ? pmT('its estimation project is edited') : '',
    ready && readOnly ? (canManage ? pmT('read-only project') : pmT('you may read, not change (permissionEstimationManager)')) : '',
  ].filter(Boolean).join(' · ');

  return (
    <View testID="estimation-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      {/* the tool bar of the screen, as in the Project dashboard: icon buttons (the name is the hover tip), LEFT justified, then the state of the save; the document buttons (New estimate / New quotation / Delete estimate) are RIGHT justified */}
      <View testID="estimation-toolbar" style={[styles.toolbar, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        {/* the project field of the Project dashboard (search by name, ✕, ▾ the list, Create new) - it picks the project of THIS screen */}
        <SelectProjectFromList ownerGUID={ownerGUID ?? ''} width={260} onPick={(g) => { setPickedGUID(g); setPickerOpen(false); setTab('estimate'); }}
          selectedName={ready ? String(asked.data?.rowJSON?.name ?? '') : ''} selectedReadonly={!!askedGUID && projectIsReadonly(projectJSON)} onCreateNew={() => setPickerOpen(true)} />
        <PMIconButton tipScope="app" testID="estimation-go-projects" icon="view_timeline" title="Go to Projects" color={c.text} onPress={() => router.push('/catalog/project')} />
        <PMIconButton tipScope="app" testID="estimation-reload" icon="refresh" title="Reload" color={c.text} disabled={!ready} onPress={data.reload} />
        {/* no title block (the app bar has the name of the screen): only what the user must know - a hint without a project, a read-only / linked project */}
        {!!statusText && <Text testID="estimation-status" numberOfLines={2} style={{ color: c.text, opacity: 0.7, fontSize: 12, marginLeft: 8, flexShrink: 1 }}>{statusText}</Text>}
        {!!saveLabel && <Text testID="estimation-save-state" style={{ color: data.saveState === 'error' ? c.error : c.text, opacity: 0.8, fontSize: 12, marginLeft: 8 }}>{saveLabel}</Text>}
        <View style={styles.actions}>
          <PMIconButton tipScope="app" testID="estimation-new-document" icon="note_add" title="New estimate" color={c.primary} disabled={readOnly} onPress={() => { void newDocument('local'); }} />
          <PMIconButton tipScope="app" testID="estimation-new-quote" icon="request_quote" title="New quotation" color={c.primary} disabled={readOnly} onPress={() => { void newDocument('bid'); }} />
          {!!doc && <PMIconButton tipScope="app" testID="estimation-delete-document" icon="delete" title="Delete estimate" color={c.error} disabled={readOnly} onPress={() => { void data.deleteDocument(doc.rowGUID); }} />}
        </View>
      </View>

      <ScrollableTabBar testID="estimation-tabs" style={[styles.tabs, { borderBottomColor: c.border }]} arrowColor={c.text}>
        {TABS.map((t) => (
          <Pressable key={t.id} testID={`estimation-tab-${t.id}`} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && { borderBottomColor: c.primary, borderBottomWidth: 3 }]}>
            <Text style={{ color: tab === t.id ? c.primary : c.text, fontWeight: tab === t.id ? '700' : '500', fontSize: 14 }}>{pmT(t.label)}</Text>
          </Pressable>
        ))}
      </ScrollableTabBar>

      {!!data.error && <Text testID="estimation-error" style={{ color: c.error, padding: 8 }}>{data.error} {pmT('(Run start1 + start2 + start4: SQL PART 58.)')}</Text>}
      {!!note && <Text testID="estimation-note" style={{ color: c.text, paddingHorizontal: 12, paddingTop: 6, fontSize: 12 }}>{note}</Text>}

      <InfoModal testID="estimation-layout-help" content={helpLayout ? layoutHelp(helpLayout) : null} onClose={() => setHelpLayout(null)} closeLabel={pmT('Close')} />
      <SelectNormWindow visible={!!normTask} client={client} onSelect={selectNorm} onClose={() => setNormTask(null)} />
      <View style={styles.body}>
        {!ready || pickerOpen ? (
          <EstimationProjectPicker onPicked={(g) => { setPickedGUID(g); setPickerOpen(false); setTab('estimate'); }} onCancel={ready ? () => setPickerOpen(false) : undefined} />
        ) : tab === 'estimate' ? (
          <View style={{ flex: 1 }}>
            <View style={styles.bar}>
              <View style={styles.docs}>
                {data.documents.map((d) => (
                  <Pressable key={d.rowGUID} testID={`estimation-doc-${d.rowGUID}`} onPress={() => data.selectDocument(d.rowGUID)} style={[styles.docChip, { borderColor: d.rowGUID === data.documentGUID ? c.primary : c.border, backgroundColor: d.rowGUID === data.documentGUID ? c.primary + '22' : 'transparent' }]}>
                    <Text style={{ color: c.text, fontSize: 12 }} numberOfLines={1}>{d.rowJSON.cipher ? `${d.rowJSON.cipher} · ` : ''}{d.rowJSON.title || docKindTitle(d.rowJSON.docKind, { gost, t: pmT })}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.bar}>
              <SegmentButtonsApp testID="estimation-layout" onInfo={setHelpLayout} value={layout} onValueChange={setLayout} buttons={ESTIMATION_LAYOUTS.map((l) => ({ value: l.value, label: pmT(l.label), tip: l.tip ? pmT(l.tip) : undefined, testID: `estimation-layout-${l.value}` }))} />
              <SegmentButtonsApp
                testID="estimation-basis"
                // right justified in the row of the layout buttons
                style={{ marginLeft: 'auto' }}
                value={basis}
                onValueChange={setBasis}
                buttons={(['budget', 'accounting', 'consolidation'] as const).map((b) => ({ value: b, label: `${currencies[b]} ${pmT(BASIS_LABELS[b])}`.trim(), tip: `${pmT(BASIS_TIPS[b].name)}${currencies[b] ? ` (${currencies[b]})` : ''}: ${pmT(BASIS_TIPS[b].description)}` }))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <PMProjectTreeHost projectGUID={projectGUID!} readOnly={readOnly} renderRight={estimatePane} fabId="estimation-tree" labels={ESTIMATION_TREE_LABELS} emptyText={pmT('This project has no lines yet. The estimate is made per line: add the first section, then its lines.')} />
            </View>
          </View>
        ) : tab === 'document' ? (
          doc ? <EstimationSettingsPanel document={doc} layout={layout} readOnly={readOnly} currencies={currencies} gost={gost} onChange={data.changeDocument as any} onReadRates={() => { void readRates(); }} /> : <Text style={{ color: c.text, padding: 16 }}>{pmT('Open or make an estimate first (Estimate tab).')}</Text>
        ) : tab === 'norms' ? (
          <>
            <NormBookPanel client={client} canManage={canManage} version={normsVersion} onAddNorm={doc && !readOnly ? addNorm : null} onImport={() => setImportOpen(true)} onExport={(g) => setExportBook(g)} />
            <ImportNormBooks visible={importOpen} client={client} canTranslate={perms.canTranslateCatalog} onClose={(changed) => { setImportOpen(false); if (changed) setNormsVersion((v) => v + 1); }} />
            <ExportNormBooks visible={!!exportBook} client={client} bookGUID={exportBook} onClose={() => setExportBook(null)} />
          </>
        ) : tab === 'templates' ? (
          <EstimationTemplatesPanel projectGUID={projectGUID!} documentGUID={data.documentGUID} canEdit={!readOnly} gost={gost} currency={currencies.budget} onCreateExample={createExample} onImportTable={importTable} />
        ) : tab === 'summary' ? (
          <EstimationSummaryPanel client={client} projectGUID={projectGUID!} documents={data.documents} currency={currencies.budget} onSettings={setSummarySettings as any} />
        ) : (
          <EstimationExportPanel client={client} projectGUID={projectGUID!} documents={data.documents} gost={gost} basis={basis} currency={basisCurrency} summary={summarySettings} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // zIndex: the dropdown of the project field opens OVER the tab bar and the body below (a sibling later in the tree would be drawn above it)
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 4, paddingHorizontal: 12, paddingVertical: 4, borderBottomWidth: 1, position: 'relative', zIndex: 100, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, flexWrap: 'wrap' },
  h1: { fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10 },
  body: { flex: 1, padding: 12 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  docs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 200 },
  docChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 320 },
  // the bar above the grid is as high as the toolbar of the tree (the header of the grid then stands level with the header of the tree)
  paneBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  paneTotals: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden' },
});
