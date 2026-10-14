/** @jest-environment jsdom */
// EquipmentDashboard (ReusableTable approach, no folders): equipment with types, equipment types, the descriptor sets of the equipment types,
// Properties (what an equipment IS: engine power) and Variants (what it can be booked as: Heavy, With operator), Checks - and the rows of the
// product, role and person sides of the shared tables stay out.
import React, { act } from 'react';
import { seedEquipmentCatalog } from './equipmentTestKit';

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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, setParams: mockSetParams }), usePathname: () => '/catalog/equipment/dashboard', useGlobalSearchParams: () => mockParams }));
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

import EquipmentDashboard from '../../../kit8/catalog/equipment/dashboard/EquipmentDashboard';
import { PRODUCT_TABLES } from '../../../kit8/catalog/product/productModel';
import { RESOURCE_ROLE_OWN_TABLES } from '../../../kit8/catalog/resourcerole/resourceRoleModel';
import { PERSON_ENTITY } from '../../../kit8/catalog/person/personModel';
import { PERSON_TYPE_TABLE } from '../../../kit8/catalog/person/personTypeModel';
import { EQUIPMENT_ENTITY } from '../../../kit8/catalog/equipment/equipmentModel';
import { EQUIPMENT_TYPE_TABLE } from '../../../kit8/catalog/equipment/equipmentTypeModel';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const calls = (kind: string, entity: string) => mockCalls.filter((c) => c[0] === kind && c[1] === entity).map((c) => c[2]);
const rowIds = (table: string) => qa(`${table}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${table}-row-`, '')).filter((x) => !x.includes('-'));
const row = (rowGUID: string, rowOwnerGUID: string, rowParentGUID: string, rowJSON: any = {}) => ({ rowGUID, rowOwnerGUID, rowParentGUID, orderInList: 0, rowJSON });

