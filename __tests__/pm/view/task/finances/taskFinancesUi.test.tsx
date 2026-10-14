/** @jest-environment jsdom */
// PMProjectTaskFinancesCRUD: the lines of ONE task in a ReusableTable per management genus (tabs), the money computed on every change,
// the remembered place (genus tab + line) opened and reported. The redux entity, the catalogs and the catalog selects are test doubles.
import React, { act } from 'react';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/pm/project/task', useGlobalSearchParams: () => ({}) }));
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

import PMProjectTaskFinancesCRUD from '../../../../../kit8/pm/view/task/finances/PMProjectTaskFinancesCRUD';
import { makeLastEditPlace } from '../../../../../kit8/pm/model/lastEditPlace';
import { PRODUCT_TABLES } from '../../../../../kit8/catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../../../kit8/catalog/resourcerole/resourceRoleModel';
import { MANAGEMENT_GENUS_TABLE } from '../../../../../kit8/catalog/management/genus/managementGenusModel';
import { CONTRACT_ENTITY } from '../../../../../kit8/catalog/contract/contractModel';
import { PERSON_ENTITY } from '../../../../../kit8/catalog/person/personModel';
import { EQUIPMENT_ENTITY } from '../../../../../kit8/catalog/equipment/equipmentModel';
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY, TEMPLATE_RESOURCE_CONTRACT_ROUTES } from '../../../../../kit8/catalog/management/templateresourcecontract/templateResourceContractModel';
import { BUDGET_ITEM_TABLE } from '../../../../../kit8/catalog/budget/item/budgetItemModel';
import { TASK_LINE_ENTITY } from '../../../../../kit8/pm/view/task/finances/taskLineModel';
import { buildRateBook } from '../../../../../kit8/catalog/currency/exchange/currencyConvert';
import { rateKeyOf } from '../../../../../kit8/catalog/currency/exchange/currencyExchangeModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 'fin';
const TT = `${T}-table`;

const def = (guid: string, owner: string, parent: string, json: any, order = 0) => ({ rowGUID: guid, rowOwnerGUID: owner, rowParentGUID: parent, orderInList: order, rowJSON: json });
const line = (guid: string, genus: string, order: number, json: any, task = 't1') => def(guid, task, genus, { taskManagementGenusLine: genus, ...json }, order);

function catalogState() {
  return {
    [BUDGET_ITEM_TABLE.entity]: { entityDataFromServer: [
      def('costsBudgetFolder', 'budgetItemCatalog', 'empty', { title: 'Costs' }),
      def('timeBudgetItem', 'budgetItemCatalog', 'costsBudgetFolder', { title: 'Time', managementGenusItem: 'timeGenus' }, 1),
      def('materialBudgetItem', 'budgetItemCatalog', 'costsBudgetFolder', { title: 'Material', managementGenusItem: 'materialGenus' }, 2),
    ] },
    [MANAGEMENT_GENUS_TABLE.entity]: { entityDataFromServer: [def('timeGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Time' }), def('materialGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Material' })] },
    [RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity]: { entityDataFromServer: [
      def('type_hr', 'resourceRoleTypeCatalog', 'empty', { managementGenus: 'timeGenus', baseUnit: 'unit_hour', roleVATDefaultRate: 'vat_0', variantMode: 'perType', variantSet: 'ds_hr_var' }),
      def('type_mat', 'resourceRoleTypeCatalog', 'empty', { managementGenus: 'materialGenus', baseUnit: 'unit_pcs', variantMode: 'none' }),
      // the roles of EQUIPMENT (a Time line of the kind equipment picks these)
      def('type_eq', 'resourceRoleTypeCatalog', 'empty', { managementGenus: 'timeGenus', resourceKind: 'equipment', baseUnit: 'unit_hour', roleVATDefaultRate: 'vat_0', variantMode: 'none' }),
    ] },
    [RESOURCE_ROLE_OWN_TABLES.resourceRole.entity]: { entityDataFromServer: [def('role_da', 'type_hr', 'empty', { title: 'Data analyst' }), def('role_wood', 'type_mat', 'empty', { title: 'Wood role' }), def('role_exc', 'type_eq', 'empty', { title: 'Excavator 20 t' })] },
    [RESOURCE_ROLE_OWN_TABLES.rolePrice.entity]: { entityDataFromServer: [
      def('rp1', 'role_da', 'empty', { priceTypeGUID: 'pt_cost', price: 40, measureUnit: 'unit_hour', validFrom: '2020-01-01' }),
      def('rp_exc', 'role_exc', 'empty', { priceTypeGUID: 'pt_cost', price: 95, measureUnit: 'unit_hour', validFrom: '2020-01-01' }),
    ] },
    [EQUIPMENT_ENTITY]: { entityDataFromServer: [def('eq1', 'equipmentCatalog', 'empty', { equipmentTitle: 'Excavator CAT 320', equipmentType: 'equipmentTypeHeavy', isActive: true })] },
    [PRODUCT_TABLES.priceType.entity]: { entityDataFromServer: [def('pt_cost', 'priceTypeCatalog', 'empty', { title: 'Cost' })] },
    [PRODUCT_TABLES.valueAddedTax.entity]: { entityDataFromServer: [def('vat_0', 'valueAddedTaxCatalog', 'empty', { vatTablePercent: 0 })] },
    [PRODUCT_TABLES.measureUnit.entity]: { entityDataFromServer: [def('unit_hour', 'measureUnitCatalog', 'empty', { title: 'hour' }), def('unit_pcs', 'measureUnitCatalog', 'empty', { title: 'pcs' })] },
    // the variant set of the Human resources type: Seniority + Working language (the descriptors of the sheet)
    [PRODUCT_TABLES.descriptorDestination.entity]: { entityDataFromServer: [def('ds_hr_var', 'type_hr', 'variant', { title: 'HR variants' }), def('ds_emp_var', 'personTypeEmployee', 'variant', { title: 'Employee variants' })] },
    [PRODUCT_TABLES.descriptorGenus.entity]: { entityDataFromServer: [def('seniority', 'descriptorGenusCatalog', 'empty', { title: 'Seniority', valueType: 'ref' }), def('workLanguage', 'descriptorGenusCatalog', 'empty', { title: 'Working language', valueType: 'ref' })] },
    [PRODUCT_TABLES.descriptorPlan.entity]: { entityDataFromServer: [def('dp1', 'ds_hr_var', 'seniority', { required: true, sort: 10 }), def('dp2', 'ds_hr_var', 'workLanguage', { required: true, sort: 20 }),
      // the Employee set of the PERSON side: other plan lines, the same descriptors
      def('dp_emp_v1', 'ds_emp_var', 'seniority', { required: true, sort: 10 }), def('dp_emp_v2', 'ds_emp_var', 'workLanguage', { required: true, sort: 20 })] },
    [PRODUCT_TABLES.descriptorValue.entity]: { entityDataFromServer: [
      def('dvJunior', 'seniority', 'empty', { title: 'Junior', sort: 10 }), def('dvSenior', 'seniority', 'empty', { title: 'Senior', sort: 20 }),
      def('dvEn', 'workLanguage', 'empty', { title: 'English', sort: 10 }), def('dvLv', 'workLanguage', 'empty', { title: 'Latvian', sort: 20 }),
    ] },
    // the person p1 (Employee) with two variants of HIS OWN, and his contract: 3360 per Month = 20 per hour
    [PERSON_ENTITY]: { entityDataFromServer: [def('p1', 'personCatalog', 'empty', { personType: 'personTypeEmployee', personFirstName: 'John', personLastName: 'Doe' })] },
    [PRODUCT_TABLES.variant.entity]: { entityDataFromServer: [
      def('pv1', 'p1', 'empty', { title: 'Senior, English', descriptorKey: 'dp_emp_v1=dvSenior|dp_emp_v2=dvEn', isActive: true }, 1),
      def('pv2', 'p1', 'empty', { title: 'Junior, Latvian', descriptorKey: 'dp_emp_v1=dvJunior|dp_emp_v2=dvLv', isActive: true }, 2),
      // the variant of the ROLE type (Human resources): what the role asks for
      def('rv1', 'type_hr', 'empty', { title: 'Senior, English', descriptorKey: 'dp1=dvSenior|dp2=dvEn', isActive: true }),
    ] },
    [CONTRACT_ENTITY]: { entityDataFromServer: [def('c1', 'p1', 'person', { contractCurrency: 'EUR', contractSumBeforeVAT: 3360, contractPaymentsPeriod: 'Month' })] },
    [TEMPLATE_RESOURCE_CONTRACT_ENTITY]: { entityDataFromServer: [def('tpl_mat', 'materialGenus', 'empty', { title: 'Material supply' }), def('tpl_time', 'timeGenus', 'empty', { title: 'Time service' })] },
  };
}

