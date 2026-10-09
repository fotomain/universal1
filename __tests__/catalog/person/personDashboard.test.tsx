/** @jest-environment jsdom */
// PersonDashboard (ReusableTable approach, no folders): persons with types, person types, the descriptor sets of the person types,
// Properties (what a person IS, several certificates = several rows) and Variants (what he can be booked as), Checks - and the rows of the
// product and role sides of the shared tables stay out.
import React, { act } from 'react';
import { seedPersonCatalog } from './personTestKit';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
let mockParams: Record<string, string> = {};
const mockSetParams = jest.fn((p: any) => { mockParams = { ...mockParams, ...p }; });
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, setParams: mockSetParams }), usePathname: () => '/catalog/person/dashboard', useGlobalSearchParams: () => mockParams }));
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
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress }, R.createElement(Text, null, i.label)))) };
});
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
jest.mock('../../../kit8/ui/components/common/SelectorFromApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/SegmentButtonsApp', () => ({ __esModule: true, default: () => null }));

import PersonDashboard from '../../../kit8/catalog/person/dashboard/PersonDashboard';
import { PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import { PERSON_ENTITY } from '../../../kit8/catalog/person/personModel';
import { PERSON_TYPE_TABLE } from '../../../kit8/catalog/person/personTypeModel';
import { CONTRACT_ENTITY } from '../../../kit8/catalog/contract/contractModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const rowIds = (table: string) => qa(`${table}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${table}-row-`, '')).filter((x) => !x.includes('-'));
const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any = {}) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList: 0, rowJSON });

/** redux as the database: the shared tables hold the rows of THREE sides (products, roles, persons) */
function stateOf(opts: { empty?: boolean } = {}) {
  const p = opts.empty ? { ...seedPersonCatalog(), personType: [], person: [], descriptorDestination: [], descriptorPlan: [], propertyValue: [], variant: [], variantValue: [] } : seedPersonCatalog();
  const s: any = { uxuiState: { askBeforeDeletePost: true } };
  const set = (entity: string, rows: any[]) => { s[entity] = { entityDataFromServer: rows, readSuccessful: 1 }; };
  set(PERSON_TYPE_TABLE.entity, p.personType);
  set(PERSON_ENTITY, p.person);
  set(PRODUCT_TABLES.descriptorGenus.entity, p.descriptorGenus);
  set(PRODUCT_TABLES.descriptorValue.entity, p.descriptorValue);
  // the product side (smartphone1) and the role side (projectManager) own rows of the same tables
  set(PRODUCT_TABLES.descriptorDestination.entity, [...p.descriptorDestination, row('ds_sp_var', 'smartphone1', 'variant', { title: 'Smartphone – variants' }), row('ds_pm_var', 'projectManager', 'variant', { title: 'Project manager – variants' })]);
  set(PRODUCT_TABLES.descriptorPlan.entity, [...p.descriptorPlan, row('dp1', 'ds_sp_var', 'color'), row('dp10', 'ds_pm_var', 'seniority')]);
  set(PRODUCT_TABLES.propertyValue.entity, [...p.propertyValue, row('pp1', 'prod1', 'dp3'), row('pp7', 'role1', 'dp8')]);
  set(PRODUCT_TABLES.variant.entity, [...p.variant, row('pv1', 'smartphone1', 'empty', { title: 'Red / 256 GB' }), row('pv7', 'projectManager', 'empty', { title: 'Senior, English' })]);
  set(PRODUCT_TABLES.variantValue.entity, [...p.variantValue, row('pvd1', 'pv1', 'dp1'), row('pvd12', 'pv7', 'dp10')]);
  set(PRODUCT_TABLES.productType.entity, [row('smartphone1', 'productTypeCatalog', 'empty', { title: 'Smartphone' })]);
  set(PRODUCT_TABLES.product.entity, [row('prod1', 'smartphone1', 'empty', { title: 'Samsung Galaxy' })]);
  set(RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity, [row('projectManager', 'resourceRoleTypeCatalog', 'empty', { title: 'Project manager' })]);
  set(RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, [row('role1', 'projectManager', 'empty', { title: 'IT project manager' })]);
  set(CONTRACT_ENTITY, [row('c_john', 'john', 'person', {}), row('c_jane', 'jane', 'person', {}), row('c_jane_2', 'jane', 'person', {}), row('c_partner', 'partnerA', 'partner', {})]);
  return s;
}
function mount(params: Record<string, string> = {}, state: any = stateOf()) {
  mockParams = params;
  mockState = state;
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<PersonDashboard />));
}
const rerender = () => act(() => root.render(<PersonDashboard />));
const open = (tab: string) => { press(`person-nav-${tab}`); rerender(); };
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('Persons', () => {
  it('opens on the Persons table: the four persons, their types, and what they have (properties, variants, contracts)', () => {
    mount();
    expect(q('person-table-title')!.textContent).toBe('Persons');
    const T = 'person-table-person';
    expect(rowIds(T).sort()).toEqual(['anna', 'jane', 'john', 'peter']);
    expect(q(`${T}-cell-john-type`)!.textContent).toContain('Employee');
    expect(q(`${T}-cell-jane-type`)!.textContent).toContain('Contractor');
    expect(q('count-properties-john')!.textContent).toBe('3'); // experience + two certificates
    expect(q('count-variants-john')!.textContent).toBe('2');
    expect(q('count-contracts-jane')!.textContent).toBe('2'); // the contract of a partner is not hers
    expect(q('count-contracts-anna')!.textContent).toBe('0');
  });

  it('50 % / 50 %: the menu counts the persons, the person types table counts them per type', () => {
    mount();
    expect(q('person-nav-person')!.textContent).toContain('4');
    open('personType');
    expect(q('person-table-title')!.textContent).toBe('Person types');
    expect(q('count-persons-personTypeEmployee')!.textContent).toBe('2');
    expect(q('count-persons-personTypeContractor')!.textContent).toBe('2');
  });

  it('changing the type saves the type AND keeps personIsEmployee in step with it (Employee = true)', () => {
    mount();
    press('person-table-person-cell-jane-type');
    press('person-table-person-cell-jane-type-picker-option-personTypeEmployee');
    expect(calls('update', PERSON_ENTITY)).toContainEqual({ rowGUID: 'jane', rowOwnerGUID: 'personCatalog', rowJSON: { personType: 'personTypeEmployee', personIsEmployee: true } });
  });

  it('the row menu: Properties and Variants of the person (the table filtered by him), his page for the contracts', () => {
    mount();
    press('person-table-person-menu-button-john');
    press('person-open-properties-john');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'propertyValue' }));
    rerender();
    expect(q('person-table-title')!.textContent).toBe('Properties');
    expect(rowIds('person-table-propertyValue').sort()).toEqual(['pp_cert_john_1', 'pp_cert_john_2', 'pp_exp_john']);
    expect(q('person-filter-person')!.textContent).toContain('John Doe');
    expect(q('person-table-back')).not.toBeNull();
    press('person-table-back');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'person', focusRowGUID: 'john' }));
    press('person-nav-person');
    rerender();
    press('person-table-person-menu-button-john');
    press('person-open-page-john');
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/catalog/person/edit', params: { rowGUID: 'john' } });
  });
});

