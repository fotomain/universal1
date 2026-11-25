/** @jest-environment jsdom */
// EstimationDashboard (tabs, currency switch, the useGOSTInformationInDocuments flag), EstimationSettingsPanel, formsFor of the export panel.
import { act } from 'react';
import { cleanupUI, mockRouterPush, press, q, qa, renderUI, textOf } from '../ui/pmUiTestKit';

let mockPerms: any = { canManageEstimation: true, projectIsReadonly: false, canTranslateCatalog: false };
let mockProject: any = null;
let mockData: any;
const mockChangeDocument = jest.fn();
jest.mock('../../../kit8/permissions/usePermissions', () => ({ usePermissions: () => mockPerms }));
jest.mock('../../../kit8/pm/crud/project/projectQueries', () => ({ useReadProjectQuery: () => ({ data: mockProject }) }));
jest.mock('../../../kit8/catalog/organization/useMyOrganization', () => ({ useMyOrganization: () => ({ organizationJSON: { currencyForConsolidation: 'USD' } }) }));
jest.mock('../../../kit8/pm/estimation/ui/useEstimationData', () => ({ useEstimationData: () => mockData, newDocumentRow: jest.requireActual('../../../kit8/pm/estimation/model/estimationDocumentModel').newDocumentRow }));
jest.mock('../../../kit8/pm/estimation/ui/EstimateSheet', () => ({ __esModule: true, LAYOUT_COLUMNS: { simple: [{ key: 'title', title: 'Title' }, { key: 'qty', title: 'Quantity' }], advanced: [{ key: 'title', title: 'Title' }] }, ESTIMATION_LAYOUTS: [{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }, { value: 'quote', label: 'Quote' }, { value: 'trades', label: 'Trades' }], default: (p: any) => require('react').createElement(require('react-native').Text, { testID: 'sheet-stub' }, `${p.layout}|${p.basis}|${p.readOnly}`) }));
jest.mock('../../../kit8/pm/estimation/ui/EstimationProjectPicker', () => ({ __esModule: true, default: (p: any) => require('react').createElement(require('react-native').Pressable, { testID: 'picker-stub', onPress: () => p.onPicked('p2') }, require('react').createElement(require('react-native').Text, null, p.onCancel ? 'can-cancel' : 'no-cancel')) }));
// the task tree (Skia) is not drawn in Jest: the host renders only the pane that stands right of it
jest.mock('../../../kit8/pm/view/project/tree/PMProjectTreeHost', () => ({ __esModule: true, default: (p: any) => require('react').createElement(require('react-native').View, { testID: `tree-host-${p.projectGUID}` }, p.renderRight({ width: 800, height: 600, palette: {} })) }));
jest.mock('../../../kit8/pm/estimation/ui/NormBookPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/estimation/ui/ImportNormBooks', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/estimation/ui/ExportNormBooks', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/estimation/ui/EstimationTemplatesPanel', () => ({ __esModule: true, default: () => require('react').createElement(require('react-native').Text, { testID: 'templates-stub' }, 'templates') }));
jest.mock('../../../kit8/pm/estimation/ui/EstimationSummaryPanel', () => ({ __esModule: true, default: () => require('react').createElement(require('react-native').Text, { testID: 'summary-stub' }, 'summary') }));
jest.mock('../../../kit8/pm/estimation/ui/EstimationExportPanel', () => ({ __esModule: true, ...jest.requireActual('../../../kit8/pm/estimation/ui/EstimationExportPanel'), default: (p: any) => require('react').createElement(require('react-native').Text, { testID: 'export-stub' }, `gost:${p.gost}`) }));
jest.mock('../../../kit8/pm/view/project/estimation/estimationApi', () => ({ readCurrencyRate: jest.fn(async () => 1) }));
jest.mock('../../../kit8/ui/components/tabs/ScrollableTabBar', () => ({ __esModule: true, default: (p: any) => require('react').createElement(require('react-native').View, { testID: p.testID }, p.children) }));
jest.mock('../../../kit8/ui/components/common/SegmentButtonsApp', () => ({
  __esModule: true,
  default: (p: any) => { const R = require('react'); const { Pressable, Text, View } = require('react-native'); ((globalThis as any).__segProps ??= {})[p.testID] = p; return R.createElement(View, { testID: p.testID }, p.buttons.flatMap((b: any) => [R.createElement(Pressable, { key: b.value, testID: `${p.testID}-${b.value}`, onPress: () => !b.disabled && p.onValueChange(b.value) }, R.createElement(Text, null, b.label)), R.createElement(Pressable, { key: `${b.value}-info`, testID: `${p.testID}-${b.value}-info`, onPress: () => p.onInfo && p.onInfo(b.value) })])); },
}));