const time1 = line('time1', 'timeGenus', 100, { resourceRoleItem: 'role_da', qtyTaskLine: null, priceTaskLine: 40, priceAutoTaskLine: 40, priceSourceTaskLine: 'role', measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, sumForContract: 100, sumVATForContract: 0 });
const time2 = line('time2', 'timeGenus', 200, { sumForContract: 50.5, sumVATForContract: 0 });
const mat1 = line('mat1', 'materialGenus', 300, { sumForContract: 10, sumVATForContract: 2.1 });
const otherTask = line('other', 'timeGenus', 50, { sumForContract: 999 }, 't2');

let onEditPlace: jest.Mock;
function mount(opts: { lines?: any[]; place?: any; stage?: boolean; project?: Record<string, any>; startMs?: number; finishMs?: number; color?: string } = {}) {
  mockPM = {
    selectRowCheckBoxForm: 'formRound',
    tasksById: { t1: { rowGUID: 't1', rowJSON: { rowKind: opts.stage ? 'stage' : 'task', name: 'Task' } } },
    schedule: { t1: { isSummary: !!opts.stage, startMs: opts.startMs, finishMs: opts.finishMs } },
    postButtonBackgroundColor: opts.color,
    tree: { childrenById: { t1: opts.stage ? ['c1'] : [] } },
    projectsById: { p1: { rowJSON: { currencyForContract: 'EUR', ...(opts.project || {}) } } },
  };
  mockState = { uxuiState: { askBeforeDeletePost: true }, ...catalogState(), [TASK_LINE_ENTITY]: { entityDataFromServer: opts.lines ?? [time1, time2, mat1, otherTask], readSuccessful: 1 } };
  onEditPlace = jest.fn();
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<PMProjectTaskFinancesCRUD projectGUID="p1" taskGUID="t1" initialPlace={opts.place} onEditPlace={onEditPlace} testID={T} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockBook = null; for (const k of Object.keys(mockPick)) delete mockPick[k]; });

const selectedTab = (genus: string) => q(`${T}-tab-${genus}`)!.getAttribute('aria-selected') === 'true';
const setNumber = (id: string, value: string) => {
  const input = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  act(() => { input.focus(); input.blur(); });
};

