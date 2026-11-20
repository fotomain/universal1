/** @jest-environment jsdom */
// "If the user has more than one organization, the organization input filter is used in all Monitor reports": every report dashboard carries the OrganizationFilter in its bar, and
// a scoped report shows the projects of the ACTIVE organization only (Monitor02 as the example: its lines are cut by useReportOrganizationScope).
import * as fs from 'fs';
import * as path from 'path';
import { act } from 'react';
import { cleanupUI, q, qa, renderUI } from '../../ui/pmUiTestKit';
import { RoiMoney, zeroMoney } from '../../../../kit8/pm/reports/roi/roiModel';

const mockHook: { projects: any[]; months: any[]; tasks: any[]; isLoading: boolean; error: string | null; live: boolean; changedAt: number | null; reload: jest.Mock } = {
  projects: [], months: [], tasks: [], isLoading: false, error: null, live: true, changedAt: null, reload: jest.fn(),
};
jest.mock('../../../../kit8/pm/reports/monitor02/useMonitor02Data', () => ({ useMonitor02Data: () => mockHook }));
jest.mock('../../../../kit8/pm/reports/monitor01/monitor01Api', () => ({ refreshMonitor01Now: jest.fn(async () => ({})) }));
jest.mock('../../../../kit8/pm/view/project/dashboardDeepLink', () => ({ openDashboardLink: jest.fn() }));
jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }) }));
jest.mock('../../../../kit8/ui/components/common/SelectItemFromListApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: (p: any) => R.createElement(TextInput, { testID: p.testID, value: p.value, onChangeText: p.onSelect }) };
});
// the filter of the bar: a marker (its own behaviour is tested in organizationSwitch.test.tsx)
jest.mock('../../../../kit8/catalog/organization/switch/OrganizationFilter', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ testID }: any) => R.createElement(Text, { testID }, 'organization filter') };
});
// the scope: switch it from the test
let mockScope: { projects: Set<string> | null } = { projects: null };
jest.mock('../../../../kit8/pm/reports/common/useReportOrganizationScope', () => {
  const actual = jest.requireActual('../../../../kit8/pm/reports/common/useReportOrganizationScope');
  return {
    ...actual,
    useReportOrganizationScope: () => ({
      scoped: mockScope.projects !== null,
      ready: true,
      organizationGUID: 'orgA',
      projectGUIDs: mockScope.projects,
      keep: (p: string) => !mockScope.projects || mockScope.projects.has(p),
      filter: (rows: any[], projectOf: (r: any) => string) => actual.cutToProjects(rows, projectOf, mockScope.projects),
      reload: jest.fn(),
    }),
  };
});

const Monitor02Dashboard = require('../../../../kit8/pm/reports/monitor02/Monitor02Dashboard').default;

const NONE = { includeSaleVat: false, includePurchaseVat: false };
const m = (o: Partial<RoiMoney>): RoiMoney => ({ ...zeroMoney(), ...o });
beforeEach(() => {
  mockScope = { projects: null };
  mockHook.projects = [{ projectGUID: 'p1', name: 'Alpha', tax: NONE, forTasks: false, history: false }, { projectGUID: 'p2', name: 'Beta', tax: NONE, forTasks: false, history: false }];
  mockHook.months = [
    { projectGUID: 'p1', month: '2026-09-01', money: m({ costPlanNet: 4000, revenuePlanNet: 3600 }) },
    { projectGUID: 'p2', month: '2026-09-01', money: m({ costPlanNet: 1000, revenuePlanNet: 1500 }) },
  ];
  mockHook.tasks = [];
  mockHook.changedAt = Date.now();
});
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe('Monitor02 with the Organization filter', () => {
  it('has the filter in its bar', async () => {
    renderUI(<Monitor02Dashboard />);
    await flush();
    expect(q('monitor02-organization')).not.toBeNull();
  });
  it('a user of one organization (not scoped) sees every project', async () => {
    renderUI(<Monitor02Dashboard />);
    await flush();
    expect(qa('monitor02-table-line-')).toEqual(['monitor02-table-line-p|p1', 'monitor02-table-line-p|p2']);
  });
  it('a user of two organizations sees the projects of the active one only', async () => {
    mockScope = { projects: new Set(['p2']) };
    renderUI(<Monitor02Dashboard />);
    await flush();
    expect(qa('monitor02-table-line-')).toEqual(['monitor02-table-line-p|p2']);
  });
  it('while the projects of the organization are being read nothing of the other one shows', async () => {
    mockScope = { projects: new Set() };
    renderUI(<Monitor02Dashboard />);
    await flush();
    expect(qa('monitor02-table-line-')).toEqual([]);
  });
});

describe('every report dashboard carries the Organization filter', () => {
  const reportsDir = path.join(__dirname, '../../../../kit8/pm/reports');
  const dashboards = fs
    .readdirSync(reportsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'common' && d.name !== 'roi')
    .flatMap((d) => fs.readdirSync(path.join(reportsDir, d.name)).filter((f) => /Dashboard\.tsx$/.test(f)).map((f) => path.join(reportsDir, d.name, f)));
  it('finds the five report dashboards (Monitor01, 02, 03, 07 = partner balance, 08)', () => {
    expect(dashboards.map((f) => path.basename(f)).sort()).toEqual(['Monitor01Dashboard.tsx', 'Monitor02Dashboard.tsx', 'Monitor03Dashboard.tsx', 'Monitor08Dashboard.tsx', 'PartnerBalanceDashboard.tsx']);
  });
  it.each(dashboards.map((f) => [path.basename(f), f]))('%s renders <OrganizationFilter', (_name, file) => {
    expect(fs.readFileSync(file as string, 'utf8')).toContain('<OrganizationFilter');
  });
  it.each(['Monitor01Dashboard.tsx', 'Monitor02Dashboard.tsx', 'Monitor03Dashboard.tsx', 'Monitor08Dashboard.tsx'])('%s cuts its rows with useReportOrganizationScope', (name) => {
    const file = dashboards.find((f) => f.endsWith(name)) as string;
    expect(fs.readFileSync(file, 'utf8')).toContain('useReportOrganizationScope');
  });
  it('Monitor07 reads again when the active organization changes', () => {
    const src = fs.readFileSync(dashboards.find((f) => f.endsWith('PartnerBalanceDashboard.tsx')) as string, 'utf8');
    expect(src).toContain('useActiveOrganizationGUID');
    expect(src).toMatch(/queryKey = JSON\.stringify\(\[role, query, sort, organizationGUID\]\)/);
  });
});
