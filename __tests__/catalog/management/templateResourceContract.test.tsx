/** @jest-environment jsdom */
// TemplateResourceContractCRUD: the templates of the resource contract (rowOwnerGUID = management genus) - chips per genus, a ReusableTable,
// a new row belongs to the genus of the chip.
import React, { act } from 'react';
import { genusRows } from '../resourcerole/resourceRoleTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }), usePathname: () => '/catalog/management/templateresourcecontract/list', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: '#eee' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `uuid-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn(() => 'subscribed') }));
const mockCalls: any[] = [];
const mockActionsFor = (entity: string) => ({
  readData: (p: any) => ({ type: `${entity}/readData`, p }),
  createOne: (p: any) => { mockCalls.push(['create', entity, p]); return { type: `${entity}/createOne`, p }; },
  updateOne: (p: any) => { mockCalls.push(['update', entity, p]); return { type: `${entity}/updateOne`, p }; },
  deleteOne: (p: any) => { mockCalls.push(['delete', entity, p]); return { type: `${entity}/deleteOne`, p }; },
});
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: (_t, k: string) => ({ actions: mockActionsFor(k) }) }) }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch, shallowEqual: jest.requireActual('react-redux').shallowEqual }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/store/store_pm', () => ({ usePMStore: (sel: any) => sel({ selectRowCheckBoxForm: 'formRound' }) }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

import TemplateResourceContractCRUD from '../../../kit8/catalog/management/templateresourcecontract/TemplateResourceContractCRUD';
import { TEMPLATE_RESOURCE_CONTRACT_ENTITY, TEMPLATE_RESOURCE_CONTRACT_TABLE, emptyTemplateResourceContract } from '../../../kit8/catalog/management/templateresourcecontract/templateResourceContractModel';
import { templateResourceContractSystemMetaData } from '../../../kit8/catalog/management/templateresourcecontract/templateResourceContractMetaData';
import { MANAGEMENT_GENUS_TABLE } from '../../../kit8/catalog/management/genus/managementGenusModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const rowIds = (table: string) => qa(`${table}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${table}-row-`, '')).filter((x) => !x.includes('-'));
const tpl = (guid: string, genus: string, order: number, json: any = {}) => ({ rowGUID: guid, rowOwnerGUID: genus, rowParentGUID: 'empty', orderInList: order, rowJSON: { ...emptyTemplateResourceContract(), title: guid, ...json } });

const TEMPLATES = [
  tpl('tpl_time_service', 'timeGenus', 1000), tpl('tpl_material_supply', 'materialGenus', 2000), tpl('tpl_material_onetime', 'materialGenus', 2100),
  tpl('tpl_expense_service', 'expenseGenus', 3000), tpl('tpl_revenue_sales', 'revenueGenus', 4000),
];
function mount(props: { genus?: string | null } = {}, opts: { genus?: any[]; templates?: any[] } = {}) {
  mockState = {
    uxuiState: { askBeforeDeletePost: true },
    [MANAGEMENT_GENUS_TABLE.entity]: { entityDataFromServer: opts.genus ?? genusRows(), readSuccessful: 1 },
    [TEMPLATE_RESOURCE_CONTRACT_ENTITY]: { entityDataFromServer: opts.templates ?? TEMPLATES, readSuccessful: 1 },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<TemplateResourceContractCRUD {...props} />));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });
const T = 'tpl-contract-table';

