// EstimationDashboard - the workbench of an estimate: inputs, edits and saves estimates, keeps the norm books, and exports Excel / PDF. Design: documentation/ESTIMATION/dashboard/claude/
// ESTIMATION_DASHBOARD_WBS.html (+ google/). Route /pm/project/estimation/dashboard (Drawer: right under Project Dashboard). WEB FIRST.
//   Which project: ?projectGUID=... or the project selected in the project dashboard; when that project names an ESTIMATION project (Project settings -> Estimation) this one is edited,
//   else the project itself.
//   Estimate tab = the Project dashboard with the estimate instead of the Gantt chart: [ task tree of the estimation project | the estimate of the PICKED task ] (view/project/tree/PMProjectTreeHost, a stage shows
//          the lines of every task below it; a line belongs to a task by rowJSON.taskGUID; "Whole estimate" shows all lines, also the ones with no task)
//   Tabs:  Estimate (the board: 4 layouts, every cell edited in place, three currencies) · Document (its settings) · Norm books (tree World Norms v2, import / export zip) · Templates (examples +
//          input / output) · Summary (chapters 1 - 12) · Export (Excel, PDF)
//   Rights: permissionEstimationManager (SQL PART 58: the organization administrator and a project manager automatically) writes; everybody who can read the project reads.
//   Wording: neutral English unless the project switch useGOSTInformationInDocuments is ON (then the forms of the Methodology are named). Every text is a pmT key (14 languages).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { useSupabase } from '../../providers/WithSupabase';
import { useMyOrganization } from '../../catalog/organization/useMyOrganization';
import { usePermissions } from '../../permissions/usePermissions';
import SegmentButtonsApp from '../../ui/components/common/SegmentButtonsApp';
import ScrollableTabBar from '../../ui/components/tabs/ScrollableTabBar';
import { useReadProjectQuery } from '../crud/project/projectQueries';
import { pmT } from '../i18n/pmT';
import { PMDialogButton } from '../inner/buttons/PMDialogButton';
import { usePMStore } from '../store/store_pm';
import { estimationLinkOf } from '../view/project/estimation/estimationModel';
import { readCurrencyRate } from '../view/project/estimation/estimationApi';
import { applyNormToLine, newLineRow, type DocumentRow } from './model/estimationDocumentModel';
import { newDocumentRow } from './model/estimationDocumentModel';
import { BASIS_TIPS, BASIS_TO_SUM_KEY, useGOSTInformationOf, type EstimationCurrencyBasis, type EstimationDocKind } from './model/estimationModel';
import EstimateSheet, { ESTIMATION_LAYOUTS, type EstimationLayout } from './ui/EstimateSheet';
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
import { calcDocument } from './model/estimationCalc';
import { assignLinesToTask, canCarryEstimate, taskKindOf, linesOfScope, stageTotals, taskPaneState, unassignedLines } from './model/estimationTaskModel';
import EstimationStageTotals from './ui/EstimationStageTotals';
import PMProjectTreeHost from '../view/project/tree/PMProjectTreeHost';
import type { PMPalette } from '../view/theme';

type TabId = 'estimate' | 'document' | 'norms' | 'templates' | 'summary' | 'export';
const TABS: { id: TabId; label: string }[] = [
  { id: 'estimate', label: 'Estimate' }, { id: 'document', label: 'Document settings' }, { id: 'norms', label: 'Norm books' }, { id: 'templates', label: 'Templates' }, { id: 'summary', label: 'Summary' }, { id: 'export', label: 'Export' },
];
const fmt = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BASIS_LABELS: Record<EstimationCurrencyBasis, string> = { budget: 'Budget', accounting: 'Accounting', consolidation: 'Consolidation' };

