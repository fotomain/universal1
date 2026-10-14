/** @jest-environment jsdom */
// BudgetScenarioCRUD + the model of the budget scenarios (budgetScenarioTable, a plain list: Plan | Fact).
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), setParams: jest.fn() }), usePathname: () => '/budget/scenario/list', useGlobalSearchParams: () => ({}) }));
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

jest.mock('../../../kit8/ui/components/common/SwitchApp', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/SegmentButtonsApp', () => ({ __esModule: true, default: () => null }));
import BudgetScenarioCRUD from '../../../kit8/catalog/budget/scenario/BudgetScenarioCRUD';
import {
  BUDGET_SCENARIO_TABLE, budgetScenariosOfKind, emptyBudgetScenario, projectBudgetScenariosError,
} from '../../../kit8/catalog/budget/scenario/budgetScenarioModel';
import { budgetScenarioSystemMetaData } from '../../../kit8/catalog/budget/scenario/budgetScenarioMetaData';
import { budgetsValuesOf } from '../../../kit8/pm/view/project/settings/PMProjectBudgetsTab';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const qa = (prefix: string) => Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`));
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const rowIds = (table: string) => qa(`${table}-row-`).map((e) => String(e.getAttribute('data-testid')).replace(`${table}-row-`, '')).filter((x) => !x.includes('-'));
const sc = (guid: string, kind: string, order: number, json: any = {}) => ({ rowGUID: guid, rowOwnerGUID: 'budgetScenarioCatalog', rowParentGUID: 'empty', orderInList: order, rowJSON: { ...emptyBudgetScenario(), title: guid, scenarioKind: kind, ...json } });
const ROWS = [sc('planScenarioProject1', 'plan', 10), sc('factScenarioProject1', 'fact', 20), sc('planOld', 'plan', 30, { isActive: false })];

afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); mockCalls.length = 0; });

describe('the model', () => {
  it('the table, the entity and the empty row', () => {
    expect(BUDGET_SCENARIO_TABLE).toMatchObject({ table: 'budgetScenarioTable', entity: 'budgetScenarioReusable', catalogOwner: 'budgetScenarioCatalog' });
    expect(budgetScenarioSystemMetaData().budgetScenarioReusable).toMatchObject({ tableName: 'budgetScenarioTable', itemLabel: 'Budget scenario' });
    expect(emptyBudgetScenario()).toEqual({ title: null, description: null, scenarioKind: 'plan', isActive: true });
  });
  it('the picker of a kind offers that kind, active, in order; the one already chosen stays even when inactive', () => {
    expect(budgetScenariosOfKind(ROWS, 'plan').map((r) => r.rowGUID)).toEqual(['planScenarioProject1']);
    expect(budgetScenariosOfKind(ROWS, 'plan', 'planOld').map((r) => r.rowGUID)).toEqual(['planScenarioProject1', 'planOld']);
    expect(budgetScenariosOfKind(ROWS, 'fact').map((r) => r.rowGUID)).toEqual(['factScenarioProject1']);
  });
  it('a project cannot point the Plan field at a fact scenario (and the reverse); nothing is said before the rows are read', () => {
    expect(projectBudgetScenariosError({ budgetScenarioForPlan: 'factScenarioProject1' }, ROWS, true)).toContain('budgetScenarioForPlan');
    expect(projectBudgetScenariosError({ budgetScenarioForFact: 'planScenarioProject1' }, ROWS, true)).toContain('budgetScenarioForFact');
    expect(projectBudgetScenariosError({ budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factScenarioProject1' }, ROWS, true)).toBeNull();
    expect(projectBudgetScenariosError({ budgetScenarioForPlan: 'factScenarioProject1' }, ROWS, false)).toBeNull();
    expect(projectBudgetScenariosError({ budgetScenarioForPlan: 'unknown' }, ROWS, true)).toBeNull();
  });
  it('the two project fields are part of the Budgets settings values (empty = none: an old project stays as it is)', () => {
    expect(budgetsValuesOf(null)).toMatchObject({ budgetScenarioForPlan: null, budgetScenarioForFact: null });
    expect(budgetsValuesOf({ budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factScenarioProject1' } as any))
      .toMatchObject({ budgetScenarioForPlan: 'planScenarioProject1', budgetScenarioForFact: 'factScenarioProject1' });
  });
});

describe('BudgetScenarioCRUD', () => {
  function mount() {
    mockState = { uxuiState: { askBeforeDeletePost: true }, [BUDGET_SCENARIO_TABLE.entity]: { entityDataFromServer: ROWS, readSuccessful: 1 } };
    const el = document.createElement('div');
    document.body.appendChild(el);
    root = createRoot(el);
    act(() => root.render(<BudgetScenarioCRUD />));
  }
  it('shows every scenario in a table with its kind', () => {
    mount();
    expect(q('budget-scenario')!.textContent).toContain('Budget scenarios');
    expect(rowIds('budget-scenario-table').sort()).toEqual(['factScenarioProject1', 'planOld', 'planScenarioProject1']);
  });
  it('a new scenario is a Plan scenario of the catalog, in a plain list (rowParentGUID empty)', () => {
    mount();
    press('budget-scenario-table-add');
    expect(mockCalls.find((c) => c[0] === 'create')![2]).toMatchObject({ rowOwnerGUID: 'budgetScenarioCatalog', rowParentGUID: 'empty', rowJSON: { scenarioKind: 'plan', isActive: true } });
  });
});

describe('the SQL part (PART 19 of start1_sql_structure.sql, PART 16 of delete_sql_structure.sql) holds what the model says', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '../../../kit8/sql/start');
  const read = (f: string) => fs.readFileSync(path.join(dir, f), 'utf8');
  const start = read('start1_sql_structure.sql'), code = read('start2_sql_code.sql'), data = read('start5_sql_upsert_all.sql'), del = read('delete_sql_structure.sql');
  // the DDL of the part (start1_sql_structure.sql) and its seed rows (start3_sql_insert_missing.sql)
  const part = start.slice(start.indexOf('-- PART 19: create_budget_scenario_table.sql')) + '\n' + read('start3_sql_insert_missing.sql').slice(read('start3_sql_insert_missing.sql').indexOf('-- PART 19: create_budget_scenario_table.sql'));
  it('the table, a plain list, the kind check, the two seeds', () => {
    expect(start).toContain('19. create_budget_scenario_table.sql');
    for (const g of ['CREATE TABLE IF NOT EXISTS public."budgetScenarioTable"', "DEFAULT 'budgetScenarioCatalog'", `CHECK ("rowParentGUID" = 'empty')`, `IN ('plan', 'fact')`]) expect(part).toContain(g);
    expect(part).toContain(`('planScenarioProject1', 'budgetScenarioCatalog', 'empty', 10, '{"title": "Plan scenario-Project #1", "scenarioKind": "plan"`);
    expect(part).toContain(`('factScenarioProject1', 'budgetScenarioCatalog', 'empty', 20, '{"title": "Fact scenario-Project #1", "scenarioKind": "fact"`);
  });
  it('the code file holds the table (no seed rows), the data file the seeds as upserts, the delete file the drop', () => {
    const codePart = code.slice(code.indexOf('-- PART 19: create_budget_scenario_table.sql'));
    expect(codePart).toContain('CREATE TABLE IF NOT EXISTS public."budgetScenarioTable"');
    expect(codePart).not.toContain("('planScenarioProject1'");
    const tail = data.slice(data.indexOf('Budget scenarios (PART 19'));
    expect(tail).toContain('INSERT INTO public."budgetScenarioTable"');
    expect(tail).toContain('DO UPDATE SET');
    expect(tail.match(/\('(plan|fact)ScenarioProject1',/g)).toHaveLength(2);
    expect(del).toContain('DROP TABLE IF EXISTS public."budgetScenarioTable" CASCADE;');
    expect(del.indexOf('budgetScenarioTable')).toBeLessThan(del.indexOf('DROP FUNCTION IF EXISTS public.kit8_touch_updated_at();'));
  });
});
