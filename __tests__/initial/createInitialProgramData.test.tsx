/** @jest-environment jsdom */
// The screen Create initial data: the list with a check box near each group, Close / Create, the progress only (a new database), the messages.
import { act } from 'react';
import { cleanupUI, mustGet, press, q, renderUI, textOf } from '../pm/ui/pmUiTestKit';
import { CALENDARS_WITH_DAYS, evaluateStatus, fileKeys, gateDecision, INITIAL_GROUPS, INITIAL_TABLES, InitialDataStatus } from '../../kit8/initial/data/code/initialDataModel';
import { loadAllInitialFiles } from '../../kit8/initial/data/code/loadInitialJson';

// the table: every row a button that flips its check box (the real table has its own tests)
jest.mock('../../kit8/ui/components/table/reusable/ReusableTable', () => ({
  __esModule: true,
  default: (p: any) => {
    const R = require('react');
    const { Pressable, Text, View } = require('react-native');
    return R.createElement(View, { testID: p.testID }, p.localRows.map((r: any) => R.createElement(Pressable, {
      key: r.rowGUID, testID: `${p.testID}-row-${r.rowGUID}`,
      onPress: () => p.onLocalRowsChange(p.localRows.map((x: any) => (x.rowGUID === r.rowGUID ? { ...x, rowJSON: { ...x.rowJSON, checked: !x.rowJSON.checked } } : x))),
    }, R.createElement(Text, null, `${r.rowJSON.title}|${r.rowJSON.checked ? 'x' : '-'}|${r.rowJSON.requiredTitle}|${r.rowJSON.statusTitle}`))));
  },
}));
// the separate rates window: only whether it is open
jest.mock('../../kit8/initial/data/code/rates/ExchangeRatesWindow', () => ({
  __esModule: true,
  default: (p: any) => { const R = require('react'); const { Pressable, Text } = require('react-native'); return p.visible ? R.createElement(Pressable, { testID: p.testID, onPress: p.onClose }, R.createElement(Text, null, 'rates window')) : null; },
}));

const CreateInitialProgramData = require('../../kit8/initial/data/code/CreateInitialProgramData').default;
const { groupRows } = require('../../kit8/initial/data/code/CreateInitialProgramData');

const files = loadAllInitialFiles();
function status(kind: 'empty' | 'full', over: Partial<InitialDataStatus> = {}): InitialDataStatus {
  const tables: InitialDataStatus['tables'] = {};
  for (const t of INITIAL_TABLES) tables[t.table] = kind === 'full' ? { rows: files[t.table].rows.length, found: fileKeys(t, files[t.table]) } : { rows: 0, found: [] };
  tables.managementCalendarDaysTable = { rows: 0, found: kind === 'full' ? [...CALENDARS_WITH_DAYS] : [] };
  tables.application_permission_table = { rows: 0, found: kind === 'full' ? ['permissionApplicationAdmin'] : [] };
  return { tables, year: 2026, signedIn: true, canWrite: true, canWriteApplication: true, isApplicationAdmin: kind === 'full', bootstrap: kind === 'empty', ...over };
}
function controller(over: any = {}, st: InitialDataStatus = status('empty')) {
  const evaluation = evaluateStatus(st, files, false);
  return {
    phase: 'needs', status: st, evaluation, decision: gateDecision(evaluation, st), progress: null, result: null, error: null, failedGroup: null,
    checkedIds: evaluation.filter((g) => g.state !== 'complete').map((g) => g.id),
    setCheckedIds: jest.fn(), check: jest.fn(async () => null), run: jest.fn(async () => true), ...over,
  };
}
afterEach(() => cleanupUI());