export default function EstimationDashboard() {
  const { themeColors: c } = useDesignSystem();
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
  const [basis, setBasis] = useState<EstimationCurrencyBasis>('budget');
  const [importOpen, setImportOpen] = useState(false);
  const [exportBook, setExportBook] = useState<string | null>(null);
  const [normsVersion, setNormsVersion] = useState(0);
  const [summarySettings, setSummarySettings] = useState({ contingencyPct: 2, vatPct: 20, objectKind: 'nonProduction' as any });
  const [note, setNote] = useState('');
  // the position whose norm is being selected (the norm button of the sheet opens the norm books in a window)
  const [normLine, setNormLine] = useState<string | null>(null);
  // the row picked in the task tree (PM store) and what it shows: its own lines, or the whole estimate
  const pickedRaw = usePMStore((s: any) => s.selectedGUID) as string | null;
  const pickedTask = usePMStore((s: any) => (pickedRaw && s.tasksById?.[pickedRaw] ? pickedRaw : null)) as string | null;
  const pickedTitle = usePMStore((s: any) => (pickedRaw ? String(s.tasksById?.[pickedRaw]?.rowJSON?.taskDescription ?? '') : '')) as string;
  const childrenById = usePMStore((s: any) => s.tree?.childrenById) as Record<string, string[]> | undefined;
  const [wholeEstimate, setWholeEstimate] = useState(false);
  const tasksById = usePMStore((s: any) => s.tasksById) as Record<string, any> | undefined;
  const pickedCanCarry = !!pickedTask && canCarryEstimate(taskKindOf(tasksById?.[pickedTask]), (childrenById?.[pickedTask]?.length ?? 0) > 0);
  const pane = useMemo(() => taskPaneState(pickedTask, wholeEstimate, childrenById ?? {}, (g) => taskKindOf(tasksById?.[g])), [pickedTask, wholeEstimate, childrenById, tasksById]);
  // a row that is no task (a stage) shows the TOTALS of the tasks below it instead of the estimate
  const stageView = !!pickedTask && !wholeEstimate && pane.addBlocked;
  const stageRows = useMemo(
    () => (stageView && pickedTask ? stageTotals(pickedTask, childrenById ?? {}, (g) => ({ rowKind: taskKindOf(tasksById?.[g]), title: String(tasksById?.[g]?.rowJSON?.taskDescription ?? '') }), data.lines, data.document?.rowJSON) : null),
    [stageView, pickedTask, childrenById, tasksById, data.lines, data.document],
  );
  const shownLines = useMemo(() => (pane.scope ? linesOfScope(data.lines, pane.scope) : data.lines), [pane.scope, data.lines]);
  const shownCalc = useMemo(() => (pane.scope ? calcDocument(shownLines, data.document?.rowJSON) : data.calc), [pane.scope, shownLines, data.document, data.calc]);
  const unassignedCount = useMemo(() => unassignedLines(data.lines).length, [data.lines]);

  const currencies = useMemo(() => ({
    budget: String(projectJSON.currencyForBudget ?? ''), accounting: String(projectJSON.currencyForAccounting ?? ''), consolidation: String(organizationJSON?.currencyForConsolidation ?? ''),
  }), [projectJSON, organizationJSON]);
  const basisCurrency = currencies[basis] || '';
  const doc = data.document;
  const totals = shownCalc.total;
  const shownTotal = doc ? shownCalc.sums[BASIS_TO_SUM_KEY[basis]] : 0;

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
      ...(pane.newLineTaskGUID ? { taskGUID: pane.newLineTaskGUID } : {}),
      title, normCode: norm.rowJSON.code, normGUID: norm.rowGUID, unit: norm.rowJSON.unit, qty: 1,
      unitLabour: costs.unitLabour, unitMachines: costs.unitMachines, unitOperators: costs.unitOperators, unitMaterials: costs.unitMaterials, unitOther: costs.unitOther, unitEquipment: costs.unitEquipment,
    })]);
    setNote(costs.missing.length ? pmT('The norm was added. {{n}} resource(s) have no price in the book: price them in the board.', { n: costs.missing.length }) : pmT('The norm was added to the estimate.'));
    setTab('estimate');
  }, [data, doc, projectGUID, pane.newLineTaskGUID]);

  // the norm chosen in the window goes INTO the position line that asked for it (its unit costs come from the priced resources of the book)
  const selectNorm = useCallback((norm: any, costs: any, title: string) => {
    const target = normLine;
    setNormLine(null);
    if (!target) return;
    data.changeLines((prev) => prev.map((l) => (l.rowGUID === target ? applyNormToLine(l, norm, costs, title) : l)));
    setNote(costs.missing.length ? pmT('The norm was set. {{n}} resource(s) have no price in the book: price them in the board.', { n: costs.missing.length }) : pmT('The norm was set on the position.'));
  }, [data, normLine]);

  const estimatePane = (_area: { width: number; height: number; palette: PMPalette }) => (
          <View style={{ flex: 1, padding: 8 }}>
            <View style={styles.bar}>
              <View style={styles.docs}>
                {data.documents.map((d) => (
                  <Pressable key={d.rowGUID} testID={`estimation-doc-${d.rowGUID}`} onPress={() => data.selectDocument(d.rowGUID)} style={[styles.docChip, { borderColor: d.rowGUID === data.documentGUID ? c.primary : c.border, backgroundColor: d.rowGUID === data.documentGUID ? c.primary + '22' : 'transparent' }]}>
                    <Text style={{ color: c.text, fontSize: 12 }} numberOfLines={1}>{d.rowJSON.cipher ? `${d.rowJSON.cipher} · ` : ''}{d.rowJSON.title || docKindTitle(d.rowJSON.docKind, { gost, t: pmT })}</Text>
                  </Pressable>
                ))}
              </View>
              <PMDialogButton testID="estimation-new-document" kind="primary" icon="note_add" title={pmT('New estimate')} disabled={readOnly} onPress={() => { void newDocument('local'); }} />
              <PMDialogButton testID="estimation-new-quote" kind="secondary" icon="request_quote" title={pmT('New quotation')} disabled={readOnly} onPress={() => { void newDocument('bid'); }} />
              {!!doc && <PMDialogButton testID="estimation-delete-document" kind="dangerOutlined" icon="delete" title={pmT('Delete estimate')} disabled={readOnly} onPress={() => { void data.deleteDocument(doc.rowGUID); }} />}
            </View>
            <View style={styles.bar}>
              <SegmentButtonsApp testID="estimation-layout" value={layout} onValueChange={setLayout} buttons={ESTIMATION_LAYOUTS.map((l) => ({ value: l.value, label: pmT(l.label), tip: l.tip ? pmT(l.tip) : undefined, testID: `estimation-layout-${l.value}` }))} />
              <SegmentButtonsApp
                testID="estimation-basis"
                value={basis}
                onValueChange={setBasis}
                buttons={(['budget', 'accounting', 'consolidation'] as const).map((b) => ({ value: b, label: `${currencies[b]} ${pmT(BASIS_LABELS[b])}`.trim(), tip: `${pmT(BASIS_TIPS[b].name)}${currencies[b] ? ` (${currencies[b]})` : ''}: ${pmT(BASIS_TIPS[b].description)}` }))}
              />
            </View>
            <View style={styles.bar}>
              <Text testID="estimation-pane-title" numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 14, flexShrink: 1 }}>
                {pane.scope ? `${pmT('Task')}: ${pickedTitle || '-'}${pane.addBlocked ? ` (${pmT('stage: the totals of the tasks below it')})` : ''}` : pmT('Whole estimate')}
              </Text>
              {!!pickedTask && <PMDialogButton testID="estimation-scope-toggle" kind="secondary" icon={wholeEstimate ? 'account_tree' : 'select_all'} title={wholeEstimate ? pmT('Show the picked task') : pmT('Show the whole estimate')} onPress={() => setWholeEstimate((v) => !v)} />}
            </View>
            {!doc ? (
              <View style={{ padding: 16, gap: 8 }}>
                <Text style={{ color: c.text }}>{data.loading ? pmT('Reading...') : pmT('No estimate in this project yet.')}</Text>
                <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('Make one with New estimate, or start from an example in the Templates tab.')}</Text>
              </View>
            ) : stageRows ? (
              <EstimationStageTotals totals={stageRows} basis={basis} currency={basisCurrency} emptyTitle={pmT('Task')} />
            ) : (
              <>
                <EstimateSheet projectGUID={projectGUID!} document={doc} lines={shownLines} calc={shownCalc} layout={layout} basis={basis} readOnly={readOnly} onChangeLines={data.changeLines} onDeleteLines={data.deleteLines}
                  newLineTaskGUID={pane.newLineTaskGUID} addBlocked={pane.addBlocked} onSelectNorm={readOnly ? undefined : setNormLine}
                  assignTo={wholeEstimate && pickedTask && pickedCanCarry ? { guid: pickedTask, title: pickedTitle || pmT('Task') } : null}
                  onAssign={(guids) => { if (pickedTask && pickedCanCarry) data.changeLines((prev) => assignLinesToTask(prev, guids, pickedTask)); }} />
                <View testID="estimation-totals" style={[styles.totals, { borderTopColor: c.border, backgroundColor: c.surface }]}>
                  <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Direct costs')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.direct)}</Text></Text>
                  <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Overheads')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.overheads)}</Text></Text>
                  <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Profit')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.profit)}</Text></Text>
                  <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Total, base prices')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.base)}</Text></Text>
                  <Text style={{ color: c.text, fontSize: 13 }}>{pmT('Total, current prices')}: <Text style={{ fontWeight: '700' }}>{fmt(totals.current)}</Text></Text>
                  <Text testID="estimation-total-shown" style={{ color: c.primary, fontSize: 14, fontWeight: '800' }}>{pmT('In the view currency')} {basisCurrency}: {fmt(shownTotal)}</Text>
                </View>
                {!!pane.scope && !shownLines.length && (
                  <Text testID="estimation-task-empty" style={{ color: c.text, opacity: 0.7, fontSize: 12, paddingVertical: 6 }}>
                    {pmT('No lines for this row yet.')}{pane.addBlocked ? '' : ` ${pmT('Add a position, then select its norm from the norm book.')}`}{unassignedCount ? ` ${pmT('{{n}} line(s) of this estimate have no task: show the whole estimate to give them to a task.', { n: unassignedCount })}` : ''}
                  </Text>
                )}
              </>
            )}
          </View>
  );

  const ready = !!projectGUID;
  const saveLabel = data.saveState === 'saving' ? pmT('Saving...') : data.saveState === 'error' ? pmT('Not saved') : data.saveState === 'saved' ? pmT('Saved') : '';

  return (
    <View testID="estimation-dashboard" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={[styles.h1, { color: c.text }]}>{pmT('Estimation dashboard')}</Text>
          <Text numberOfLines={2} style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>
            {ready ? `${pmT('Project')}: ${String(projectJSON.name ?? '')}${editsLinked ? ` · ${pmT('its estimation project is edited')}` : ''}` : pmT('Pick a project below or make a new one for the estimation.')}
            {readOnly && ready ? ` · ${canManage ? pmT('read-only project') : pmT('you may read, not change (permissionEstimationManager)')}` : ''}
          </Text>
        </View>
        {!!saveLabel && <Text testID="estimation-save-state" style={{ color: data.saveState === 'error' ? c.error : c.text, opacity: 0.8, fontSize: 12 }}>{saveLabel}</Text>}
        <PMDialogButton testID="estimation-change-project" kind="secondary" icon="folder_open" title={pmT('Change project')} onPress={() => setPickerOpen(true)} />
        <PMDialogButton testID="estimation-reload" kind="secondary" icon="refresh" title={pmT('Reload')} disabled={!ready} onPress={data.reload} />
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

      <SelectNormWindow visible={!!normLine} client={client} onSelect={selectNorm} onClose={() => setNormLine(null)} />
      <View style={styles.body}>
        {!ready || pickerOpen ? (
          <EstimationProjectPicker onPicked={(g) => { setPickedGUID(g); setPickerOpen(false); setTab('estimate'); }} onCancel={ready ? () => setPickerOpen(false) : undefined} />
        ) : tab === 'estimate' ? (
          <PMProjectTreeHost projectGUID={projectGUID!} readOnly={readOnly} renderRight={estimatePane} fabId="estimation-tree" emptyText={pmT('This project has no tasks yet. The estimate is made per task: add the first stage, then its tasks.')} />
        ) : tab === 'document' ? (
          doc ? <EstimationSettingsPanel document={doc} layout={layout} readOnly={readOnly} currencies={currencies} gost={gost} onChange={data.changeDocument as any} onReadRates={() => { void readRates(); }} /> : <Text style={{ color: c.text, padding: 16 }}>{pmT('Open or make an estimate first (Estimate tab).')}</Text>
        ) : tab === 'norms' ? (
          <>
            <NormBookPanel client={client} canManage={canManage} version={normsVersion} onAddNorm={doc && !readOnly ? addNorm : null} onImport={() => setImportOpen(true)} onExport={(g) => setExportBook(g)} />
            <ImportNormBooks visible={importOpen} client={client} canTranslate={perms.canTranslateCatalog} onClose={(changed) => { setImportOpen(false); if (changed) setNormsVersion((v) => v + 1); }} />
            <ExportNormBooks visible={!!exportBook} client={client} bookGUID={exportBook} onClose={() => setExportBook(null)} />
          </>
        ) : tab === 'templates' ? (
          <EstimationTemplatesPanel projectGUID={projectGUID!} documentGUID={data.documentGUID} canEdit={!readOnly} gost={gost} currency={currencies.budget} onCreateExample={async (k) => { await data.createFromExample(k); setTab('estimate'); }} onAddLines={(ls) => data.changeLines((prev) => [...prev, ...ls.map((l, i) => ({ ...l, orderInList: prev.reduce((m, p) => Math.max(m, p.orderInList), 0) + (i + 1) * 10 }))])} />
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, flexWrap: 'wrap' },
  h1: { fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 10 },
  body: { flex: 1, padding: 12 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 8 },
  docs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 200 },
  docChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 320 },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1 },
});