describe('tabs and tables', () => {
  it('Time is the first tab; every tab shows its line count and sum of THIS task; the table lists the time lines only', () => {
    mount();
    expect(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'].map(selectedTab)).toEqual([true, false, false, false]);
    // the number of lines is a round badge in the corner of the tab (like a shopping cart), the sum is text beside the title
    expect(q(`${T}-tab-timeGenus-count`)!.textContent).toBe('2');
    expect(q(`${T}-tab-timeGenus-sum`)!.textContent).toBe('150.50');
    expect(q(`${T}-tab-materialGenus-count`)!.textContent).toBe('1');
    expect(q(`${T}-tab-materialGenus-sum`)!.textContent).toBe('10.00');
    expect(q(`${T}-tab-expenseGenus-count`)).toBeNull(); // no lines: no badge, no sum
    expect(q(`${T}-tab-expenseGenus-sum`)).toBeNull();
    expect(q(`${T}-tab-timeGenus`)!.contains(q(`${T}-tab-timeGenus-count`))).toBe(true);
    expect(q(`${TT}-row-time1`)).not.toBeNull();
    expect(q(`${TT}-row-time2`)).not.toBeNull();
    expect(q(`${TT}-row-mat1`)).toBeNull();
    expect(q(`${TT}-row-other`)).toBeNull();
  });

  it('the read is by task only, never by genus: every tab is made of the same rows (all-rows mode on the genus)', () => {
    mount();
    const reads = () => mockActions.readData.mock.calls.map((c) => c[0]).filter((p) => p?.match);
    expect(reads()).toEqual([expect.objectContaining({ match: { rowOwnerGUID: 't1' } })]);
    press(`${T}-tab-materialGenus`);
    press(`${T}-tab-timeGenus`);
    for (const p of reads()) expect(p.match).toEqual({ rowOwnerGUID: 't1' });
  });

  it('Time has a person, his variant and his contract; Material has a product, a contract template, a supplier and the supplier contract', () => {
    mount();
    for (const key of ['role', 'roleAttributes', 'person', 'personVariant', 'contract', 'qty', 'unit', 'price', 'vat', 'sum', 'sumVAT', 'currency']) expect(q(`${TT}-header-${key}`)).not.toBeNull();
    expect(q(`${TT}-header-product`)).toBeNull();
    press(`${T}-tab-materialGenus`);
    expect(selectedTab('materialGenus')).toBe(true);
    expect(q(`${TT}-row-mat1`)).not.toBeNull();
    expect(q(`${TT}-row-time1`)).toBeNull();
    for (const key of ['role', 'product', 'productAttributes', 'contractTemplate', 'partner', 'partnerContract', 'qty', 'sum']) expect(q(`${TT}-header-${key}`)).not.toBeNull();
    expect(q(`${TT}-header-person`)).toBeNull();
    expect(q(`${TT}-header-contract`)).toBeNull(); // the contract of a person is a Time cell; the others ask for a TEMPLATE
    expect(q(`${TT}-header-partner`)!.textContent).toContain('Supplier');
    press(`${T}-tab-revenueGenus`);
    expect(q(`${TT}-header-partner`)!.textContent).toContain('Customer');
  });

  it('the contract of a person waits for the person; the supplier contract waits for the supplier', () => {
    mount({ lines: [line('a', 'timeGenus', 1, {}), line('b', 'materialGenus', 2, {})] });
    expect(q(`${TT}-cell-a-contract`)!.textContent).toBe('-|off');
    press(`${T}-tab-materialGenus`);
    expect(q(`${TT}-cell-b-partnerContract`)!.textContent).toBe('-|off');
  });

  it('the role picker offers the roles of the genus of the tab only', () => {
    mount();
    press(`${TT}-cell-time1-role`);
    const time = mockSelectProps[`${TT}-cell-time1-role`];
    expect(time.filterItem(def('role_da', 'type_hr', 'empty', {}))).toBe(true);
    expect(time.filterItem(def('role_wood', 'type_mat', 'empty', {}))).toBe(false);
    press(`${T}-tab-materialGenus`);
    const mat = mockSelectProps[`${TT}-cell-mat1-role`];
    expect(mat.filterItem(def('role_wood', 'type_mat', 'empty', {}))).toBe(true);
    expect(mat.filterItem(def('role_da', 'type_hr', 'empty', {}))).toBe(false);
  });
});

describe('the count badge of a tab', () => {
  it('more than 99 lines: 99+', () => {
    const many = Array.from({ length: 120 }, (_, i) => line(`x${i}`, 'timeGenus', i, {}));
    mount({ lines: many });
    expect(q(`${T}-tab-timeGenus-count`)!.textContent).toBe('99+');
  });
});

describe('stages', () => {
  it('a stage has no lines: a note instead of the tabs', () => {
    mount({ stage: true });
    expect(q(`${T}-stage`)).not.toBeNull();
    expect(q(`${T}-tabs`)).toBeNull();
    expect(q(`${TT}-headers`)).toBeNull();
  });
});

describe('editing a line', () => {
  it('+ Add creates an empty line of the tab\'s genus in this task and reports its place', () => {
    mount();
    press(`${T}-tab-materialGenus`);
    press(`${TT}-add`);
    const created = mockActions.createOne.mock.calls[0][0];
    expect(created).toMatchObject({ rowOwnerGUID: 't1', rowParentGUID: 'materialGenus' });
    expect(created.rowJSON).toMatchObject({ resourceRoleItem: null, taskResourceItem: null, qtyTaskLine: null, sumForContract: null, distributionForBudgetTaskLine: 'uniformDistribution' }); // a new line spreads its budget uniformly
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'materialGenus', lineGUID: created.rowGUID });
  });

  it('a quantity gives the sums in the same save, and the place is reported', () => {
    mount();
    setNumber(`${TT}-cell-time1-qty`, '3');
    expect(mockActions.updateOne).toHaveBeenCalledWith({
      rowGUID: 'time1', rowOwnerGUID: 't1',
      rowJSON: { qtyTaskLine: 3, sumForContract: 120, taskIsPosted: false }, // the VAT sum was 0 and stays 0: nothing to write; any change unposts the line
    });
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'timeGenus', lineGUID: 'time1' });
  });

  it('choosing a role fills the unit, the VAT and the price of the catalog (once)', () => {
    mount({ lines: [line('r1', 'timeGenus', 1, { resourceRoleItem: null, qtyTaskLine: null, priceTaskLine: null, measureUnitTaskLine: null, vatRatioTaskLine: null })] });
    mockPick.resourceRoleReusable = 'role_da';
    press(`${TT}-cell-r1-role`);
    expect(mockActions.updateOne).toHaveBeenCalledWith({
      rowGUID: 'r1', rowOwnerGUID: 't1',
      rowJSON: { resourceRoleItem: 'role_da', priceTaskLine: 40, priceAutoTaskLine: 40, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, priceSourceTaskLine: 'role', taskIsPosted: false },
    });
  });

  it('deleting a line (asks first) reports the tab without a line', () => {
    mount();
    press(`${TT}-menu-button-time2`);
    press(`${TT}-menu-delete`);
    press('confirm-sql_for_delete');
    expect(mockActions.deleteOne).toHaveBeenCalledWith({ rowGUID: 'time2', rowOwnerGUID: 't1' });
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'timeGenus' });
  });

  it('changes that arrive from the server (realtime) are not "the user edited here"', () => {
    mount();
    expect(onEditPlace).not.toHaveBeenCalled();
  });
});

describe('the remembered place', () => {
  it('opens the tab and marks the line', () => {
    mount({ place: makeLastEditPlace({ surface: 'taskPage', section: 'finances', genus: 'materialGenus', lineGUID: 'mat1' }, 'u1') });
    expect(selectedTab('materialGenus')).toBe(true);
    expect(selectedTab('timeGenus')).toBe(false);
    expect(q(`${TT}-row-mat1`)!.getAttribute('aria-current')).toBe('true');
    expect(q(`${TT}-focus-marker`)).not.toBeNull();
    expect(onEditPlace).not.toHaveBeenCalled(); // opening is not an edit
  });

  it('the place of the Finances view opens the same tab and line on the task page', () => {
    mount({ place: makeLastEditPlace({ surface: 'financesView', section: 'finances', genus: 'timeGenus', lineGUID: 'time2' }) });
    expect(selectedTab('timeGenus')).toBe(true);
    expect(q(`${TT}-row-time2`)!.getAttribute('aria-current')).toBe('true');
  });

  it('a line that is gone, an unknown genus or a place of another section = Time, nothing marked', () => {
    mount({ place: makeLastEditPlace({ surface: 'taskPage', section: 'finances', genus: 'materialGenus', lineGUID: 'deleted' }) });
    expect(selectedTab('materialGenus')).toBe(true);
    expect(q(`${TT}-focus-marker`)).toBeNull();
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ place: { v: 1, surface: 'taskPage', section: 'finances', genus: 'paymentsGenus', at: '' } as any });
    expect(selectedTab('timeGenus')).toBe(true);
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ place: makeLastEditPlace({ surface: 'taskPage', section: 'progress' }) });
    expect(selectedTab('timeGenus')).toBe(true);
    expect(q(`${TT}-focus-marker`)).toBeNull();
  });

  it('the marked line follows the user\'s last edit', () => {
    mount({ place: makeLastEditPlace({ surface: 'taskPage', section: 'finances', genus: 'timeGenus', lineGUID: 'time2' }) });
    expect(q(`${TT}-row-time2`)!.getAttribute('aria-current')).toBe('true');
    setNumber(`${TT}-cell-time1-qty`, '2');
    expect(q(`${TT}-row-time1`)!.getAttribute('aria-current')).toBe('true');
    expect(q(`${TT}-row-time2`)!.getAttribute('aria-current')).toBeNull();
  });
});

