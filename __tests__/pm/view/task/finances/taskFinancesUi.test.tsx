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
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY, TEMPLATE_RESOURCE_CONTRACT_ROUTES } from '../../../../../kit8/catalog/management/templateresourcecontract/templateResourceContractModel';
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
    [MANAGEMENT_GENUS_TABLE.entity]: { entityDataFromServer: [def('timeGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Time' }), def('materialGenus', 'managementGenusCatalog', 'costsGenus', { title: 'Material' })] },
    [RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity]: { entityDataFromServer: [
      def('type_hr', 'resourceRoleTypeCatalog', 'empty', { managementGenus: 'timeGenus', baseUnit: 'unit_hour', roleVATDefaultRate: 'vat_0', variantMode: 'perType', variantSet: 'ds_hr_var' }),
      def('type_mat', 'resourceRoleTypeCatalog', 'empty', { managementGenus: 'materialGenus', baseUnit: 'unit_pcs', variantMode: 'none' }),
    ] },
    [RESOURCE_ROLE_OWN_TABLES.resourceRole.entity]: { entityDataFromServer: [def('role_da', 'type_hr', 'empty', { title: 'Data analyst' }), def('role_wood', 'type_mat', 'empty', { title: 'Wood role' })] },
    [RESOURCE_ROLE_OWN_TABLES.rolePrice.entity]: { entityDataFromServer: [def('rp1', 'role_da', 'empty', { priceTypeGUID: 'pt_cost', price: 40, measureUnit: 'unit_hour', validFrom: '2020-01-01' })] },
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
function mount(opts: { lines?: any[]; place?: any; stage?: boolean; project?: Record<string, any>; startMs?: number } = {}) {
  mockPM = {
    selectRowCheckBoxForm: 'formRound',
    tasksById: { t1: { rowGUID: 't1', rowJSON: { rowKind: opts.stage ? 'stage' : 'task', name: 'Task' } } },
    schedule: { t1: { isSummary: !!opts.stage, startMs: opts.startMs } },
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
    expect(created.rowJSON).toMatchObject({ resourceRoleItem: null, taskResourceItem: null, qtyTaskLine: null, sumForContract: null });
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'materialGenus', lineGUID: created.rowGUID });
  });

  it('a quantity gives the sums in the same save, and the place is reported', () => {
    mount();
    setNumber(`${TT}-cell-time1-qty`, '3');
    expect(mockActions.updateOne).toHaveBeenCalledWith({
      rowGUID: 'time1', rowOwnerGUID: 't1',
      rowJSON: { qtyTaskLine: 3, sumForContract: 120 }, // the VAT sum was 0 and stays 0: nothing to write
    });
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'timeGenus', lineGUID: 'time1' });
  });

  it('choosing a role fills the unit, the VAT and the price of the catalog (once)', () => {
    mount({ lines: [line('r1', 'timeGenus', 1, { resourceRoleItem: null, qtyTaskLine: null, priceTaskLine: null, measureUnitTaskLine: null, vatRatioTaskLine: null })] });
    mockPick.resourceRoleReusable = 'role_da';
    press(`${TT}-cell-r1-role`);
    expect(mockActions.updateOne).toHaveBeenCalledWith({
      rowGUID: 'r1', rowOwnerGUID: 't1',
      rowJSON: { resourceRoleItem: 'role_da', priceTaskLine: 40, priceAutoTaskLine: 40, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, priceSourceTaskLine: 'role' },
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
    expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'pa1', rowOwnerGUID: 't1', rowJSON: { taskResourceAttributesKey: 'dp_emp_v1=dvJunior|dp_emp_v2=dvLv' } });
    expect(onEditPlace).toHaveBeenLastCalledWith({ genus: 'timeGenus', lineGUID: 'pa1' });
  });

  it('the cell shows the chosen variant; one that does not cover the role is marked and says what is missing', () => {
    mount({ lines: [pa({ taskResourceAttributesKey: 'dp_emp_v1=dvJunior|dp_emp_v2=dvLv' })] });
    expect(q(cell)!.textContent).toContain('Junior, Latvian');
    expect(q('task-line-problem-pa1')!.textContent).toBe('The variant "Junior, Latvian" does not cover the role: needs Seniority = Senior, Working language = English');
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
      rowJSON: { taskResourceContract: 'c1', priceTaskLine: 20, priceAutoTaskLine: 20, measureUnitTaskLine: 'unit_hour', vatRatioTaskLine: 0, priceSourceTaskLine: 'contract' },
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
    expect(mockActions.updateOne).toHaveBeenLastCalledWith({ rowGUID: 'm1', rowOwnerGUID: 't1', rowJSON: { resourceContractTemplateTaskLine: 'tpl_mat' } });
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
    expect(q(`${TT}-header-sumAcc`)!.textContent).toContain('Sum EUR');
    expect(q(`${TT}-header-sumVATAcc`)!.textContent).toContain('VAT EUR');
    expect(q(`${TT}-header-sumBud`)!.textContent).toContain('Sum GBP');
    expect(q(`${TT}-header-sumVATBud`)!.textContent).toContain('VAT GBP');
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

  it('no rate of the asked type: the sums stay empty and the line is marked with the reason (strict, no other type is used)', () => {
    mockBook = buildRateBook([cur('c-eur', 'EUR'), cur('c-usd', 'USD'), cur('c-gbp', 'GBP')], [rate('c-usd', '2026-03-02', 1.08), rate('c-gbp', '2026-01-02', 0.85)]); // no Budget rates
    mount({ lines: [fxLine()], project, startMs: START });
    // the first currency of the pair without a Budget rate (the line is in USD); the last day tried is today
    expect(q('task-line-problem-fx1')!.textContent).toMatch(/^No Budget exchange rate of USD on or before \d{4}-\d{2}-\d{2}$/);
    setNumber(`${TT}-cell-fx1-qty`, '20');
    const p = lastPatch();
    expect(p.sumForAccounting === undefined || p.sumForAccounting === null).toBe(true);
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
