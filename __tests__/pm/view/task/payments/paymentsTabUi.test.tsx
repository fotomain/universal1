/** @jest-environment jsdom */
// The Payments tab of the Finances view of a task (PMTaskPaymentPlan inside PMProjectTaskInputCRUD): the fifth tab, the sub-tabs Outbound / Inbound / Cash flow (EMPTY), the payments of the direction,
// the fill buttons, the editable budget item, Post. The redux entity, the catalogs and the catalog selects are test doubles (the rules themselves: paymentPlan*.test.ts).
import React, { act } from 'react';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockRouterPush }), usePathname: () => '/pm/project/task', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
// the error window of Post (ErrorModalWindow -> ButtonApp) needs reanimated, which has no native module in jest
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View, createAnimatedComponent: (c: any) => c }, View, useSharedValue: (v: any) => ({ value: v }), useAnimatedStyle: () => ({}), withTiming: (v: any) => v, withSpring: (v: any) => v, runOnJS: (fn: any) => fn };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockActions = {
  readData: jest.fn((p: any) => ({ type: 'read', p })),
  createOne: jest.fn((p: any) => ({ type: 'create', p })),
  updateOne: jest.fn((p: any) => ({ type: 'update', p })),
  deleteOne: jest.fn((p: any) => ({ type: 'delete', p })),
};
jest.mock('../../../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: mockActions }) }) }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => {
  const actual = jest.requireActual('react-redux');
  const R = require('react');
  return {
    ...actual,
    // like the real hook with shallowEqual: the same result while the lists are the same
    useSelector: (fn: any, eq?: any) => {
      const ref = R.useRef(undefined);
      const v = fn(mockState);
      if (ref.current !== undefined && (eq ? eq(ref.current, v) : Object.is(ref.current, v))) return ref.current;
      ref.current = v;
      return v;
    },
    useDispatch: () => mockDispatch,
  };
});
// picker mode (view/project/pick): a test sets mockPicker; null = the normal Finances table
let mockPicker: any = null;
jest.mock('../../../../../kit8/pm/view/project/pick/pmPickerContext', () => ({ ...jest.requireActual('../../../../../kit8/pm/view/project/pick/pmPickerContext'), usePMPicker: () => mockPicker }));
// "Vendor Invoice" of a line asks the scope, then CREATES (useStartVendorInvoice; its own tests: documents/vendor/invoice/useVendorInvoice.test.tsx)
const mockStartVendorInvoice = jest.fn();
jest.mock('../../../../../kit8/documents/vendor/invoice/useVendorInvoice', () => ({ useStartVendorInvoice: () => ({ start: mockStartVendorInvoice, busy: false }) }));
// "Customer Invoice" / "Time sheet" of the Task menu items (useTaskRelatedMenu): their hooks need the Supabase provider
const mockStartCustomerInvoice = jest.fn();
jest.mock('../../../../../kit8/documents/customer/invoice/useCustomerInvoice', () => ({ useStartCustomerInvoice: () => ({ start: mockStartCustomerInvoice, busy: false }) }));
// "Payment fact" of the Task menu (useTaskRelatedMenu): its hook needs the Supabase / react-query providers (own tests: documents/payment/fact/usePaymentFact.test.tsx)
const mockStartPaymentFact = jest.fn();
jest.mock('../../../../../kit8/documents/payment/fact/usePaymentFact', () => ({ useStartPaymentFact: () => ({ start: mockStartPaymentFact, busy: false, error: null }) }));
const mockCreateTimesheet = jest.fn(async () => ({ status: 'created', documentGUID: 'ts-1', skipped: [] }));
jest.mock('../../../../../kit8/documents/timesheet/useTimesheet', () => ({ useCreateTimesheetFromTask: () => ({ create: (...a: any[]) => (mockCreateTimesheet as any)(...a), busy: false, error: null }) }));
const mockStartPurchaseOrder = jest.fn();
jest.mock('../../../../../kit8/documents/vendor/purchase_order/usePurchaseOrder', () => ({ useStartPurchaseOrder: () => ({ start: mockStartPurchaseOrder, busy: false }) }));
const mockPick: Record<string, string> = {};
const mockSelectProps: Record<string, any> = {};
jest.mock('../../../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '',
    default: (props: any) => {
      const { testID, value, onChange, disabled, entityName } = props;
      mockSelectProps[testID] = props;
      return R.createElement(Pressable, { testID, disabled, onPress: () => onChange(mockPick[entityName] ?? `${entityName}-picked`) }, R.createElement(Text, null, `${value ?? '-'}|${disabled ? 'off' : 'on'}`));
    },
  };
});
// the Budget item and Product cells: the window with folders (Tree | List). A stand-in with the props of the cell; a press chooses mockPick[the budget item catalog]
jest.mock('../../../../../kit8/catalog/select/with_folders/SelectCatalogItemWithFolders', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      const { testID, value, onChange, disabled } = props;
      const entityName = String(testID).endsWith('-product') ? 'productReusable' : 'budgetItemReusable';
      mockSelectProps[testID] = { ...props, entityName };
      return R.createElement(Pressable, { testID, disabled, onPress: () => onChange(mockPick[entityName] ?? `${entityName}-picked`) }, R.createElement(Text, null, `${value ?? '-'}|${disabled ? 'off' : 'on'}`));
    },
  };
});
jest.mock('../../../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.flatMap((i: any) => [i, ...(i.submenu || [])]).map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress, disabled: i.disabled }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ visible, onConfirm }: any) => (visible ? R.createElement(Pressable, { testID: 'confirm-sql_for_delete', onPress: onConfirm }, R.createElement(Text, null, 'Delete')) : null) };
});
// the exchange rates come from Supabase in the app: a stand-in book (null = still reading)
let mockBook: any = null;
jest.mock('../../../../../kit8/pm/view/task/finances/useLineRateBook', () => ({ useLineRateBook: (_codes: string[], enabled: boolean) => ({ book: enabled ? mockBook : null, loading: false, error: '' }) }));
let mockPM: any = {};
jest.mock('../../../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel(mockPM) }));
jest.mock('../../../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled, badge }: any) => R.createElement(Pressable, { testID, onPress, disabled, 'aria-disabled': !!disabled }, R.createElement(Text, null, `${icon}${badge ?? ''}`)) };
});
jest.mock('../../../../../kit8/pm/inner/buttons', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { PMTipIcon: ({ testID, tip }: any) => R.createElement(Text, { testID }, tip) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput, Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, hideClearIcon, ...p }: any) => R.createElement(View, { accessibilityLabel: heightVariant },
    (leftIcons || []).map((ic: any) => R.createElement(Pressable, { key: ic.icon, testID: ic.testID, onPress: ic.onPress, disabled: ic.disabled }, R.createElement(Text, null, ic.icon))),
    R.createElement(TextInput, p),
    p.value && !hideClearIcon ? R.createElement(Pressable, { testID: `${p.testID}-clear`, onPress: () => p.onChangeText('') }, R.createElement(Text, null, 'close')) : null) };
});
// Post: the database calls are test doubles
const mockCreatePlan = jest.fn((_json: any) => Promise.resolve({ lines: 1, rows: 5 }));
jest.mock('../../../../../kit8/pm/view/task/plan/taskLinePlanApi', () => ({ createTaskLinePlan: (json: any) => mockCreatePlan(json) }));
const mockFetchDays = jest.fn((_cal: string, _from: string, _to: string) => Promise.resolve([] as any[]));
jest.mock('../../../../../kit8/catalog/management/calendar/managementCalendarApi', () => ({ fetchCalendarDays: (c: string, f: string, t: string) => mockFetchDays(c, f, t) }));
jest.mock('../../../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));
jest.mock('../../../../../kit8/pm/crud/exchange/project/export/downloadTextFile', () => ({ downloadTextFile: jest.fn() }));
jest.mock('../../../../../kit8/pm/crud/exchange/pdf/downloadBinaryFile', () => ({ downloadBinaryFile: jest.fn() }));

// Post of the payments: the database call is a test double
const mockPostPlan = jest.fn((_task: string, _from: string | null, _to: string | null) => Promise.resolve({ status: 'posted', lines: 2, problems: [] as any[] }));
jest.mock('../../../../../kit8/pm/view/task/payments/paymentPlanApi', () => ({ ...jest.requireActual('../../../../../kit8/pm/view/task/payments/paymentPlanApi'), postTaskPaymentPlan: (t: string, a: string | null, b: string | null) => mockPostPlan(t, a, b) }));

import PMProjectTaskInputCRUD from '../../../../../kit8/pm/view/task/finances/PMProjectTaskInputCRUD';
import { PRODUCT_TABLES } from '../../../../../kit8/catalog/product/productModel';
import { CONTRACT_ENTITY } from '../../../../../kit8/catalog/contract/contractModel';
import { PARTNER_ENTITY } from '../../../../../kit8/catalog/partner/partnerModel';
import { PERSON_ENTITY } from '../../../../../kit8/catalog/person/personModel';
import { BUDGET_ITEM_TABLE } from '../../../../../kit8/catalog/budget/item/budgetItemModel';
import { TASK_LINE_ENTITY } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { TASK_PAYMENT_PLAN_ENTITY } from '../../../../../kit8/pm/view/task/payments/paymentPlanModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const T = 'fin';
const P = `${T}-payments`;
const PT = `${P}-table`;
const def = (guid: string, owner: string, parent: string, json: any, order = 0) => ({ rowGUID: guid, rowOwnerGUID: owner, rowParentGUID: parent, orderInList: order, rowJSON: json });
const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1);