/** redux as the database: the shared tables hold the rows of FOUR sides (products, roles, persons, equipment) */
function stateOf(opts: { empty?: boolean } = {}) {
  const p = opts.empty ? { ...seedEquipmentCatalog(), equipmentType: [], equipment: [], descriptorDestination: [], descriptorPlan: [], propertyValue: [], variant: [], variantValue: [] } : seedEquipmentCatalog();
  const s: any = { uxuiState: { askBeforeDeletePost: true } };
  const set = (entity: string, rows: any[]) => { s[entity] = { entityDataFromServer: rows, readSuccessful: 1 }; };
  set(EQUIPMENT_TYPE_TABLE.entity, p.equipmentType);
  set(EQUIPMENT_ENTITY, p.equipment);
  set(PRODUCT_TABLES.descriptorGenus.entity, p.descriptorGenus);
  set(PRODUCT_TABLES.descriptorValue.entity, p.descriptorValue);
  // the product side (smartphone1), the role side (projectManager) and the person side (personTypeEmployee) own rows of the same tables
  set(PRODUCT_TABLES.descriptorDestination.entity, [...p.descriptorDestination, row('ds_sp_var', 'smartphone1', 'variant'), row('ds_pm_var', 'projectManager', 'variant'), row('ds_emp_var', 'personTypeEmployee', 'variant')]);
  set(PRODUCT_TABLES.descriptorPlan.entity, [...p.descriptorPlan, row('dp1', 'ds_sp_var', 'color'), row('dp10', 'ds_pm_var', 'seniority'), row('dp_emp_v1', 'ds_emp_var', 'seniority')]);
  set(PRODUCT_TABLES.propertyValue.entity, [...p.propertyValue, row('pp1', 'prod1', 'dp3'), row('pp7', 'role1', 'dp8'), row('pp_exp_john', 'john', 'dp_emp_p1')]);
  set(PRODUCT_TABLES.variant.entity, [...p.variant, row('pv1', 'smartphone1', 'empty', { title: 'Red / 256 GB' }), row('pv7', 'projectManager', 'empty', { title: 'Senior, English' }), row('pvar_john_1', 'john', 'empty', { title: 'Senior, English' })]);
  set(PRODUCT_TABLES.variantValue.entity, [...p.variantValue, row('pvd1', 'pv1', 'dp1'), row('pvd12', 'pv7', 'dp10'), row('pvv_john_1_s', 'pvar_john_1', 'dp_emp_v1')]);
  set(PRODUCT_TABLES.productType.entity, [row('smartphone1', 'productTypeCatalog', 'empty', { title: 'Smartphone' })]);
  set(PRODUCT_TABLES.product.entity, [row('prod1', 'smartphone1', 'empty', { title: 'Samsung Galaxy' })]);
  set(RESOURCE_ROLE_OWN_TABLES.resourceRoleType.entity, [row('projectManager', 'resourceRoleTypeCatalog', 'empty', { title: 'Project manager' })]);
  set(RESOURCE_ROLE_OWN_TABLES.resourceRole.entity, [row('role1', 'projectManager', 'empty', { title: 'IT project manager' })]);
  set(PERSON_TYPE_TABLE.entity, [row('personTypeEmployee', 'personTypeCatalog', 'empty', { title: 'Employee' })]);
  set(PERSON_ENTITY, [row('john', 'personCatalog', 'empty', { personFirstName: 'John', personType: 'personTypeEmployee' })]);
  return s;
}
function mount(params: Record<string, string> = {}, state: any = stateOf()) {
  mockParams = params;
  mockState = state;
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<EquipmentDashboard />));
}
const rerender = () => act(() => root.render(<EquipmentDashboard />));
const open = (tab: string) => { press(`equipment-nav-${tab}`); rerender(); };
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('Equipment', () => {
  it('opens on the Equipment table: the three machines, their types, ownership and what they have (properties, variants)', () => {
    mount();
    expect(q('equipment-table-title')!.textContent).toBe('Equipment');
    const T = 'equipment-table-equipment';
    expect(rowIds(T).sort()).toEqual(['eq_cat320', 'eq_crafter', 'eq_jcb3cx']);
    expect(q(`${T}-cell-eq_cat320-type`)!.textContent).toContain('Heavy machinery');
    expect(q(`${T}-cell-eq_crafter-type`)!.textContent).toContain('Vehicle');
    expect(q(`${T}-cell-eq_jcb3cx-ownership`)!.textContent).toContain('Rented');
    expect(q('count-properties-eq_cat320')!.textContent).toBe('2'); // engine power + year
    expect(q('count-variants-eq_cat320')!.textContent).toBe('2');
    expect(q('count-variants-eq_jcb3cx')!.textContent).toBe('1');
  });

  it('the header and the menu count the equipment; the types table counts them per type', () => {
    mount();
    expect(q('equipment-nav-equipment')!.textContent).toContain('3');
    open('equipmentType');
    expect(q('equipment-table-title')!.textContent).toBe('Equipment types');
    expect(q('count-equipment-equipmentTypeHeavy')!.textContent).toBe('2');
    expect(q('count-equipment-equipmentTypeVehicle')!.textContent).toBe('1');
  });

  it('+ Add creates an equipment of the equipment catalog with the empty row (own, active)', () => {
    mount();
    press('equipment-table-equipment-add');
    const created = calls('create', EQUIPMENT_ENTITY)[0];
    expect(created).toMatchObject({ rowOwnerGUID: 'equipmentCatalog' });
    expect(created.rowJSON).toMatchObject({ equipmentOwnership: 'own', isActive: true, equipmentType: null });
  });

  it('changing the type saves the type', () => {
    mount();
    press('equipment-table-equipment-cell-eq_crafter-type');
    press('equipment-table-equipment-cell-eq_crafter-type-picker-option-equipmentTypeHeavy');
    expect(calls('update', EQUIPMENT_ENTITY)).toContainEqual({ rowGUID: 'eq_crafter', rowOwnerGUID: 'equipmentCatalog', rowJSON: { equipmentType: 'equipmentTypeHeavy' } });
  });

  it('the row menu: Properties and Variants of the equipment (the table filtered by it), and the way back', () => {
    mount();
    press('equipment-table-equipment-menu-button-eq_cat320');
    press('equipment-open-properties-eq_cat320');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'propertyValue' }));
    rerender();
    expect(q('equipment-table-title')!.textContent).toBe('Properties');
    expect(rowIds('equipment-table-propertyValue').sort()).toEqual(['pp_eq_pow_eq_cat320', 'pp_eq_year_eq_cat320']);
    expect(q('equipment-filter-equipment')!.textContent).toContain('Excavator CAT 320');
    press('equipment-table-back');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'equipment', focusRowGUID: 'eq_cat320' }));
  });
});

