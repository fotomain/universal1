/** @jest-environment jsdom */
// The window of the busy resources (BusyConflictsWindow): the sentence, the other bookings by project / task GUID, Share (opens the mail program - never sends) and Copy.
import React, { act } from 'react';

jest.mock('../../../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ themeColors: { primary: '#6366f1', secondary: '#64748b', onSurface: '#000', onSurfaceVariant: '#555', outline: '#ccc' }, isDark: false }),
}));
const mockCopy = jest.fn(() => Promise.resolve(true));
jest.mock('expo-clipboard', () => ({ setStringAsync: (t: string) => mockCopy(t) }));
const mockOpenURL = jest.fn((_u: string) => Promise.resolve(true));

import BusyConflictsWindow, { showBusyConflicts, useBusyConflictsStore } from '../../../../../kit8/pm/view/task/plan/BusyConflictsWindow';
import { parseBusy } from '../../../../../kit8/pm/view/task/plan/busyControl';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = async (id: string) => { await act(async () => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); }); };

const conflict = (managerEmail: string, postingManagerEmail = 'rok@acme.test') => parseBusy([{
  resourceKind: 'person', resourceGUID: 'p-boris', resourceTitle: 'Boris M', day: '2026-10-14', capacityHours: 8, bookedHere: 4, bookedOthers: 8, overHours: 4, notFilled: false,
  lines: ['l-5'], postingManagerEmail, others: [{ projectGUID: 'prj-1', taskGUID: 't-3', hours: 8, managerEmail }],
}]);

beforeEach(() => {
  jest.spyOn(require('react-native').Linking, 'openURL').mockImplementation((u: any) => mockOpenURL(u));
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<BusyConflictsWindow />));
});
afterEach(() => { jest.restoreAllMocks(); act(() => { root?.unmount(); useBusyConflictsStore.getState().hide(); }); document.body.innerHTML = ''; jest.clearAllMocks(); });

it('closed until something is shown', () => {
  expect(q('busy-conflicts')).toBeNull();
});

it('lists the sentence and the other bookings by GUID - no titles', async () => {
  await act(async () => showBusyConflicts(conflict('petra@acme.test'), 'capacityModeBlock'));
  expect(q('busy-conflicts-row-0')!.textContent).toContain('Boris M is busy on 2026-10-14: 12 h of 8 h');
  expect(q('busy-conflicts-row-0-other')!.textContent).toBe('project prj-1 · task t-3 · 8 h');
  expect(q('busy-conflicts-mode')!.textContent).toContain('were not posted');
});

it('capacityModeWarn says "posted with a warning"', async () => {
  await act(async () => showBusyConflicts(conflict('petra@acme.test'), 'capacityModeWarn'));
  expect(q('busy-conflicts-mode')!.textContent).toContain('Posted with a warning');
});

it('Share opens the mail program with To = the manager that holds the booking, Cc = the manager of the project being posted; it does not send', async () => {
  await act(async () => showBusyConflicts(conflict('petra@acme.test'), 'capacityModeBlock'));
  await press('busy-conflicts-row-0-share');
  expect(mockOpenURL).toHaveBeenCalledTimes(1);
  const url = (mockOpenURL.mock.calls[0] as unknown as [string])[0];
  expect(url.startsWith('mailto:petra@acme.test?')).toBe(true);
  expect(url).toContain('cc=rok%40acme.test');
});

it('Copy puts the text on the clipboard', async () => {
  await act(async () => showBusyConflicts(conflict('petra@acme.test'), 'capacityModeBlock'));
  await press('busy-conflicts-row-0-copy');
  expect(mockCopy).toHaveBeenCalledTimes(1);
  expect((mockCopy.mock.calls[0] as unknown as [string])[0]).toContain('project prj-1, task t-3 (8 h)');
});

it('no manager e-mail anywhere: Share is off and says what to set; Copy still works', async () => {
  await act(async () => showBusyConflicts(conflict('', ''), 'capacityModeBlock'));
  expect(q('busy-conflicts-row-0-share')!.getAttribute('aria-disabled')).toBe('true');
  expect(q('busy-conflicts-row-0-hint')!.textContent).toBe('Set the project manager in the project settings (a person with an e-mail)');
  await press('busy-conflicts-row-0-share');
  expect(mockOpenURL).not.toHaveBeenCalled();
  await press('busy-conflicts-row-0-copy');
  expect(mockCopy).toHaveBeenCalled();
});

it('Close hides it', async () => {
  await act(async () => showBusyConflicts(conflict('petra@acme.test'), 'capacityModeBlock'));
  await press('busy-conflicts-close');
  expect(q('busy-conflicts')).toBeNull();
});