describe('Person variant (the person\'s OWN variants, separate from the role\'s)', () => {
  const pa = (extra: any = {}) => line('pa1', 'timeGenus', 1, {
    resourceRoleItem: 'role_da', taskResourceItem: 'p1', resourceRoleAttributeSetKey: 'dp1=dvSenior|dp2=dvEn', taskResourceAttributesKey: null,
    qtyTaskLine: 8, priceTaskLine: 40, priceAutoTaskLine: 40, priceSourceTaskLine: 'role', measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, sumForContract: 320, sumVATForContract: 0, ...extra,
  });
  const cell = `${TT}-cell-pa1-personVariant`;

  it('empty = automatic; the picker lists the variants of THE PERSON and marks the one that covers the role', () => {
    mount({ lines: [pa()] });
    expect(q(cell)!.textContent).toContain('Automatic');
    press(cell);
    const picker = `${cell}-picker`;
    expect(q(`${picker}-option-dp_emp_v1=dvSenior|dp_emp_v2=dvEn`)!.textContent).toContain('Senior, English');
    expect(q(`${picker}-option-dp_emp_v1=dvSenior|dp_emp_v2=dvEn`)!.textContent).toContain('covers the role');
    expect(q(`${picker}-option-dp_emp_v1=dvJunior|dp_emp_v2=dvLv`)!.textContent).toContain('does not cover the role');
  });

  it('choosing a variant stores ITS descriptorKey (the key of the person\'s set) and reports the place', () => {
    mount({ lines: [pa()] });
    press(cell);
    press(`${cell}-picker-option-dp_emp_v1=dvJunior|dp_emp_v2=dvLv`);
    expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'pa1', rowOwnerGUID: 't1', rowJSON: { taskResourceAttributesKey: 'dp_emp_v1=dvJunior|dp_emp_v2=dvLv', taskIsPosted: false } });
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'timeGenus', lineGUID: 'pa1' });
  });

  it('the cell shows the chosen variant; one that does not cover the role is marked and says what is missing', () => {
    mount({ lines: [pa({ taskResourceAttributesKey: 'dp_emp_v1=dvJunior|dp_emp_v2=dvLv' })] });
    expect(q(cell)!.textContent).toContain('Junior, Latvian');
    expect(q('task-line-problem-pa1')!.textContent).toBe('The variant "Junior, Latvian" does not cover the role: needs Seniority = Senior, Working language = English');
  });

  it('the Errors column is the FIRST one, before the Budget item and # columns, and shows the message text; it is not there without an error', () => {
    mount({ lines: [pa({ taskResourceAttributesKey: 'dp_emp_v1=dvJunior|dp_emp_v2=dvLv' })] });
    const heads = Array.from(document.querySelectorAll(`[data-testid^="${TT}-header-"]`)).map((e) => e.getAttribute('data-testid'));
    expect(heads.slice(0, 3)).toEqual([`${TT}-header-errors`, `${TT}-header-budgetItem`, `${TT}-header-n`]);
    expect(q('task-line-problem-pa1')!.parentElement!.textContent).toContain('does not cover the role');
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ lines: [pa()] });
    expect(q(`${TT}-header-errors`)).toBeNull();
    expect(q(`${TT}-header-n`)).not.toBeNull();
  });

  it('automatic with a covering variant, or a chosen covering variant: no mark', () => {
    mount({ lines: [pa()] });
    expect(q('task-line-problem-pa1')).toBeNull();
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ lines: [pa({ taskResourceAttributesKey: 'dp_emp_v1=dvSenior|dp_emp_v2=dvEn' })] });
    expect(q('task-line-problem-pa1')).toBeNull();
  });
});

describe('the cost of a Time line: the contract of the person, else the rate of the role', () => {
  it('choosing the contract of the person prices the line per hour from it (3360 per Month = 20 per hour)', () => {
    mount({ lines: [line('c1l', 'timeGenus', 1, { resourceRoleItem: 'role_da', taskResourceItem: 'p1' })] });
    mockPick[CONTRACT_ENTITY] = 'c1';
    press(`${TT}-cell-c1l-contract`);
    expect(mockActions.updateOne).toHaveBeenLastCalledWith({
      rowGUID: 'c1l', rowOwnerGUID: 't1',
      rowJSON: { taskResourceContract: 'c1', priceTaskLine: 20, priceAutoTaskLine: 20, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, priceSourceTaskLine: 'contract', taskIsPosted: false },
    });
  });

  it('a line with a role and no contract is priced by the role rate', () => {
    mount({ lines: [line('r1', 'timeGenus', 1, { resourceRoleItem: null, taskResourceItem: 'p1' })] });
    mockPick.resourceRoleReusable = 'role_da';
    press(`${TT}-cell-r1-role`);
    expect(mockActions.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ rowJSON: expect.objectContaining({ priceTaskLine: 40, priceSourceTaskLine: 'role' }) }));
  });
});

describe('the contract template of a Material / Expense / Revenue line', () => {
  it('is picked from the templates of the genus of the line; the "…" opens the templates screen on that template', () => {
    mount({ lines: [line('m1', 'materialGenus', 1, {})] });
    press(`${T}-tab-materialGenus`);
    const id = `${TT}-cell-m1-contractTemplate`;
    mockPick[TEMPLATE_RESOURCE_CONTRACT_ENTITY] = 'tpl_mat';
    press(id);
    expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'm1', rowOwnerGUID: 't1', rowJSON: { resourceContractTemplateTaskLine: 'tpl_mat', taskIsPosted: false } });
    const props = mockSelectProps[id];
    const row = { rowGUID: 'm1', rowParentGUID: 'materialGenus', rowJSON: { taskManagementGenusLine: 'materialGenus' } };
    expect(props.filterItem(def('tpl_mat', 'materialGenus', 'empty', {}), row)).toBe(true);
    expect(props.filterItem(def('tpl_time', 'timeGenus', 'empty', {}), row)).toBe(false);
    expect(props.entityName).toBe(TEMPLATE_RESOURCE_CONTRACT_ENTITY);
  });

  it('the genus comes from taskManagementGenusLine, else from the tab the line is in', () => {
    mount({ lines: [line('m2', 'materialGenus', 1, { taskManagementGenusLine: null })] });
    press(`${T}-tab-materialGenus`);
    const props = mockSelectProps[`${TT}-cell-m2-contractTemplate`];
    expect(props.filterItem(def('tpl_mat', 'materialGenus', 'empty', {}), { rowGUID: 'm2', rowParentGUID: 'materialGenus', rowJSON: {} })).toBe(true);
  });

  it('a template of another genus is marked on the line', () => {
    mount({ lines: [line('m3', 'materialGenus', 1, { resourceContractTemplateTaskLine: 'tpl_time' })] });
    press(`${T}-tab-materialGenus`);
    expect(q('task-line-problem-m3')!.textContent).toBe('The contract template is not a Material template');
  });

  it('a new line carries its genus in taskManagementGenusLine', () => {
    mount();
    press(`${T}-tab-materialGenus`);
    press(`${TT}-add`);
    expect(mockActions.createOne.mock.calls[0][0].rowJSON.taskManagementGenusLine).toBe('materialGenus');
  });
});
void TEMPLATE_RESOURCE_CONTRACT_ROUTES;