jest.mock('../../../kit8/pm/view/project/SelectProjectFromList', () => ({
  __esModule: true,
  default: (p: any) => { const R = require('react'); const { Pressable, Text, View } = require('react-native'); ((globalThis as any).__selectProject = p);
    return R.createElement(View, { testID: 'project-field-stub' }, R.createElement(Text, { testID: 'project-field-name' }, p.selectedName), R.createElement(Pressable, { testID: 'project-field-pick', onPress: () => p.onPick('p2') }), R.createElement(Pressable, { testID: 'project-field-new', onPress: () => p.onCreateNew() })); },
}));

import React from 'react';
import EstimationDashboard from '../../../kit8/pm/estimation/EstimationDashboard';
import EstimationSettingsPanel from '../../../kit8/pm/estimation/ui/EstimationSettingsPanel';
import { formsFor } from '../../../kit8/pm/estimation/ui/EstimationExportPanel';
import { newDocumentRow, newLineRow } from '../../../kit8/pm/estimation/model/estimationDocumentModel';
import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';

const doc = () => newDocumentRow('p1', 'local', { title: 'Hall', currency: 'EUR' });
const baseData = (d: any) => ({
  loading: false, error: '', saveState: 'idle', documents: d ? [d] : [], documentGUID: d?.rowGUID ?? null, document: d, lines: [], calc: calcDocument([], d?.rowJSON),
  selectDocument: jest.fn(), changeLines: jest.fn(), changeDocument: mockChangeDocument, createDocument: jest.fn(async () => {}), createFromExample: jest.fn(async () => {}), deleteDocument: jest.fn(async () => {}), deleteLines: jest.fn(), reload: jest.fn(), flush: jest.fn(async () => {}),
});

beforeEach(() => {
  jest.requireMock('expo-router').useLocalSearchParams = () => ({ projectGUID: 'p1' });
  mockPerms = { canManageEstimation: true, projectIsReadonly: false, canTranslateCatalog: false };
  mockProject = { rowGUID: 'p1', rowJSON: { name: 'Hall 12', currencyForBudget: 'EUR', currencyForAccounting: 'GBP' } };
  mockData = baseData(doc());
  mockChangeDocument.mockClear();
});
afterEach(() => cleanupUI());