function catalogState() {
  return {
    [BUDGET_ITEM_TABLE.entity]: { entityDataFromServer: [
      def('payFolder', 'budgetItemCatalog', 'empty', { title: 'Payments' }),
      def('bi_out', 'budgetItemCatalog', 'payFolder', { title: 'Vendor payments', managementGenusItem: 'outboundPaymentGenus' }, 1),
      def('bi_out2', 'budgetItemCatalog', 'payFolder', { title: 'Salary payments', managementGenusItem: 'outboundPaymentGenus' }, 2),
      def('bi_in', 'budgetItemCatalog', 'payFolder', { title: 'Receipts', managementGenusItem: 'inboundPaymentGenus' }, 3),
      def('bi_time', 'budgetItemCatalog', 'payFolder', { title: 'Time', managementGenusItem: 'timeGenus' }, 4),
    ] },
    [PARTNER_ENTITY]: { entityDataFromServer: [def('partnerA', 'partnerCatalog', 'empty', { partnerTitle: 'Acme', partnerIsSupplier: true }), def('custA', 'partnerCatalog', 'empty', { partnerTitle: 'Cust', partnerIsCustomer: true })] },
    [PERSON_ENTITY]: { entityDataFromServer: [def('pers1', 'personCatalog', 'empty', { personFirstName: 'Ann', personLastName: 'Lee' })] },
    [CONTRACT_ENTITY]: { entityDataFromServer: [
      def('c_sup', 'partnerA', 'partner', { contractPartyType: 'partner', supplierRole: true, contractCurrency: 'EUR', paymentTimelineShiftDays: 30, paymentBudgetItemOutbound: 'bi_out' }),
      def('c_cust', 'custA', 'partner', { contractPartyType: 'partner', customerRole: true, contractCurrency: 'EUR', paymentBudgetItemInbound: 'bi_in' }),
    ] },
    [PRODUCT_TABLES.measureUnit.entity]: { entityDataFromServer: [] },
  };
}
const pay = (guid: string, dir: 'outbound' | 'inbound', order: number, json: any = {}) => def(guid, 't1', dir, { paymentPlanPaymentDirection: dir, paymentIsPosted: false, ...json }, order);
const out1 = pay('out1', 'outbound', 100, { paymentPlanPartner: 'partnerA', paymentPlanContract: 'c_sup', paymentPlanBudgetItem: 'bi_out', paymentPlanBudgetItemAuto: 'bi_out', paymentPlanCurrency: 'EUR', paymentPlanTimelineAnchor: 'taskStart', paymentPlanTimelineShiftDays: 5, paymentPlannedTransactionDate: '2026-10-06', paymentPlanDateSource: 'shift', paymentPlanDateSnapshot: { shift: 5, date: '2026-10-06', anchor: 'taskStart' }, sumForContract: 100 });
const out2 = pay('out2', 'outbound', 200);
const in1 = pay('in1', 'inbound', 300, { paymentPlanPartner: 'custA' });
const matLine = def('mat1', 't1', 'materialGenus', { taskManagementGenusLine: 'materialGenus', taskLinePartnerItem: 'partnerA', taskLinePartnerContract: 'c_sup', sumForContract: 100, sumVATForContract: 21 }, 10);