describe('the sums in the accounting and the budget currency (D365 style rates)', () => {
  const cur = (guid: string, code: string, decimalDigits = 2) => ({ rowGUID: guid, rowJSON: { currencyCode: code, decimalDigits } });
  const rate = (owner: string, day: string, ratio: number, rateType?: string) => ({ rowGUID: `${owner}-${day}-${rateType}`, rowOwnerGUID: owner, rowParentGUID: rateKeyOf(day, rateType), rowJSON: { startingDate: day, currencyRatio: ratio, ...(rateType ? { rateType } : {}) } });
  /** EUR = base; USD 1.08 from 2026-03-02; GBP 0.85; the BUDGET rates: USD 1.2, GBP 0.9 (planned, from 1 January) */
  const rates = (usd = 1.08) => [rate('c-usd', '2026-01-02', 1.05), rate('c-usd', '2026-03-02', usd), rate('c-gbp', '2026-01-02', 0.85), rate('c-usd', '2026-01-01', 1.2, 'Budget'), rate('c-gbp', '2026-01-01', 0.9, 'Budget')];
  const book = (usd?: number) => buildRateBook([cur('c-eur', 'EUR'), cur('c-usd', 'USD'), cur('c-gbp', 'GBP')], rates(usd));
  const START = Date.UTC(2026, 2, 2); // the task starts 2026-03-02
  // the contract currency of the project is USD; accounting EUR (Default rates), budget GBP (Budget rates)
  const project = { currencyForContract: 'USD', currencyForAccounting: 'EUR', currencyForBudget: 'GBP' };
  const fxLine = (extra: any = {}) => line('fx1', 'timeGenus', 1, {
    resourceRoleItem: 'role_da', taskResourceItem: 'p1', qtyTaskLine: 10, priceTaskLine: 40, priceAutoTaskLine: 40, priceSourceTaskLine: 'role', measureUnitTaskLine: 'unit_hour',
    vatRatioTaskLine: 21, sumForContract: 400, sumVATForContract: 84, ...extra,
  });
  const lastPatch = () => mockActions.updateOne.mock.calls[mockActions.updateOne.mock.calls.length - 1][0].rowJSON;

  it('no accounting / budget currency on the project: no extra columns, the tab shows the sum of the line currency', () => {
    mockBook = book();
    mount({ lines: [fxLine()] });
    for (const key of ['sumAcc', 'sumVATAcc', 'sumBud', 'sumVATBud', 'fxRate']) expect(q(`${TT}-header-${key}`)).toBeNull();
    setNumber(`${TT}-cell-fx1-qty`, '20');
    expect(lastPatch().fxSnapshotTaskLine).toBeUndefined();
    expect(lastPatch().sumForAccounting).toBeUndefined();
  });

  it('the columns: the sums, the VAT and the exchange rate used; the titles name the currencies', () => {
    mockBook = book();
    mount({ lines: [fxLine()], project, startMs: START });
    expect(q(`${TT}-header-sumAcc`)!.textContent).toContain('Accounting EUR');
    expect(q(`${TT}-header-sumVATAcc`)!.textContent).toContain('Accounting VAT');
    expect(q(`${TT}-header-sumBud`)!.textContent).toContain('Budget GBP');
    expect(q(`${TT}-header-sumVATBud`)!.textContent).toContain('Budget VAT');
    expect(q(`${TT}-header-fxRate`)).not.toBeNull();
  });

  it('a change of the line converts the sum AND the VAT with D365 pair rates: 400 USD -> 370.37 EUR (Default 1/1.08), -> 300.00 GBP (Budget 0.9/1.2)', () => {
    mockBook = book();
    mount({ lines: [fxLine()], project, startMs: START });
    setNumber(`${TT}-cell-fx1-qty`, '10.0');
    setNumber(`${TT}-cell-fx1-vat`, '21.0');
    mockActions.updateOne.mockClear();
    setNumber(`${TT}-cell-fx1-price`, '40.5');
    const p = lastPatch();
    // 10 x 40.5 = 405 USD, VAT 21 % = 85.05 USD
    expect([p.sumForContract, p.sumVATForContract]).toEqual([405, 85.05]);
    expect([p.sumForAccounting, p.sumVATForAccounting]).toEqual([375, 78.75]);
    expect([p.sumForBudget, p.sumVATForBudget]).toEqual([303.75, 63.79]);
    expect(p.fxSnapshotTaskLine).toMatchObject({ from: 'USD', day: '2026-03-02', dayFrom: 'task', inputs: '|2026-03-02', accounting: { to: 'EUR', rateType: 'Default' }, budget: { to: 'GBP', rateType: 'Budget' } });
    expect(p.fxSnapshotTaskLine.accounting.rate).toBeCloseTo(1 / 1.08, 10);
    expect(p.fxSnapshotTaskLine.budget.rate).toBeCloseTo(0.75, 10);
  });

  it('SNAPSHOT: a saved line converts with ITS rate - a rate that changed later does not move it', () => {
    mockBook = book(1.5); // the rate of USD was edited to 1.5 after the line was saved with 1.08
    const saved = { fxSnapshotTaskLine: { from: 'USD', day: '2026-03-02', dayFrom: 'task', inputs: '|2026-03-02', accounting: { to: 'EUR', rateType: 'Default', rate: 1 / 1.08 }, budget: { to: 'GBP', rateType: 'Budget', rate: 0.75 } }, sumForAccounting: 370.37, sumVATForAccounting: 77.78, sumForBudget: 300, sumVATForBudget: 63 };
    mount({ lines: [fxLine(saved)], project, startMs: START });
    setNumber(`${TT}-cell-fx1-qty`, '20');
    const p = lastPatch();
    expect(p.sumForContract).toBe(800);
    expect(p.sumForAccounting).toBe(740.74); // 800 / 1.08, not 800 / 1.5
    expect(p.sumForBudget).toBe(600);
    expect(p.fxSnapshotTaskLine).toBeUndefined(); // the snapshot itself is unchanged
  });

  it('a new snapshot when what it was made from changes: the currency of the line (a contract in another currency)', () => {
    mockBook = book(1.5);
    const saved = { fxSnapshotTaskLine: { from: 'USD', day: '2026-03-02', dayFrom: 'task', inputs: '|2026-03-02', accounting: { to: 'EUR', rateType: 'Default', rate: 1 / 1.08 }, budget: { to: 'GBP', rateType: 'Budget', rate: 0.75 } } };
    // no contract: the project's USD. The task start moved to 2026-01-02 (before the USD rate of March): the snapshot is made again
    mount({ lines: [fxLine(saved)], project, startMs: Date.UTC(2026, 0, 2) });
    setNumber(`${TT}-cell-fx1-qty`, '20');
    const p = lastPatch();
    expect(p.fxSnapshotTaskLine).toMatchObject({ day: '2026-01-02', dayFrom: 'task', inputs: '|2026-01-02' });
    expect(p.fxSnapshotTaskLine.accounting.rate).toBeCloseTo(1 / 1.05, 10); // the USD rate of 2 January
  });

  it('Recalculate (row menu): the separate algorithm ignores the snapshot and takes the rates again', () => {
    mockBook = book(1.5);
    const saved = { fxSnapshotTaskLine: { from: 'USD', day: '2026-03-02', dayFrom: 'task', inputs: '|2026-03-02', accounting: { to: 'EUR', rateType: 'Default', rate: 1 / 1.08 }, budget: { to: 'GBP', rateType: 'Budget', rate: 0.75 } }, sumForAccounting: 370.37, sumVATForAccounting: 77.78, sumForBudget: 300, sumVATForBudget: 63 };
    mount({ lines: [fxLine(saved)], project, startMs: START });
    press(`${TT}-menu-button-fx1`);
    press(`${T}-recalc-fx1`);
    const call = mockActions.updateOne.mock.calls[mockActions.updateOne.mock.calls.length - 1][0];
    expect(call).toMatchObject({ rowGUID: 'fx1', rowOwnerGUID: 't1' });
    expect(call.rowJSON.sumForAccounting).toBe(266.67); // 400 / 1.5
    expect(call.rowJSON.fxSnapshotTaskLine.accounting.rate).toBeCloseTo(1 / 1.5, 10);
  });

  it('the row menu has "Vendor Invoice" right AFTER "Facts input" (a Time / Material / Expense line)', () => {
    mockBook = book();
    mount({ lines: [fxLine()], project, startMs: START });
    press(`${TT}-menu-button-fx1`);
    const ids = Array.from(document.querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid'));
    expect(ids).toContain(`${T}-vendor-invoice-fx1`);
    expect(ids.indexOf(`${T}-vendor-invoice-fx1`)).toBe(ids.indexOf(`${T}-facts-fx1`) + 1);
  });

  it('Recalculate all (bar): every line of the tab; nothing to do = nothing written', () => {
    mockBook = book();
    mount({ lines: [fxLine(), line('fx2', 'timeGenus', 2, { sumForContract: 100, sumVATForContract: 21 })], project, startMs: START });
    mockActions.updateOne.mockClear();
    press(`${T}-recalc-all`);
    expect(mockActions.updateOne.mock.calls.map((c) => c[0].rowGUID).sort()).toEqual(['fx1', 'fx2']);
    mockActions.updateOne.mockClear();
    press(`${T}-recalc-all`); // still the same rows in redux (the saga did not run): the lines are not changed again by the rates
    expect(mockActions.updateOne).toHaveBeenCalledTimes(2);
  });

  it('no rate of the asked type: only THAT currency stays empty (the other is converted all the same) and the line is marked with the reason (strict, no other type is used)', () => {
    mockBook = buildRateBook([cur('c-eur', 'EUR'), cur('c-usd', 'USD'), cur('c-gbp', 'GBP')], [rate('c-usd', '2026-03-02', 1.08), rate('c-gbp', '2026-01-02', 0.85)]); // no Budget rates
    mount({ lines: [fxLine()], project, startMs: START });
    // the first currency of the pair without a Budget rate (the line is in USD); the last day tried is today
    expect(q('task-line-problem-fx1')!.textContent).toMatch(/^No Budget exchange rate of USD on or before \d{4}-\d{2}-\d{2}$/);
    setNumber(`${TT}-cell-fx1-qty`, '20');
    const p = lastPatch();
    expect(typeof p.sumForAccounting).toBe('number'); // the Default rate exists: the accounting sums are there
    expect(p.sumForBudget === undefined || p.sumForBudget === null).toBe(true); // no Budget rate: strict, nothing else is used
  });

  it('the rates are still being read: nothing is converted and the saved sums are left alone', () => {
    mockBook = null;
    mount({ lines: [fxLine({ sumForAccounting: 1, sumForBudget: 2 })], project, startMs: START });
    setNumber(`${TT}-cell-fx1-qty`, '20');
    const p = lastPatch();
    expect(p.sumForContract).toBe(800);
    expect('sumForAccounting' in p).toBe(false);
    expect('fxSnapshotTaskLine' in p).toBe(false);
    expect(q('task-line-problem-fx1')).toBeNull();
  });

  it('the tab shows the sum in the accounting currency with its code', () => {
    mockBook = book();
    mount({ lines: [fxLine({ sumForAccounting: 370.37, sumVATForAccounting: 77.78 })], project, startMs: START });
    expect(q(`${T}-tab-timeGenus-sum`)!.textContent).toBe('370.37 EUR');
  });
});


describe('the budget item and the Post button (kit8/pm/view/task/plan)', () => {
  const MON = Date.UTC(2026, 9, 12); // Monday 2026-10-12
  const FRI_END = Date.UTC(2026, 9, 17); // exclusive finish: the task lasts Monday-Friday
  const weekdays = (from: string, to: string) => {
    const out: any[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
      const dow = new Date(t).getUTCDay();
      out.push({ rowJSON: { day: new Date(t).toISOString().slice(0, 10), isActive: dow !== 0 && dow !== 6 } });
    }
    return out;
  };
  const budgeted = (guid: string, genus: string, order: number, json: any = {}) =>
    line(guid, genus, order, { budgetItemTaskLine: genus === 'timeGenus' ? 'timeBudgetItem' : 'materialBudgetItem', distributionForBudgetTaskLine: 'uniformDistribution', qtyTaskLine: 10, sumForBudget: 100, sumForContract: 100, taskIsPosted: false, ...json });
  const text = () => q(`${TT}-post-text`)?.textContent;
  const postId = `${TT}-post`;
  beforeEach(() => { jest.spyOn(require('react-native').Dimensions, 'get').mockReturnValue({ width: 1400, height: 900, scale: 1, fontScale: 1 }); mockFetchDays.mockResolvedValue(weekdays('2026-01-01', '2026-12-31')); });
  afterEach(() => { jest.restoreAllMocks(); mockCreatePlan.mockClear(); mockFetchDays.mockClear(); });

  it('Budget item is the first data column (after the Errors column when there is one, before #), of the items of THIS genus only', () => {
    mount();
    const heads = Array.from(document.querySelectorAll(`[data-testid^="${TT}-header-"]`)).map((e) => e.getAttribute('data-testid'));
    expect(heads.filter((h) => h !== `${TT}-header-errors`).slice(0, 2)).toEqual([`${TT}-header-budgetItem`, `${TT}-header-n`]);
    expect(heads.indexOf(`${TT}-header-errors`)).toBeLessThan(heads.indexOf(`${TT}-header-budgetItem`)); // the Errors column stays the very first
    const props = mockSelectProps[`${TT}-cell-time1-budgetItem`];
    expect(props.entityName).toBe(BUDGET_ITEM_TABLE.entity);
    const item = (guid: string, genus: string | null, parent = 'costsBudgetFolder') => def(guid, 'budgetItemCatalog', parent, { title: guid, managementGenusItem: genus });
    expect(props.filterItem(item('timeBudgetItem', 'timeGenus'))).toBe(true);
    expect(props.filterItem(item('materialBudgetItem', 'materialGenus'))).toBe(false); // another genus
    expect(props.filterItem(item('costsBudgetFolder', null, 'empty'))).toBe(false); // a folder
  });

  it('+ Add: a new line gets the budget item of its genus (so it can be posted at once) and is NOT posted', () => {
    mount();
    press(`${TT}-add`);
    expect(mockActions.createOne.mock.calls[0][0].rowJSON).toMatchObject({ budgetItemTaskLine: 'timeBudgetItem', taskIsPosted: false });
    press(`${T}-tab-materialGenus`);
    press(`${TT}-add`);
    expect(mockActions.createOne.mock.calls[1][0].rowJSON).toMatchObject({ budgetItemTaskLine: 'materialBudgetItem', taskIsPosted: false });
  });

  it('the Post button is the first button of the bar; the text is "Post" while nothing was ever posted', () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1)] });
    expect(q(`${TT}-crud-panel`)!.firstElementChild!.getAttribute('data-testid')).toBe(postId);
    expect(text()).toBe('Post');
  });

  it('"Posted" when every budgeted line of the task is posted - also the lines of the OTHER tabs count', () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1, { taskIsPosted: true, baseOfDistribution: 1 }), budgeted('mat1', 'materialGenus', 2, { taskIsPosted: true, baseOfDistribution: 1 })] });
    expect(text()).toBe('Posted');
    act(() => root.unmount()); document.body.innerHTML = '';
    // the Material line changed: "Post needed" is shown on the Time tab too
    mount({ lines: [budgeted('time1', 'timeGenus', 1, { taskIsPosted: true, baseOfDistribution: 1 }), budgeted('mat1', 'materialGenus', 2, { taskIsPosted: false, baseOfDistribution: 1 })] });
    expect(text()).toBe('Post needed');
  });

  it('a change of a posted line makes the button "Post needed" and saves taskIsPosted false with the change', () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1, { taskIsPosted: true, baseOfDistribution: 1 })] });
    expect(text()).toBe('Posted');
    setNumber(`${TT}-cell-time1-qty`, '3');
    expect(mockActions.updateOne.mock.calls.at(-1)![0].rowJSON).toMatchObject({ qtyTaskLine: 3, taskIsPosted: false });
  });

  it('Post sends the whole task in ONE call: the days of the Monday-Friday task, the lines of all tabs, the totals as they are', async () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1), budgeted('mat1', 'materialGenus', 1, { sumForBudget: 0.01, sumForContract: null }), line('nobudget', 'timeGenus', 2, { qtyTaskLine: 1 })], startMs: MON, finishMs: FRI_END });
    await act(async () => { q(postId)!.click(); });
    expect(mockFetchDays).toHaveBeenCalledWith('workingDaysCalendar', '2026-01-01', '2026-12-31');
    expect(mockCreatePlan).toHaveBeenCalledTimes(1);
    const json = mockCreatePlan.mock.calls[0][0];
    expect(json.taskGUID).toBe('t1');
    expect(json.lines.map((l: any) => l.lineGUID)).toEqual(['time1', 'mat1']);
    const days = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'];
    expect(json.lines[0]).toEqual({ lineGUID: 'time1', baseOfDistribution: 1, qtyTaskLine: 10, sumForBudget: 100, sumForContract: 100, sumForAccounting: null, days: days.map((d) => ({ d, c: 0.2 })) });
    expect(json.lines[1]).toMatchObject({ lineGUID: 'mat1', sumForBudget: 0.01, sumForContract: null, sumForAccounting: null });   // an empty sum stays empty (also the accounting one)
    expect(mockDispatch.mock.calls.map((c) => c[0]).some((a) => a.type === 'snackbar' && /Posted 1 line/.test(a.p.message))).toBe(true);
  });

  it('the project\'s calendarForTaskPlan is the calendar read', async () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1)], startMs: MON, finishMs: FRI_END, project: { calendarForTaskPlan: 'myCalendar' } });
    await act(async () => { q(postId)!.click(); });
    expect(mockFetchDays).toHaveBeenCalledWith('myCalendar', '2026-01-01', '2026-12-31');
  });

  it('nothing is sent when the task cannot be planned (no dates, an unfilled year): the user is told why', async () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1)] });
    await act(async () => { q(postId)!.click(); });
    expect(mockCreatePlan).not.toHaveBeenCalled();
    expect(mockDispatch.mock.calls.map((c) => c[0]).some((a) => a.type === 'snackbar' && /no start and finish/.test(a.p.message))).toBe(true);
    act(() => root.unmount()); document.body.innerHTML = '';
    mockFetchDays.mockResolvedValue([]);
    mount({ lines: [budgeted('time1', 'timeGenus', 1)], startMs: MON, finishMs: FRI_END });
    await act(async () => { q(postId)!.click(); });
    expect(mockCreatePlan).not.toHaveBeenCalled();
    expect(mockDispatch.mock.calls.map((c) => c[0]).some((a) => a.type === 'snackbar' && /not filled for 2026/.test(a.p.message))).toBe(true);
  });

  it('a database refusal is shown, not thrown', async () => {
    mockCreatePlan.mockRejectedValueOnce(new Error('create_task_line_plan: line x has no days'));
    mount({ lines: [budgeted('time1', 'timeGenus', 1)], startMs: MON, finishMs: FRI_END });
    await act(async () => { q(postId)!.click(); });
    expect(mockDispatch.mock.calls.map((c) => c[0]).some((a) => a.type === 'snackbar' && /could not be posted.*no days/.test(a.p.message))).toBe(true);
  });

  it('the project colour is the background of the button', () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1)], color: '#00FF00' });
    expect(getComputedStyle(q(postId)!).backgroundColor).toMatch(/0, 255, 0|#00ff00/i);
  });

  it('a duplicated line is not posted', () => {
    mount({ lines: [budgeted('time1', 'timeGenus', 1, { taskIsPosted: true, baseOfDistribution: 1 })] });
    press(`${TT}-select-time1`);
    press(`${TT}-duplicate-selected`);
    expect(mockActions.createOne.mock.calls[0][0].rowJSON).toMatchObject({ budgetItemTaskLine: 'timeBudgetItem', taskIsPosted: false, baseOfDistribution: null });
  });
});