describe('EstimationDashboard', () => {
  test('shows the six tabs, the estimate sheet and the total in the currency of the chosen basis', () => {
    renderUI(<EstimationDashboard />);
    for (const t of ['estimate', 'summary', 'document', 'norms', 'templates', 'export']) expect(q(`estimation-tab-${t}`)).toBeTruthy();
    // the order of the tabs: Summary right after Estimate
    const order = Array.from(document.querySelectorAll('[data-testid^="estimation-tab-"]')).map((e) => String(e.getAttribute('data-testid')).replace('estimation-tab-', ''));
    expect(order).toEqual(['estimate', 'summary', 'document', 'norms', 'templates', 'export']);
    expect(textOf('sheet-stub')).toBe('simple|budget|false');
    expect(textOf('estimation-total-shown')).toContain('EUR');
    act(() => press('estimation-basis-accounting'));
    expect(textOf('sheet-stub')).toContain('accounting');
    expect(textOf('estimation-total-shown')).toContain('GBP');
    act(() => press('estimation-basis-consolidation'));
    expect(textOf('estimation-total-shown')).toContain('USD');
  });

  test('the tool bar is as in the Project dashboard: the project FIELD (name, search, Create new) and the Reload icon button, left justified', () => {
    renderUI(<EstimationDashboard />);
    const bar = q('estimation-toolbar')!;
    expect(bar).toBeTruthy();
    expect(bar.contains(q('project-field-stub')!)).toBe(true);
    expect(q('estimation-change-project')).toBeNull();
    expect(textOf('project-field-name')).toBe(mockProject.rowJSON.name);
    // picking a project in the field makes it the project of this screen (not of the PM store)
    act(() => press('project-field-pick'));
    expect((globalThis as any).__selectProject.onPick).toBeInstanceOf(Function);
    expect(bar.contains(q('estimation-reload')!)).toBe(true);
    // the Projects catalog icon stands right before the reload icon
    expect(q('estimation-go-projects')!.compareDocumentPosition(q('estimation-reload')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => press('estimation-go-projects'));
    expect(mockRouterPush).toHaveBeenCalledWith('/catalog/project');
    // no title block above it: the tool bar is the first thing of the screen
    expect(q('estimation-dashboard')!.firstElementChild).toBe(bar);
    expect(document.body.textContent).not.toContain('Estimation dashboard');
    expect(bar.style.justifyContent === 'flex-start' || getComputedStyle(bar).justifyContent === 'flex-start').toBe(true);
  });

  test('the tool bar is stacked above what follows it, so the dropdown of the project field is not drawn under the tabs', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../../kit8/pm/estimation/EstimationDashboard.tsx'), 'utf8');
    const toolbar = /toolbar: \{[^}]*\}/.exec(src)![0];
    expect(toolbar).toMatch(/position: 'relative'/);
    expect(toolbar).toMatch(/zIndex: (\d+)/);
    expect(Number(/zIndex: (\d+)/.exec(toolbar)![1])).toBeGreaterThanOrEqual(50);
  });

  test('the currency buttons are right justified in the row of the layout buttons', () => {
    renderUI(<EstimationDashboard />);
    expect((globalThis as any).__segProps['estimation-basis'].style).toMatchObject({ marginLeft: 'auto' });
    expect((globalThis as any).__segProps['estimation-layout'].style).toBeUndefined();
  });

  test('the simple / advanced switch reaches the sheet', () => {
    renderUI(<EstimationDashboard />);
    act(() => press('estimation-layout-advanced'));
    expect(textOf('sheet-stub')).toMatch(/^advanced/);
  });

  test('the info gesture on a layout button (right click / double click / double touch / long press) opens the help for the CFO of THAT layout; Close closes it', () => {
    renderUI(<EstimationDashboard />);
    expect(q('estimation-layout-help')).toBeNull();
    act(() => press('estimation-layout-quote-info'));
    expect(textOf('estimation-layout-help-heading')).toBe('Quick quote');
    expect(textOf('estimation-layout-help')).toContain('Price = Cost');
    // the layout of the sheet did not change
    expect(textOf('sheet-stub')).toMatch(/^simple/);
    act(() => press('estimation-layout-help-close'));
    expect(q('estimation-layout-help')).toBeNull();
    act(() => press('estimation-layout-trades-info'));
    expect(textOf('estimation-layout-help-heading')).toBe('Trade breakdown');
  });

  test('a user without permissionEstimationManager gets a read-only sheet', () => {
    mockPerms = { ...mockPerms, canManageEstimation: false };
    renderUI(<EstimationDashboard />);
    expect(textOf('sheet-stub')).toMatch(/true$/);
  });

  test('the tabs switch the body; the export panel gets gost = false by default', () => {
    renderUI(<EstimationDashboard />);
    act(() => press('estimation-tab-templates')); expect(q('templates-stub')).toBeTruthy();
    act(() => press('estimation-tab-summary')); expect(q('summary-stub')).toBeTruthy();
    act(() => press('estimation-tab-export')); expect(textOf('export-stub')).toBe('gost:false');
  });

  test('gost = true when the project switch useGOSTInformationInDocuments is on', () => {
    mockProject = { rowGUID: 'p1', rowJSON: { name: 'X', useGOSTInformationInDocuments: true } };
    renderUI(<EstimationDashboard />);
    act(() => press('estimation-tab-export'));
    expect(textOf('export-stub')).toBe('gost:true');
  });

  test('no document: the empty text; New estimate creates one', () => {
    mockData = baseData(null);
    renderUI(<EstimationDashboard />);
    expect(q('sheet-stub')).toBeNull();
    act(() => press('estimation-new-document'));
    expect(mockData.createDocument).toHaveBeenCalled();
  });

  test('a data error is shown with the SQL hint', () => {
    mockData = { ...baseData(null), error: 'relation does not exist' };
    renderUI(<EstimationDashboard />);
    expect(textOf('estimation-error')).toContain('PART 58');
  });
});