describe('LIST mode', () => {
  it('a row per group, with its check box, the required mark and the status', () => {
    renderUI(<CreateInitialProgramData controller={controller()} />);
    for (const g of INITIAL_GROUPS) expect(q(`initial-data-table-row-${g.id}`)).not.toBeNull();
    expect(textOf('initial-data-table-row-genus')).toBe('Management genus, activity genus and budget item keys|x|Required|Missing');
    expect(textOf('initial-data-table-row-countries')).toBe('Countries|x|Optional|Missing');
  });
  it('Create writes the checked groups; the buttons are Close and Create', () => {
    const ctl = controller();
    renderUI(<CreateInitialProgramData controller={ctl} />);
    expect(textOf('initial-data-create')).toContain('Create');
    press('initial-data-create');
    expect(ctl.run).toHaveBeenCalledTimes(1);
  });
  it('EVERY row can be un-checked, a required one too; the missing required group is named', () => {
    const ctl = controller();
    renderUI(<CreateInitialProgramData controller={ctl} />);
    press('initial-data-table-row-countries');
    expect(ctl.setCheckedIds.mock.calls[0][0]).not.toContain('countries');
    expect(ctl.setCheckedIds.mock.calls[0][0]).toContain('genus');
    press('initial-data-table-row-genus');
    expect(ctl.setCheckedIds.mock.calls[1][0]).not.toContain('genus');
    expect(q('initial-data-required-left-out')).toBeNull();
  });
  it('a required group that is missing and not ticked is named under the lead', () => {
    renderUI(<CreateInitialProgramData controller={controller({ checkedIds: ['countries'] })} />);
    expect(textOf('initial-data-required-left-out')).toContain('Management genus, activity genus and budget item keys');
  });
  it('a row of a group that is complete can be ticked too', () => {
    const ctl = controller({ checkedIds: [] }, status('full'));
    renderUI(<CreateInitialProgramData controller={ctl} />);
    press('initial-data-table-row-genus');
    expect(ctl.setCheckedIds.mock.calls[0][0]).toEqual(['genus']);
  });
  it('Skip stands before Create and leaves without creating (also in the locked first run)', () => {
    const onSkip = jest.fn();
    const ctl = controller();
    renderUI(<CreateInitialProgramData controller={ctl} locked onSkip={onSkip} />);
    press('initial-data-skip');
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(ctl.run).not.toHaveBeenCalled();
  });
  it('Skip without onSkip is Close', () => {
    const onClose = jest.fn();
    renderUI(<CreateInitialProgramData controller={controller()} onClose={onClose} />);
    press('initial-data-skip');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('a complete group is shown unticked unless the user ticks it', () => {
    const st = status('full');
    st.tables.language_catalog = { rows: 0, found: [] };
    const ev = evaluateStatus(st, files, true);
    const rows = groupRows(ev, ['languages']);
    expect(rows.find((r) => r.rowGUID === 'genus')!.rowJSON.checked).toBe(false);
    expect(rows.find((r) => r.rowGUID === 'languages')!.rowJSON.checked).toBe(true);
    expect(rows.find((r) => r.rowGUID === 'genus')!.rowJSON.statusTitle).toBe('Complete');
    expect(rows.find((r) => r.rowGUID === 'languages')!.rowJSON.statusTitle).toBe('Missing');
  });
  it('first run (locked): Close is disabled while a required group is missing; in the menu it closes', () => {
    const onClose = jest.fn();
    renderUI(<CreateInitialProgramData controller={controller()} locked onClose={onClose} />);
    press('initial-data-close');
    expect(onClose).not.toHaveBeenCalled();
    renderUI(<CreateInitialProgramData controller={controller()} onClose={onClose} />);
    press('initial-data-close');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('the Exchange rates button opens the separate window', () => {
    renderUI(<CreateInitialProgramData controller={controller()} />);
    expect(q('initial-data-rates-window')).toBeNull();
    press('initial-data-rates');
    expect(q('initial-data-rates-window')).not.toBeNull();
  });
});

describe('AUTO mode (a new database, Q2): no list, no approval, only the progress', () => {
  it('runs by itself once, with the groups the decision names, and shows only the progress', () => {
    const ctl = controller();
    expect(ctl.decision.kind).toBe('auto');
    renderUI(<CreateInitialProgramData controller={ctl} auto locked />);
    expect(ctl.run).toHaveBeenCalledTimes(1);
    expect(ctl.run).toHaveBeenCalledWith(INITIAL_GROUPS.map((g) => g.id));
    expect(q('initial-data-progress')).not.toBeNull();
    expect(q('initial-data-create')).toBeNull();
    expect(q('initial-data-close')).toBeNull();
    expect(q('initial-data-table')).toBeNull();
  });
  it('does not start a second run when it is rendered again', () => {
    const ctl = controller();
    const view = renderUI(<CreateInitialProgramData controller={ctl} auto locked />);
    view.rerender(<CreateInitialProgramData controller={{ ...ctl }} auto locked />);
    expect(ctl.run).toHaveBeenCalledTimes(1);
  });
  it('shows the step and the percent while it writes', () => {
    const ctl = controller({ phase: 'running', progress: { groupId: 'genus', groupTitle: 'Management genus', groupNumber: 3, groupCount: 15, table: 'managementGenusTable', done: 4, total: 9, fraction: 0.42, text: 'x' } });
    renderUI(<CreateInitialProgramData controller={ctl} auto locked />);
    expect(textOf('initial-data-percent')).toBe('42 %');
    expect(textOf('initial-data-step')).toBe('Step 3 of 15: Management genus');
    expect((mustGet('initial-data-bar') as HTMLElement).style.width).toBe('42%');
    expect(q('initial-data-create')).toBeNull();
  });
  it('a failure shows the message and Create again (the list), and the way out when the rates failed', () => {
    const onContinueWithout = jest.fn();
    const ctl = controller({ phase: 'failed', error: 'Rates service is not reachable (offline)', failedGroup: 'rates' });
    renderUI(<CreateInitialProgramData controller={ctl} auto locked onContinueWithout={onContinueWithout} />);
    expect(textOf('initial-data-failed')).toContain('not reachable');
    expect(textOf('initial-data-create')).toContain('Create again');
    press('initial-data-continue');
    expect(onContinueWithout).toHaveBeenCalledTimes(1);
  });
  it('no way out for a failure of another group', () => {
    renderUI(<CreateInitialProgramData controller={controller({ phase: 'failed', error: 'boom', failedGroup: 'genus' })} auto locked onContinueWithout={jest.fn()} />);
    expect(q('initial-data-continue')).toBeNull();
  });
});

describe('the end of a run', () => {
  it('without the rates the caller is told at once', () => {
    const onFinished = jest.fn();
    renderUI(<CreateInitialProgramData controller={controller({ phase: 'done', result: { inserted: {}, administrator: true, calendarYears: 6, rates: null } })} onFinished={onFinished} />);
    expect(onFinished).toHaveBeenCalledWith(true);
    expect(q('initial-data-rates-window')).toBeNull();
  });
  it('with the rate of 31 December the rates window is offered first; the caller is told when it is closed', () => {
    const onFinished = jest.fn();
    renderUI(<CreateInitialProgramData controller={controller({ phase: 'done', result: { inserted: {}, administrator: true, calendarYears: 6, rates: { day: '2025-12-31', added: { USD: '2025-12-30' }, upToDate: [], unsupported: [], noRate: [] } } })} auto locked onFinished={onFinished} />);
    expect(q('initial-data-rates-window')).not.toBeNull();
    expect(onFinished).not.toHaveBeenCalled();
    press('initial-data-rates-window');
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onFinished).toHaveBeenCalledWith(true);
  });
});

describe('blocked', () => {
  it('says why, Create is disabled, Check again reads the database again', () => {
    const st = status('empty', { canWrite: false });
    const ctl = controller({ phase: 'blocked' }, st);
    renderUI(<CreateInitialProgramData controller={ctl} />);
    expect(textOf('initial-data-blocked')).toContain('Only an administrator of the organization');
    expect(mustGet('initial-data-create').getAttribute('aria-disabled')).toBe('true');
    press('initial-data-recheck');
    expect(ctl.check).toHaveBeenCalledTimes(1);
  });
  it('the read only catalogs need an application administrator', () => {
    const st = status('empty', { canWriteApplication: false, bootstrap: false });
    renderUI(<CreateInitialProgramData controller={controller({ phase: 'blocked' }, st)} />);
    expect(textOf('initial-data-blocked')).toContain('application administrator');
  });
});