// ───────────────────────────────── the input switches and the equipment (recommendation/EQUIPMENT_TIME.html) ─────────────────────────────────
describe('input switches: the tabs and the kinds of a Time line a project offers', () => {
  // the Errors column is only there while a line has an error: not part of what is checked here
  const heads = () => Array.from(document.querySelectorAll(`[data-testid^="${TT}-header-"]`)).map((e) => e.getAttribute('data-testid')!.replace(`${TT}-header-`, '')).filter((k) => k !== 'errors');
  const ON = { projectExpenseBudgetNeeded: true };
  const tabs = () => ['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus'].filter((g) => q(`${T}-tab-${g}`));

  it('the switches are off (every project made before them): all four tabs, person lines, no menu, no equipment - exactly as before', () => {
    mount({ lines: [time1] });
    expect(tabs()).toEqual(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus']);
    expect(heads()).toContain('person');
    expect(heads()).toContain('personVariant');
    expect(heads()).not.toContain('resourceKind');
    expect(heads()).not.toContain('equipment');
    press(`${TT}-add`);
    // no kind is chosen: a line without a kind is a person's
    expect(mockActions.createOne.mock.calls[0][0].rowJSON.taskResourceKind).toBeNull();
  });

  it('master on with the defaults (Person on, Equipment off): the same as before', () => {
    mount({ lines: [time1], project: ON });
    expect(tabs()).toEqual(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus']);
    expect(heads()).toContain('person');
    expect(heads()).not.toContain('resourceKind');
  });

  it('Person AND Equipment: the menu "Resource" comes before the role and the resource; ONE resource column and ONE variant column', () => {
    mount({ lines: [time1], project: { ...ON, projectTimeOfEquipmentNeeded: true } });
    const h = heads();
    expect(h.slice(0, 3)).toEqual(['budgetItem', 'n', 'resourceKind']);
    expect(h.indexOf('resourceKind')).toBeLessThan(h.indexOf('role'));
    expect(h.indexOf('resourceKind')).toBeLessThan(h.indexOf('resource'));
    expect(h).toEqual(expect.arrayContaining(['resource', 'resourceVariant', 'contract']));
    expect(h).not.toContain('person');
    expect(h).not.toContain('equipment');
  });

  it('a new Time line of such a project says its kind: a person (the first choice of the menu)', () => {
    mount({ lines: [], project: { ...ON, projectTimeOfEquipmentNeeded: true } });
    press(`${TT}-add`);
    expect(mockActions.createOne.mock.calls[0][0].rowJSON).toMatchObject({ taskResourceKind: 'person', taskManagementGenusLine: 'timeGenus' });
  });

  it('the menu changes the kind; the resource column then picks from the equipment catalog; the person, the contract and the person role go', () => {
    mount({ lines: [line('tl1', 'timeGenus', 1, { resourceRoleItem: 'role_da', taskResourceItem: 'p1', taskResourceContract: 'c1', qtyTaskLine: 2 })], project: { ...ON, projectTimeOfEquipmentNeeded: true } });
    // before: a person row - the resource cell reads the person catalog
    expect(mockSelectProps[`${TT}-cell-tl1-resource`].entityName).toBe('personReusable');
    press(`${TT}-cell-tl1-resourceKind`);
    press(`${TT}-cell-tl1-resourceKind-picker-option-equipment`);
    const patch = mockActions.updateOne.mock.calls.at(-1)![0];
    expect(patch).toMatchObject({ rowGUID: 'tl1', rowOwnerGUID: 't1' });
    expect(patch.rowJSON).toMatchObject({ taskResourceKind: 'equipment', taskResourceItem: null, taskResourceContract: null, resourceRoleItem: null, taskIsPosted: false });
  });

  it('an equipment line: the resource cell reads the equipment catalog; the role picker offers the equipment roles only', () => {
    mount({ lines: [line('tl2', 'timeGenus', 1, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq1', qtyTaskLine: 8 })], project: { ...ON, projectTimeOfEquipmentNeeded: true } });
    expect(mockSelectProps[`${TT}-cell-tl2-resource`].entityName).toBe('equipmentReusable');
    expect(q(`${TT}-cell-tl2-resource`)!.textContent).toBe('eq1|on');
    const role = mockSelectProps[`${TT}-cell-tl2-role`];
    expect(role.filterItem(def('role_exc', 'type_eq', 'empty', {}))).toBe(true);
    expect(role.filterItem(def('role_da', 'type_hr', 'empty', {}))).toBe(false);
    expect(q('task-line-problem-tl2')).toBeNull();
  });

  it('an equipment line is priced by the rate of the role (95 per hour), 8 hours = 760', () => {
    mount({ lines: [line('tl3', 'timeGenus', 1, { taskResourceKind: 'equipment', resourceRoleItem: 'role_exc', taskResourceItem: 'eq1', qtyTaskLine: null })], project: { ...ON, projectTimeOfEquipmentNeeded: true } });
    setNumber(`${TT}-cell-tl3-qty`, '8');
    expect(mockActions.updateOne.mock.calls.at(-1)![0].rowJSON).toMatchObject({ qtyTaskLine: 8, priceTaskLine: 95, priceSourceTaskLine: 'role', sumForContract: 760 });
  });

  it('a role of the other kind on a line is marked, never refused', () => {
    mount({ lines: [line('tl4', 'timeGenus', 1, { taskResourceKind: 'equipment', resourceRoleItem: 'role_da' })], project: { ...ON, projectTimeOfEquipmentNeeded: true } });
    expect(q('task-line-problem-tl4')!.parentElement!.textContent).toContain('The role is not an equipment role');
  });

  it('Equipment only: Equipment and its variant, no menu, no Contract; a new line is an equipment line', () => {
    mount({ lines: [], project: { ...ON, projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true } });
    const h = heads();
    expect(h).toEqual(expect.arrayContaining(['equipment', 'equipmentVariant']));
    expect(h).not.toContain('resourceKind');
    expect(h).not.toContain('person');
    expect(h).not.toContain('contract');
    press(`${TT}-add`);
    expect(mockActions.createOne.mock.calls[0][0].rowJSON).toMatchObject({ taskResourceKind: 'equipment' });
  });

  it('Equipment only, and the task already has a person line: both kinds are offered (a switch never hides data)', () => {
    mount({ lines: [time1], project: { ...ON, projectTimeOfPersonNeeded: false, projectTimeOfEquipmentNeeded: true } });
    expect(heads()).toContain('resourceKind');
    expect(heads()).toContain('resource');
  });

  it('an EMPTY tab whose input is switched off is hidden; a tab that has lines stays', () => {
    mount({ lines: [], project: { ...ON, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false } });
    expect(tabs()).toEqual(['timeGenus', 'revenueGenus']);
    act(() => root.unmount());
    document.body.innerHTML = '';
    mount({ lines: [mat1], project: { ...ON, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false } });
    expect(tabs()).toEqual(['timeGenus', 'materialGenus', 'revenueGenus']);
    expect(q(`${T}-tab-materialGenus-count`)!.textContent).toBe('1');
  });

  it('Time off and no Time lines: the first tab that is offered is shown; the remembered place on a hidden tab falls back to it', () => {
    const place = makeLastEditPlace({ surface: 'financesView', section: 'finances', genus: 'timeGenus', lineGUID: 'x' }, 'u1')!;
    mount({ lines: [mat1], project: { ...ON, projectTimeCostsNeeded: false }, place });
    expect(tabs()).toEqual(['materialGenus', 'expenseGenus', 'revenueGenus']);
    expect(selectedTab('materialGenus')).toBe(true);
    expect(q(`${TT}-row-mat1`)).not.toBeNull();
  });

  it('with the master off the other switches are ignored: Time / Material / Expenses are all there', () => {
    mount({ lines: [], project: { projectExpenseBudgetNeeded: false, projectTimeCostsNeeded: false, projectMaterialCostsNeeded: false, projectExpenseCostsNeeded: false, projectTimeOfEquipmentNeeded: true } });
    expect(tabs()).toEqual(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus']);
    expect(heads()).not.toContain('resourceKind');
  });
});