describe('Properties and Variants of an equipment', () => {
  it('Properties: only the property values of equipment - the rows of the product, role and person sides are not listed', () => {
    mount({ tab: 'propertyValue' });
    const ids = rowIds('equipment-table-propertyValue');
    expect(ids).toHaveLength(4);
    for (const other of ['pp1', 'pp7', 'pp_exp_john']) expect(ids).not.toContain(other);
    expect(q('equipment-table-propertyValue-cell-pp_eq_pow_eq_cat320-plan')!.textContent).toContain('Engine power, kW');
  });

  it('Variants: only the variants of equipment; an equipment lists its own, with their values', () => {
    mount({ tab: 'variant' });
    expect(rowIds('equipment-table-variant').sort()).toEqual(['evar_eq_cat320_a', 'evar_eq_cat320_b', 'evar_eq_crafter_a', 'evar_eq_jcb3cx_a']);
    expect(q('count-values-evar_eq_cat320_a')!.textContent).toBe('Heavy · With operator');
    expect(q('equipment-generate-variants')).not.toBeNull();
  });

  it('Variant values and Descriptor sets: the equipment side only', () => {
    mount({ tab: 'variantValue' });
    expect(rowIds('equipment-table-variantValue')).toHaveLength(8);
    open('descriptorDestination');
    expect(rowIds('equipment-table-descriptorDestination').sort()).toEqual(['ds_eqh_prop', 'ds_eqh_var', 'ds_eqv_prop', 'ds_eqv_var']);
    expect(q('count-lines-ds_eqh_var')!.textContent).toBe('2');
  });

  it('a new property row gets the equipment of the filter', () => {
    mount({ tab: 'propertyValue' });
    press('equipment-filter-equipment');
    press('equipment-filter-picker-option-eq_crafter');
    expect(rowIds('equipment-table-propertyValue')).toEqual(['pp_eq_pow_eq_crafter']);
    press('equipment-table-propertyValue-add');
    expect(calls('create', PRODUCT_TABLES.propertyValue.entity)[0]).toMatchObject({ rowOwnerGUID: 'eq_crafter' });
  });

  it('Descriptors: the "satisfies" column answers a role descriptor (Engine power answers Min. engine power)', () => {
    mount({ tab: 'descriptorGenus' });
    expect(q('equipment-table-descriptorGenus-header-satisfies')).not.toBeNull();
    expect(q('equipment-table-descriptorGenus-cell-enginePowerKw-satisfies')!.textContent).toContain('Min. engine power, kW');
  });
});

describe('Checks and setup', () => {
  it('the SQL data is clean: no issues, no badge', () => {
    mount({ tab: 'checks' });
    expect(q('equipment-checks')!.textContent).toContain('No problems found');
    expect(q('equipment-nav-checks-issues')).toBeNull();
  });

  it('a second value of a single-value descriptor is an error: the badge, the line, and the table opens on that row', () => {
    const s = stateOf();
    s[PRODUCT_TABLES.propertyValue.entity].entityDataFromServer.push(row('pp_dup', 'eq_cat320', 'dp_eqh_p1', { value: 9 }));
    mount({ tab: 'checks' }, s);
    expect(q('equipment-nav-checks-issues')!.textContent).toBe('1');
    expect(q('equipment-issue-0')!.textContent).toContain('R8');
    press('equipment-issue-0');
    expect(mockSetParams).toHaveBeenLastCalledWith(expect.objectContaining({ tab: 'propertyValue', focusRowGUID: 'pp_dup' }));
  });

  it('no equipment tables yet: the setup hint names the SQL file', () => {
    mount({}, stateOf({ empty: true }));
    expect(q('equipment-setup')!.textContent).toContain('start1_sql_structure.sql');
  });
});
