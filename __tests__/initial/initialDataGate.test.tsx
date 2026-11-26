/** @jest-environment jsdom */
// The first run of the application: when the gate opens, what it shows, what it does at the end. The database (initial_data_status) is replaced by the hook.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf, wait } from '../pm/ui/pmUiTestKit';

const mockRouterReplace = jest.fn();
jest.doMock('expo-router', () => ({ router: { replace: (...a: any[]) => mockRouterReplace(...a) }, useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));

let mockAuthCallback: ((event: string, session: any) => void) | null = null;
let mockSession: any = null;
const mockSupabase = {
  auth: {
    getSession: async () => ({ data: { session: mockSession } }),
    onAuthStateChange: (cb: any) => { mockAuthCallback = cb; return { data: { subscription: { unsubscribe: jest.fn() } } }; },
  },
};
jest.doMock('../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: mockSupabase }) }));

let mockDecision: any = { kind: 'ready' };
const mockCheck = jest.fn();
jest.doMock('../../kit8/initial/data/code/useInitialData', () => ({
  useInitialData: () => ({ phase: 'needs', decision: mockDecision, check: mockCheck, evaluation: [], status: null, progress: null, result: null, error: null, failedGroup: null, checkedIds: [], setCheckedIds: jest.fn(), run: jest.fn() }),
}));
// the screen: its props are what the gate decides
jest.doMock('../../kit8/initial/data/code/CreateInitialProgramData', () => ({
  __esModule: true,
  default: (p: any) => {
    const R = require('react');
    const { Pressable, Text, View } = require('react-native');
    return R.createElement(View, { testID: 'screen' },
      R.createElement(Text, { testID: 'screen-flags' }, `auto=${!!p.auto} locked=${!!p.locked}`),
      R.createElement(Pressable, { testID: 'screen-finish', onPress: () => p.onFinished(true) }, R.createElement(Text, null, 'finish')),
      R.createElement(Pressable, { testID: 'screen-continue', onPress: () => p.onContinueWithout() }, R.createElement(Text, null, 'continue')));
  },
}));

const InitialDataGate = require('../../kit8/initial/data/code/InitialDataGate').default;
const flush = () => act(async () => { await wait(0); });

beforeEach(() => {
  mockRouterReplace.mockReset(); mockCheck.mockReset(); mockAuthCallback = null; mockSession = { user: { id: 'user-1' } };
  mockDecision = { kind: 'ready' };
  mockCheck.mockImplementation(async () => ({ evaluation: [], decision: mockDecision }));
});
afterEach(() => cleanupUI());

describe('InitialDataGate', () => {
  it('nobody is signed in: nothing is asked and nothing is shown (a guest is not locked)', async () => {
    mockSession = null;
    renderUI(<InitialDataGate />);
    await flush();
    expect(mockCheck).not.toHaveBeenCalled();
    expect(q('initial-data-gate')).toBeNull();
  });
  it('the data is there: one check, nothing shown', async () => {
    renderUI(<InitialDataGate />);
    await flush();
    expect(mockCheck).toHaveBeenCalledTimes(1);
    expect(q('initial-data-gate')).toBeNull();
  });
  it('NOTHING exists: the screen opens by itself in AUTO mode, locked', async () => {
    mockDecision = { kind: 'auto', groups: ['genus'] };
    renderUI(<InitialDataGate />);
    await flush();
    expect(q('initial-data-gate')).not.toBeNull();
    expect(textOf('screen-flags')).toBe('auto=true locked=true');
  });
  it('a PART is missing: the list opens (not auto), locked', async () => {
    mockDecision = { kind: 'open', groups: ['genus'] };
    renderUI(<InitialDataGate />);
    await flush();
    expect(textOf('screen-flags')).toBe('auto=false locked=true');
  });
  it('a user who may not write sees the screen (it says who can)', async () => {
    mockDecision = { kind: 'blocked', reason: 'noRight', groups: [] };
    renderUI(<InitialDataGate />);
    await flush();
    expect(q('initial-data-gate')).not.toBeNull();
  });
  it('the end of the run closes the gate and opens the home page', async () => {
    mockDecision = { kind: 'auto', groups: ['genus'] };
    renderUI(<InitialDataGate />);
    await flush();
    press('screen-finish');
    await flush();
    expect(q('initial-data-gate')).toBeNull();
    expect(mockRouterReplace).toHaveBeenCalledWith('/home');
  });
  it('"Continue without rates" closes the gate and does not navigate', async () => {
    mockDecision = { kind: 'auto', groups: ['rates'] };
    renderUI(<InitialDataGate />);
    await flush();
    press('screen-continue');
    await flush();
    expect(q('initial-data-gate')).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
  it('a check that cannot be made does NOT lock the application (SQL PART 60 not installed, no network)', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockCheck.mockImplementation(async () => null);
    renderUI(<InitialDataGate />);
    await flush();
    expect(q('initial-data-gate')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('asks once per user: a second SIGNED_IN of the same user (token refresh) does not ask again; another user does; a sign out resets', async () => {
    renderUI(<InitialDataGate />);
    await flush();
    expect(mockCheck).toHaveBeenCalledTimes(1);
    await act(async () => { mockAuthCallback!('SIGNED_IN', { user: { id: 'user-1' } }); await wait(0); });
    expect(mockCheck).toHaveBeenCalledTimes(1);
    await act(async () => { mockAuthCallback!('SIGNED_IN', { user: { id: 'user-2' } }); await wait(0); });
    expect(mockCheck).toHaveBeenCalledTimes(2);
    await act(async () => { mockAuthCallback!('SIGNED_OUT', null); mockAuthCallback!('SIGNED_IN', { user: { id: 'user-2' } }); await wait(0); });
    expect(mockCheck).toHaveBeenCalledTimes(3);
  });
});