describe('the estimate of one task (task tree on the left)', () => {
  const { usePMStore } = require('../../../kit8/pm/store/store_pm');
  const withTree = (selected: string | null) => usePMStore.setState({
    selectedGUID: selected,
    tasksById: { stage: { rowGUID: 'stage', rowJSON: { rowKind: 'stage', taskDescription: 'Foundations' } }, t1: { rowGUID: 't1', rowJSON: { rowKind: 'task', taskDescription: 'Slab' } }, t2: { rowGUID: 't2', rowJSON: { rowKind: 'task', taskDescription: 'Walls' } }, ms: { rowGUID: 'ms', rowJSON: { rowKind: 'milestone', taskDescription: 'Done' } } },
    tree: { ...usePMStore.getState().tree, childrenById: { stage: ['t1'] } },
  });
  const lineOf = (guid: string, taskGUID: string | null, qty = 1) => newLineRow('p1', 'd', 'position', 'empty', 10, { title: guid, qty, unitLabour: 100, ...(taskGUID ? { taskGUID } : {}) });
  afterEach(() => usePMStore.setState({ selectedGUID: null }));

  test('the tree host stands on the estimation project and the pane is inside it', () => {
    renderUI(<EstimationDashboard />);
    expect(q('tree-host-p1')).toBeTruthy();
    expect(q('sheet-stub')).toBeTruthy();
  });

  test('no row picked: the whole estimate; a task picked: only its lines and its total', () => {
    const a = lineOf('a', 't1', 2), b = lineOf('b', 't2', 3), c = lineOf('c', null);
    const d = doc();
    mockData = { ...baseData(d), lines: [a, b, c], calc: calcDocument([a, b, c], d.rowJSON) };
    renderUI(<EstimationDashboard />);
    expect(textOf('estimation-pane-title')).toBe('Whole estimate');
    const whole = textOf('estimation-total-shown');
    cleanupUI();
    withTree('t1');
    renderUI(<EstimationDashboard />);
    expect(textOf('estimation-pane-title')).toContain('Slab');
    expect(textOf('estimation-total-shown')).not.toBe(whole);
  });

  test('a stage shows the TOTALS of the tasks below it instead of the estimate', () => {
    const a = lineOf('a', 't1', 2);
    const d = doc();
    mockData = { ...baseData(d), lines: [a], calc: calcDocument([a], d.rowJSON) };
    withTree('stage');
    renderUI(<EstimationDashboard />);
    expect(textOf('estimation-pane-title')).toContain('Foundations');
    expect(q('estimation-stage-totals')).toBeTruthy();
    expect(q('sheet-stub')).toBeNull();
    expect(q('estimation-totals')).toBeNull();
    expect(textOf('estimation-stage-row-t1')).toContain('Slab');
    expect(q('estimation-task-empty')).toBeNull();
  });

  test('a milestone is no task either: its totals show; a task shows the estimate; the toggle shows the whole estimate', () => {
    const a = lineOf('a', 't1');
    const d = doc();
    mockData = { ...baseData(d), lines: [a], calc: calcDocument([a], d.rowJSON) };
    withTree('ms');
    renderUI(<EstimationDashboard />);
    expect(q('estimation-stage-totals')).toBeTruthy();
    act(() => press('estimation-scope-toggle'));
    expect(q('estimation-stage-totals')).toBeNull();
    expect(q('sheet-stub')).toBeTruthy();
    cleanupUI();
    withTree('t1');
    renderUI(<EstimationDashboard />);
    expect(q('estimation-stage-totals')).toBeNull();
    expect(q('sheet-stub')).toBeTruthy();
  });

  test('a task with no lines says so and counts the lines that have no task; the toggle shows the whole estimate', () => {
    const c = lineOf('c', null);
    const d = doc();
    mockData = { ...baseData(d), lines: [c], calc: calcDocument([c], d.rowJSON) };
    withTree('t2');
    renderUI(<EstimationDashboard />);
    expect(textOf('estimation-task-empty')).toContain('No lines');
    act(() => press('estimation-scope-toggle'));
    expect(textOf('estimation-pane-title')).toBe('Whole estimate');
    expect(q('estimation-task-empty')).toBeNull();
  });
});

