/** @jest-environment jsdom */
// The screen with the REAL ReusableTable (local rows mode): the groups are rows, the check boxes are the table's own.
import { cleanupUI, q, renderUI } from '../pm/ui/pmUiTestKit';
import { evaluateStatus, gateDecision, INITIAL_GROUPS, INITIAL_TABLES, InitialDataStatus } from '../../kit8/initial/data/code/initialDataModel';
import { loadAllInitialFiles } from '../../kit8/initial/data/code/loadInitialJson';

jest.doMock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  usePathname: () => '/x',
  useGlobalSearchParams: () => ({}),
}));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: new Proxy({}, { get: () => ({ actions: { readData: (p: any) => ({ type: 'read', p }) } }) }) }));
jest.mock('../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
jest.mock('../../kit8/initial/data/code/rates/ExchangeRatesWindow', () => ({ __esModule: true, default: () => null }));

const CreateInitialProgramData = require('../../kit8/initial/data/code/CreateInitialProgramData').default;
const files = loadAllInitialFiles();
afterEach(() => cleanupUI());

it('the table shows the title of every group', () => {
  const tables: InitialDataStatus['tables'] = {};
  for (const t of INITIAL_TABLES) tables[t.table] = { rows: 0, found: [] };
  tables.managementCalendarDaysTable = { rows: 0, found: [] };
  tables.application_permission_table = { rows: 0, found: [] };
  const st: InitialDataStatus = { tables, year: 2026, signedIn: true, canWrite: true, canWriteApplication: true, isApplicationAdmin: false, bootstrap: true };
  const evaluation = evaluateStatus(st, files, false);
  const ctl = { phase: 'needs', status: st, evaluation, decision: gateDecision(evaluation, st), progress: null, result: null, error: null, failedGroup: null, checkedIds: evaluation.map((g) => g.id), setCheckedIds: jest.fn(), check: jest.fn(), run: jest.fn() };
  renderUI(<CreateInitialProgramData controller={ctl} />);
  const text = document.body.textContent || '';
  for (const g of INITIAL_GROUPS) expect(text).toContain(g.title);
  expect(q('initial-data-create')).not.toBeNull();
});

it('the Note text of a group is drawn in the error (red) color', () => {
  const tables: InitialDataStatus['tables'] = {};
  for (const t of INITIAL_TABLES) tables[t.table] = { rows: 0, found: [] };
  tables.managementCalendarDaysTable = { rows: 0, found: [] };
  tables.application_permission_table = { rows: 0, found: [] };
  const st: InitialDataStatus = { tables, year: 2026, signedIn: true, canWrite: true, canWriteApplication: true, isApplicationAdmin: false, bootstrap: true };
  const evaluation = evaluateStatus(st, files, false);
  const ctl = { phase: 'needs', status: st, evaluation, decision: gateDecision(evaluation, st), progress: null, result: null, error: null, failedGroup: null, checkedIds: [], setCheckedIds: jest.fn(), check: jest.fn(), run: jest.fn() };
  renderUI(<CreateInitialProgramData controller={ctl} />);
  const note = q('initial-data-note-rates') as HTMLElement | null;
  expect(note).not.toBeNull();
  expect(note!.textContent).toContain('No exchange rate of 31 December');
  expect(note!.getAttribute('style') || '').toMatch(/color:\s*(rgb|#)/);
});