function mount(opts: { payments?: any[]; lines?: any[]; project?: Record<string, any> } = {}) {
  mockPM = {
    selectRowCheckBoxForm: 'formRound',
    tasksById: { t1: { rowGUID: 't1', rowJSON: { rowKind: 'task', name: 'Task' } } },
    // 2026-10-01 .. 2026-10-10 (finish is exclusive in the scheduler)
    schedule: { t1: { isSummary: false, startMs: START, finishMs: START + 10 * DAY } },
    tree: { childrenById: { t1: [] } },
    projectsById: { p1: { rowJSON: { currencyForContract: 'EUR', ...(opts.project || {}) } } },
  };
  mockState = {
    uxuiState: { askBeforeDeletePost: true }, ...catalogState(),
    [TASK_LINE_ENTITY]: { entityDataFromServer: opts.lines ?? [matLine], readSuccessful: 1 },
    [TASK_PAYMENT_PLAN_ENTITY]: { entityDataFromServer: opts.payments ?? [out1, out2, in1], readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<PMProjectTaskInputCRUD projectGUID="p1" taskGUID="t1" testID={T} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockPicker = null; mockBook = null; for (const k of Object.keys(mockPick)) delete mockPick[k]; });

describe('the fifth tab "Payments" and its three sub-tabs', () => {
  it('is after the genus tabs and shows the number of payments of the task', () => {
    mount();
    expect(q(`${T}-tab-TabPayments`)).not.toBeNull();
    const tabs = Array.from(document.querySelectorAll(`[data-testid^="${T}-tab-"]`)).map((e) => e.getAttribute('data-testid')).filter((id) => !/-(count|sum)$/.test(id!));
    expect(tabs).toEqual([`${T}-tab-timeGenus`, `${T}-tab-materialGenus`, `${T}-tab-expenseGenus`, `${T}-tab-revenueGenus`, `${T}-tab-TabPayments`]);
    expect(q(`${T}-tab-TabPayments-count`)!.textContent).toBe('3');
    expect(q(`${P}`)).toBeNull();   // the payments are not drawn until the tab is open
  });

  it('has no Payments tab while the screen is a picker (a line is wanted)', () => {
    mockPicker = { mode: 'line', onPick: jest.fn() };
    mount();
    expect(q(`${T}-tab-TabPayments`)).toBeNull();
  });

  it('opens on Outbound: three sub-tabs Outbound · Inbound · Cash flow, the table lists the OUTBOUND payments only', () => {
    mount();
    press(`${T}-tab-TabPayments`);
    expect(['outbound', 'inbound', 'cashFlow'].map((id) => q(`${P}-subtab-${id}`) !== null)).toEqual([true, true, true]);
    expect(q(`${P}-subtab-outbound`)!.getAttribute('aria-selected')).toBe('true');
    expect(q(`${P}-subtab-outbound-count`)!.textContent).toBe('2');
    expect(q(`${P}-subtab-inbound-count`)!.textContent).toBe('1');
    expect(q(`${P}-subtab-cashFlow-count`)).toBeNull();
    expect(q(`${PT}-row-out1`)).not.toBeNull();
    expect(q(`${PT}-row-out2`)).not.toBeNull();
    expect(q(`${PT}-row-in1`)).toBeNull();
  });

  it('Inbound lists the inbound payments; Cash flow is EMPTY (a note, no table)', () => {
    mount();
    press(`${T}-tab-TabPayments`);
    press(`${P}-subtab-inbound`);
    expect(q(`${PT}-row-in1`)).not.toBeNull();
    expect(q(`${PT}-row-out1`)).toBeNull();
    press(`${P}-subtab-cashFlow`);
    expect(q(`${P}-cashflow`)).not.toBeNull();
    expect(q(PT)).toBeNull();
    expect(document.querySelectorAll(`[data-testid^="${PT}-row-"]`).length).toBe(0);
  });

  it('the Outbound table has the columns Supplier · Person · Contract · Budget item ... Shift from · Shift (days) · Planned date · Sum with VAT; Inbound has the Customer and no Person', () => {
    mount();
    press(`${T}-tab-TabPayments`);
    const heads = () => Array.from(document.querySelectorAll(`[data-testid^="${PT}-header-"]`)).map((e) => e.getAttribute('data-testid')!.replace(`${PT}-header-`, ''));
    expect(heads()).toEqual(expect.arrayContaining(['partner', 'person', 'contract', 'budgetItem', 'currency', 'anchor', 'shift', 'date', 'sum']));
    press(`${P}-subtab-inbound`);
    expect(heads()).toEqual(expect.arrayContaining(['partner', 'contract', 'budgetItem', 'anchor', 'shift', 'date', 'sum']));
    expect(heads()).not.toContain('person');
  });
});

describe('the fill buttons depend on the direction', () => {
  it('Outbound: Time, Material, Expense; Inbound: Deliverable only', () => {
    mount();
    press(`${T}-tab-TabPayments`);
    expect(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'].map((g) => q(`${P}-fill-${g}`) !== null)).toEqual([true, true, true, false]);
    press(`${P}-subtab-inbound`);
    expect(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'].map((g) => q(`${P}-fill-${g}`) !== null)).toEqual([false, false, false, true]);
  });

  it('Fill from Material lines makes ONE payment with the sum WITH VAT, the item of the contract and the date of its shift', () => {
    mount({ payments: [] });
    press(`${T}-tab-TabPayments`);
    press(`${P}-fill-materialGenus`);
    expect(mockActions.createOne).toHaveBeenCalledTimes(1);
    const arg = mockActions.createOne.mock.calls[0][0];
    expect(arg).toMatchObject({ rowOwnerGUID: 't1', rowParentGUID: 'outbound' });
    expect(arg.rowJSON).toMatchObject({
      paymentPlanPartner: 'partnerA', paymentPlanContract: 'c_sup', paymentPlanBudgetItem: 'bi_out', paymentPlanTimelineAnchor: 'taskStart',
      paymentPlanTimelineShiftDays: 30, paymentPlannedTransactionDate: '2026-10-31', sumForContract: 121, paymentIsPosted: false, paymentPlanSource: { genus: 'materialGenus', taskLineGUIDs: ['mat1'] },
    });
  });

  it('a second press with nothing new writes nothing', () => {
    mount({ payments: [] });
    press(`${T}-tab-TabPayments`);
    press(`${P}-fill-materialGenus`);
    const made = mockActions.createOne.mock.calls[0][0];
    jest.clearAllMocks();
    // the made payment is in the store now
    act(() => { root.unmount(); });
    document.body.innerHTML = '';
    mount({ payments: [{ ...made, rowGUID: made.rowGUID }] });
    press(`${T}-tab-TabPayments`);
    press(`${P}-fill-materialGenus`);
    expect(mockActions.createOne).not.toHaveBeenCalled();
    expect(mockActions.updateOne).not.toHaveBeenCalled();
    expect(mockActions.deleteOne).not.toHaveBeenCalled();
  });

  it('a task with no lines of the kind: a message, nothing written', () => {
    mount({ payments: [], lines: [] });
    press(`${T}-tab-TabPayments`);
    press(`${P}-fill-expenseGenus`);
    expect(mockActions.createOne).not.toHaveBeenCalled();
  });
});

describe('the budget item of a payment can be changed on the line', () => {
  it('the cell offers the payments-genus items of the direction only (no cost item, no inbound item on Outbound)', () => {
    mount();
    press(`${T}-tab-TabPayments`);
    const props = mockSelectProps[`${PT}-cell-out1-budgetItem`];
    expect(props).toBeDefined();
    const offered = ['bi_out', 'bi_out2', 'bi_in', 'bi_time', 'payFolder'].filter((id) => {
      const row = (mockState[BUDGET_ITEM_TABLE.entity].entityDataFromServer as any[]).find((r) => r.rowGUID === id);
      return props.filterItem(row);
    });
    expect(offered).toEqual(['bi_out', 'bi_out2']);
  });

  it('choosing another item saves it and marks it as the user\'s choice (source "line"); the payment is unposted', () => {
    mount();
    press(`${T}-tab-TabPayments`);
    mockPick.budgetItemReusable = 'bi_out2';
    press(`${PT}-cell-out1-budgetItem`);
    const call = mockActions.updateOne.mock.calls.map((c) => c[0]).find((p) => p.rowGUID === 'out1' && p.rowJSON?.paymentPlanBudgetItem);
    expect(call).toBeDefined();
    expect(call.rowJSON).toMatchObject({ paymentPlanBudgetItem: 'bi_out2', paymentPlanBudgetItemSource: 'line', paymentIsPosted: false });
  });
});

describe('Post', () => {
  // the text of the button is shown on a wide window only
  beforeEach(() => { jest.spyOn(require('react-native').Dimensions, 'get').mockReturnValue({ width: 1400, height: 900, scale: 1, fontScale: 1 }); });
  afterEach(() => { jest.restoreAllMocks(); });
  it('the Post button posts the payments of the task with the first and the last day of the task', async () => {
    mount();
    press(`${T}-tab-TabPayments`);
    expect(q(`${PT}-post-text`)!.textContent).toMatch(/Post/);
    press(`${PT}-post`);
    await flush();
    expect(mockPostPlan).toHaveBeenCalledWith('t1', '2026-10-01', '2026-10-10');
  });

  it('the button is there only while there is something to post: gone when every payment is posted, "Post needed" after a posted payment changed', () => {
    mount({ payments: [{ ...out1, rowJSON: { ...out1.rowJSON, paymentIsPosted: true, paymentEverPosted: true } }] });
    press(`${T}-tab-TabPayments`);
    expect(q(`${PT}-post`)).toBeNull();
    act(() => { root.unmount(); });
    document.body.innerHTML = '';
    mount({ payments: [{ ...out1, rowJSON: { ...out1.rowJSON, paymentIsPosted: false, paymentEverPosted: true } }] });
    press(`${T}-tab-TabPayments`);
    expect(q(`${PT}-post-text`)!.textContent).toMatch(/Post needed/);
  });
});

describe('the Errors column', () => {
  it('shows what an incomplete payment lacks, and is not there when every payment is complete', () => {
    mount({ payments: [out2] });
    press(`${T}-tab-TabPayments`);
    expect(q(`${PT}-header-errors`)).not.toBeNull();
    expect(q(`payment-plan-problem-out2`)).not.toBeNull();
    act(() => { root.unmount(); });
    document.body.innerHTML = '';
    mount({ payments: [out1] });
    press(`${T}-tab-TabPayments`);
    expect(q(`${PT}-header-errors`)).toBeNull();
  });
});