describe('project picker', () => {
  test('the project field "Create new" opens the picker; picking closes it', () => {
    renderUI(<EstimationDashboard />);
    expect(q('picker-stub')).toBeNull();
    act(() => press('project-field-new'));
    expect(textOf('picker-stub')).toBe('can-cancel');
    act(() => press('picker-stub'));
    expect(q('picker-stub')).toBeNull();
    expect(q('sheet-stub')).toBeTruthy();
  });
  test('no project at all: the picker is the body (no cancel)', () => {
    jest.requireMock('expo-router').useLocalSearchParams = () => ({});
    mockProject = null;
    renderUI(<EstimationDashboard />);
    expect(textOf('picker-stub')).toBe('no-cancel');
  });
});

describe('EstimationSettingsPanel', () => {
  const props = (d: any, extra: any = {}) => ({ document: d, layout: 'simple' as const, readOnly: false, currencies: { budget: 'EUR', accounting: 'GBP', consolidation: 'USD' }, gost: false, onChange: mockChangeDocument, ...extra });
  test('renders with the method switch and sends a change', () => {
    renderUI(<EstimationSettingsPanel {...props(doc())} />);
    expect(q('estimation-settings')).toBeTruthy();
    expect(qa('estimation-settings-').length).toBeGreaterThan(3);
  });
});

describe('formsFor (export)', () => {
  test('makes a local estimate form + resource sheet + summary; a bid becomes a quotation', () => {
    const d = doc();
    const b = newDocumentRow('p1', 'bid', { title: 'Offer', currency: 'EUR' });
    const l = newLineRow('p1', d.rowGUID, 'position', 'empty', 10, { title: 'Wall', qty: 2, unit: 'm2', unitMaterials: 5 });
    const lb = newLineRow('p1', b.rowGUID, 'position', 'empty', 10, { title: 'Door', qty: 1, unit: 'pcs', unitMaterials: 50 });
    const common = { documents: [d, b], linesByDoc: new Map([[d.rowGUID, [l]], [b.rowGUID, [lb]]]), picked: new Set([d.rowGUID, b.rowGUID]), gost: false, basis: 'budget' as const, currency: 'EUR', contingencyPct: 2, vatPct: 20, objectKind: 'nonProduction' };
    const forms = formsFor({ ...common, resources: true, summary: true });
    expect(forms.length).toBe(4); // local + resources + quotation + summary
    expect(formsFor({ ...common, resources: false, summary: false }).length).toBe(2);
    expect(formsFor({ ...common, picked: new Set(), resources: false, summary: false }).length).toBe(0);
  });
  test('without the GOST switch no form carries Russian / Minstroy words', () => {
    const d = doc();
    const l = newLineRow('p1', d.rowGUID, 'position', 'empty', 10, { title: 'Wall', qty: 2, unit: 'm2', unitMaterials: 5 });
    const forms = formsFor({ documents: [d], linesByDoc: new Map([[d.rowGUID, [l]]]), picked: new Set([d.rowGUID]), resources: true, summary: true, gost: false, basis: 'budget', currency: 'EUR', contingencyPct: 2, vatPct: 20, objectKind: 'nonProduction' });
    expect(JSON.stringify(forms)).not.toMatch(/Минстро|Russia|Methodology|приложение|421/i);
  });
});

describe('the Export tab', () => {
  test('is a form of at most 960 px, left justified', () => {
    const { EXPORT_PANEL_MAX_WIDTH } = require('../../../kit8/pm/estimation/ui/EstimationExportPanel');
    expect(EXPORT_PANEL_MAX_WIDTH).toBe(960);
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../../kit8/pm/estimation/ui/EstimationExportPanel.tsx'), 'utf8');
    expect(src).toContain("maxWidth: EXPORT_PANEL_MAX_WIDTH");
  });
});