describe('Properties and Variants of a person', () => {
  it('Properties: a certificate is a row of its own; the product and role rows of the shared table are not listed', () => {
    mount({ tab: 'propertyValue' });
    const ids = rowIds('person-table-propertyValue');
    expect(ids).toHaveLength(7);
    expect(ids).not.toContain('pp1'); // a product property
    expect(ids).not.toContain('pp7'); // a role property
    expect(q('person-table-propertyValue-cell-pp_cert_john_1-plan')!.textContent).toContain('Certification');
    expect(q('person-table-propertyValue-cell-pp_cert_john_2-plan')!.textContent).toContain('Certification');
  });

  it('a new property row gets the person of the filter', () => {
    mount({ tab: 'propertyValue' });
    press('person-filter-person');
    press('person-filter-picker-option-anna');
    expect(rowIds('person-table-propertyValue')).toEqual(['pp_exp_anna']);
    press('person-table-propertyValue-add');
    expect(calls('create', PRODUCT_TABLES.propertyValue.entity)[0]).toMatchObject({ rowOwnerGUID: 'anna' });
  });

  it('Variants: only the variants of persons; a person lists his own', () => {
    mount({ tab: 'variant' });
    expect(rowIds('person-table-variant').sort()).toEqual(['pvar_anna_1', 'pvar_jane_1', 'pvar_john_1', 'pvar_john_2']);
    expect(q('count-values-pvar_john_2')!.textContent).toBe('Senior · Latvian');
    expect(q('person-generate-variants')).not.toBeNull();
  });

  it('Descriptor sets: the sets of the person types only', () => {
    mount({ tab: 'descriptorDestination' });
    expect(rowIds('person-table-descriptorDestination').sort()).toEqual(['ds_con_prop', 'ds_con_var', 'ds_emp_prop', 'ds_emp_var']);
    expect(q('count-lines-ds_emp_var')!.textContent).toBe('2');
  });

  it('Descriptors: the person columns (several values, satisfies, compared) beside the common ones', () => {
    mount({ tab: 'descriptorGenus' });
    expect(q('person-table-descriptorGenus-header-multiple')).not.toBeNull();
    expect(q('person-table-descriptorGenus-header-satisfies')).not.toBeNull();
    expect(q('person-table-descriptorGenus-cell-experienceYears-satisfies')!.textContent).toContain('Min. experience, years');
  });
});

describe('Checks and setup', () => {
  it('the SQL data is clean: no issues, no badge', () => {
    mount({ tab: 'checks' });
    expect(q('person-checks')!.textContent).toContain('No problems found');
    expect(q('person-nav-checks-issues')).toBeNull();
  });

  it('a second value of a single-value descriptor is an error: the badge, the line, and the table opens on that row', () => {
    const s = stateOf();
    s[PRODUCT_TABLES.propertyValue.entity].entityDataFromServer.push(row('pp_dup', 'john', 'dp_emp_p1', { value: 9 }));
    mount({ tab: 'checks' }, s);
    expect(q('person-nav-checks-issues')!.textContent).toBe('1');
    expect(q('person-issue-0')!.textContent).toContain('R8');
    press('person-issue-0');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'propertyValue', focusRowGUID: 'pp_dup' }));
  });

  it('no person tables yet: the setup hint names both SQL files', () => {
    mount({}, stateOf({ empty: true }));
    expect(q('person-setup')!.textContent).toContain('create_person_type_table.sql');
    expect(q('person-setup')!.textContent).toContain('create_person_descriptors.sql');
  });
});
