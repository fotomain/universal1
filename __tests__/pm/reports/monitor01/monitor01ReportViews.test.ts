// monitor01ReportViews: the saved Views of a report - the four RPCs of kit8/sql/start PART 43 and the pure helpers (the title rules).
import {
  REPORT_VIEW_TITLE_MAX, RPC_REPORT_VIEW_DELETE, RPC_REPORT_VIEW_LIST, RPC_REPORT_VIEW_SAVE, RPC_REPORT_VIEW_SHARE, cleanReportViewTitle, deleteReportView, listReportViews, monitor01SettingsOfView, ownViewWithTitle,
  parseReportViewRow, saveReportView, shareReportView,
} from '../../../../kit8/pm/reports/monitor01/monitor01ReportViews';
import { DEFAULT_MONITOR01_SETTINGS } from '../../../../kit8/pm/reports/monitor01/monitor01Fields';

const client = (data: any, error: any = null) => ({ rpc: jest.fn(async (..._a: any[]) => ({ data, error })) });
const view = (over: Record<string, any> = {}) => ({ viewGUID: 'v1', viewTitle: 'Only hours', forOtherUsersEnabled: false, settings: { tab: 'time' }, ownerGUID: 'u1', ownerName: 'Anna K', isMine: true, updatedAt: '2026-10-29T10:00:00Z', ...over });

describe('the RPC names are the ones of the database', () => {
  it('report_view_save / _list / _share / _delete', () => {
    expect([RPC_REPORT_VIEW_SAVE, RPC_REPORT_VIEW_LIST, RPC_REPORT_VIEW_SHARE, RPC_REPORT_VIEW_DELETE]).toEqual(['report_view_save', 'report_view_list', 'report_view_share', 'report_view_delete']);
  });
});

describe('listReportViews', () => {
  it('asks for the views of the report and types the rows', async () => {
    const c = client([view(), view({ viewGUID: 'v2', viewTitle: 'Shared', isMine: false, forOtherUsersEnabled: true, ownerName: 'Boris M' })]);
    const list = await listReportViews(c, 'Monitor01');
    expect(c.rpc).toHaveBeenCalledWith('report_view_list', { p_report: 'Monitor01' });
    expect(list.map((v) => [v.viewGUID, v.viewTitle, v.isMine, v.forOtherUsersEnabled, v.ownerName])).toEqual([['v1', 'Only hours', true, false, 'Anna K'], ['v2', 'Shared', false, true, 'Boris M']]);
  });
  it('an answer that is not a list is an empty list; a row without a GUID is dropped', async () => {
    expect(await listReportViews(client(null), 'Monitor01')).toEqual([]);
    expect(await listReportViews(client({}), 'Monitor01')).toEqual([]);
    expect(await listReportViews(client([{ viewTitle: 'x' }]), 'Monitor01')).toEqual([]);
  });
  it('the error of the database is thrown, never swallowed', async () => {
    await expect(listReportViews(client(null, { message: 'report_view_list: sign in first' }), 'Monitor01')).rejects.toThrow('sign in first');
  });
});

describe('saveReportView', () => {
  it('sends the report, the trimmed title, the settings and the switch; returns the GUID', async () => {
    const c = client('guid-1');
    expect(await saveReportView(c, 'Monitor01', '  Only hours  ', DEFAULT_MONITOR01_SETTINGS, true)).toBe('guid-1');
    expect(c.rpc).toHaveBeenCalledWith('report_view_save', { p_report: 'Monitor01', p_title: 'Only hours', p_settings: DEFAULT_MONITOR01_SETTINGS, p_for_others: true });
  });
  it('an empty title is refused before the database is asked', async () => {
    const c = client('x');
    await expect(saveReportView(c, 'Monitor01', '   ', {}, false)).rejects.toThrow('ReportViewTitle is obligatory');
    expect(c.rpc).not.toHaveBeenCalled();
  });
  it('the title is cut to the longest title', async () => {
    const c = client('x');
    await saveReportView(c, 'Monitor01', 'a'.repeat(REPORT_VIEW_TITLE_MAX + 50), {}, false);
    expect(c.rpc.mock.calls[0][1].p_title).toHaveLength(REPORT_VIEW_TITLE_MAX);
  });
  it('the error of the database is thrown', async () => {
    await expect(saveReportView(client(null, { message: 'permission denied' }), 'Monitor01', 'x', {}, false)).rejects.toThrow('permission denied');
  });
});

describe('share and delete', () => {
  it('share sends the View and the switch and returns the new value', async () => {
    const c = client(true);
    expect(await shareReportView(c, 'v1', true)).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('report_view_share', { p_view: 'v1', p_enabled: true });
    await expect(shareReportView(client(null, { message: 'only the owner of a view can change it' }), 'v1', false)).rejects.toThrow('only the owner');
  });
  it('delete says whether a View was deleted', async () => {
    const c = client(true);
    expect(await deleteReportView(c, 'v1')).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith('report_view_delete', { p_view: 'v1' });
    expect(await deleteReportView(client(false), 'v1')).toBe(false);
  });
});

describe('the title helpers', () => {
  it('cleanReportViewTitle trims', () => {
    expect(cleanReportViewTitle('  x ')).toBe('x');
    expect(cleanReportViewTitle('')).toBe('');
  });
  it('ownViewWithTitle finds the OWN View with that title, without case and spaces (what Save would replace)', () => {
    const list = [parseReportViewRow(view()), parseReportViewRow(view({ viewGUID: 'v2', viewTitle: 'Shared', isMine: false }))];
    expect(ownViewWithTitle(list, ' only HOURS ')?.viewGUID).toBe('v1');
    expect(ownViewWithTitle(list, 'Shared')).toBeUndefined();       // the View of a colleague is never replaced
    expect(ownViewWithTitle(list, 'none')).toBeUndefined();
  });
  it('parseReportViewRow never throws on a damaged row', () => {
    expect(parseReportViewRow(null)).toMatchObject({ viewGUID: '', viewTitle: '', forOtherUsersEnabled: false, isMine: false });
  });
  it('monitor01SettingsOfView normalizes the settings of a View', () => {
    expect(monitor01SettingsOfView({ settings: { tab: 'time', hiddenFields: ['onHand', 'bogus'] } }).hiddenFields).toEqual(['onHand']);
    expect(monitor01SettingsOfView({ settings: null }).tab).toBe('all');
  });
});