describe('the table of templates', () => {
  it('rowOwnerGUID is the management genus: the entity, the table and the empty row', () => {
    expect(TEMPLATE_RESOURCE_CONTRACT_TABLE).toMatchObject({ table: 'templateResourceContractTable', entity: 'templateResourceContractReusable', catalogOwner: null });
    expect(templateResourceContractSystemMetaData().templateResourceContractReusable).toMatchObject({ tableName: 'templateResourceContractTable', itemLabel: 'Template' });
    expect(Object.keys(emptyTemplateResourceContract())).toEqual(['title', 'description', 'requirements', 'contractType', 'paymentsPeriod', 'paymentTermDays', 'currency', 'vatRate', 'deliveryTerms', 'validityDays', 'isActive']);
  });

  it('chips: All and one per LEAF genus (the folders of the genus tree are not genus), each with its count', () => {
    mount();
    const chips = qa('tpl-contract-chip-').map((e) => e.getAttribute('data-testid')!.replace('tpl-contract-chip-', ''));
    expect(chips[0]).toBe('*');
    expect(chips).toEqual(expect.arrayContaining(['timeGenus', 'materialGenus', 'expenseGenus', 'revenueGenus']));
    expect(chips).not.toContain('costsGenus');
    expect(chips).not.toContain('revenuesGenus');
    expect(q('tpl-contract-chip-*')!.textContent).toContain('5');
    expect(q('tpl-contract-chip-materialGenus')!.textContent).toContain('2');
    expect(q('tpl-contract-chip-timeGenus')!.textContent).toContain('1');
  });

  it('All shows every template; a chip shows the templates of THAT genus only', () => {
    mount();
    expect(rowIds(T)).toHaveLength(5);
    press('tpl-contract-chip-materialGenus');
    expect(rowIds(T).sort()).toEqual(['tpl_material_onetime', 'tpl_material_supply']);
    expect(q('tpl-contract-chip-materialGenus')!.getAttribute('aria-selected')).toBe('true');
    press('tpl-contract-chip-expenseGenus');
    expect(rowIds(T)).toEqual(['tpl_expense_service']);
  });

  it('a new template belongs to the genus of the chip (rowOwnerGUID can never be empty); on All: the first genus', () => {
    mount();
    press('tpl-contract-chip-expenseGenus');
    press(`${T}-add`);
    expect(mockCalls.find((c) => c[0] === 'create')![2]).toMatchObject({ rowOwnerGUID: 'expenseGenus', rowParentGUID: 'empty', rowJSON: { isActive: true, currency: 'EUR' } });
    mockCalls.length = 0;
    press('tpl-contract-chip-*');
    press(`${T}-add`);
    const created = mockCalls.find((c) => c[0] === 'create')![2];
    expect(created.rowOwnerGUID).toBe('timeGenus');
    expect(created.rowOwnerGUID).not.toBe('empty');
  });

  it('the genus of a template is edited in place (the root column rowOwnerGUID); the columns are those of the sheet', () => {
    mount();
    for (const key of ['genus', 'title', 'contractType', 'paymentsPeriod', 'paymentTermDays', 'currency', 'vatRate', 'validityDays', 'deliveryTerms', 'requirements', 'description', 'isActive']) {
      expect(q(`${T}-header-${key}`)).not.toBeNull();
    }
    press(`${T}-cell-tpl_time_service-genus`);
    press(`${T}-cell-tpl_time_service-genus-picker-option-expenseGenus`);
    expect(mockCalls.find((c) => c[0] === 'update')![2]).toMatchObject({ rowGUID: 'tpl_time_service', columns: { rowOwnerGUID: 'expenseGenus' } });
  });

  it('a fixed genus: only its templates, no chips', () => {
    mount({ genus: 'materialGenus' });
    expect(q('tpl-contract-chips')).toBeNull();
    expect(rowIds(T).sort()).toEqual(['tpl_material_onetime', 'tpl_material_supply']);
    press(`${T}-add`);
    expect(mockCalls.find((c) => c[0] === 'create')![2]).toMatchObject({ rowOwnerGUID: 'materialGenus' });
  });

  it('no management genus yet: the setup hint names the SQL files', () => {
    mount({}, { genus: [], templates: [] });
    expect(q('tpl-contract-setup')!.textContent).toContain('create_management_genus_table.sql');
    expect(q('tpl-contract-setup')!.textContent).toContain('create_template_resource_contract_table.sql');
  });
});
