/** @jest-environment jsdom */
// FillProjectFromEstimationWindow: the question Append / Replace is ASKED (never preselected), Replace is refused while something is posted, the progress, and the question
// "Recalculate now? Yes / No" after a fill between projects with different currencies.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../../../ui/pmUiTestKit';

const mockRun = jest.fn();
const mockCancel = jest.fn();
const mockRecalc = jest.fn();
const mockAsk = jest.fn();
const mockError = jest.fn();
jest.mock('../../../../../kit8/pm/view/project/estimation/useProjectEstimation', () => ({ useFillProjectFromEstimation: () => ({ run: (...a: any[]) => mockRun(...a), cancel: () => mockCancel() }) }));
jest.mock('../../../../../kit8/catalog/organization/currencies/useOrganizationCurrencyRecalc', () => ({ useProjectCurrencyRecalc: () => (...a: any[]) => mockRecalc(...a) }));
jest.mock('../../../../../kit8/pm/inner/PMApproveYesNoCancelModalWindow', () => ({ askPMApprove: (...a: any[]) => mockAsk(...a) }));
jest.mock('../../../../../kit8/ui/components/common/ErrorModalWindow', () => ({ showErrorModal: (...a: any[]) => mockError(...a) }));
jest.mock('../../../../../kit8/redux/storeRef', () => ({ appDispatch: jest.fn() }));

import React from 'react';
import FillProjectFromEstimationWindow from '../../../../../kit8/pm/view/project/estimation/FillProjectFromEstimationWindow';
import { EstimationFillCancelledError } from '../../../../../kit8/pm/view/project/estimation/fillProjectFromEstimation';
import { parseEstimationSummary } from '../../../../../kit8/pm/view/project/estimation/estimationModel';

const P1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const P2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const side = (extra: any = {}) => ({ projectGUID: P2, name: 'Estimate', currencyForBudget: 'EUR', currencyForAccounting: 'EUR', tasks: 24, links: 31, lines: 11, linesWithoutItem: 0, linesWithoutSum: 0, items: [], ...extra });
const summary = (target: any = {}, source: any = {}) => parseEstimationSummary({
  source: side(source),
  target: side({ projectGUID: P1, name: 'Hall 12', tasks: 3, links: 0, lines: 2, postedTasks: 0, documents: 0, readonly: false, canCreate: true, roots: [{ rowGUID: 'r1', orderInList: 1 }, { rowGUID: 'r2', orderInList: 2 }], ...target }),
});
const rowOf = (guid: string, name: string, json: any = {}): any => ({ rowGUID: guid, treePath: guid, rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name, currencyForBudget: 'EUR', currencyForAccounting: 'EUR', currencyForContract: 'EUR', ...json } });
const render = (s = summary(), targetJSON: any = {}, onClose = jest.fn()) => renderUI(<FillProjectFromEstimationWindow visible onClose={onClose} source={rowOf(P2, 'Estimate')} target={rowOf(P1, 'Hall 12', targetJSON)} summary={s} ownerGUID="u" />);
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockRun.mockImplementation(async (args: any) => { args.onStep?.('Writing {{n}} tasks', 0.5, { n: 24 }); return { mode: args.mode ?? 'empty', tasks: 24, links: 31, lines: 11, removedRoots: 0 }; });
  mockAsk.mockResolvedValue('yes');
  mockRecalc.mockResolvedValue({ projectGUID: P1, name: 'Hall 12', status: 'done', linesChanged: 11, tasksPosted: 0, tasksNeedPost: 0, linesWithoutRate: 0, postProblems: [] });
});
afterEach(() => cleanupUI());

describe('FillProjectFromEstimationWindow', () => {
  it('says what is copied; a project with rows of its own is ASKED Append or Replace - nothing is preselected and Fill waits', () => {
    render();
    expect(textOf('pm-estimation-fill-what')).toContain('24 tasks and stages, 31 links and 11 task lines');
    expect(textOf('pm-estimation-fill-what')).toContain('"Hall 12"');
    expect(q('pm-estimation-fill-mode')).not.toBeNull();
    expect(q('pm-estimation-fill-mode-ask')).not.toBeNull();
    expect(q('pm-estimation-fill-mode-append')!.getAttribute('aria-selected') ?? q('pm-estimation-fill-mode-append')!.getAttribute('aria-checked')).not.toBe('true');
    expect((q('pm-estimation-fill-fill') as any).disabled === true || q('pm-estimation-fill-fill')!.getAttribute('aria-disabled') === 'true').toBe(true);
    press('pm-estimation-fill-fill');
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('Append: chosen -> Fill runs with the mode, the old top-level rows and no currency clean-up', async () => {
    render();
    press('pm-estimation-fill-mode-append');
    expect(q('pm-estimation-fill-mode-ask')).toBeNull();
    press('pm-estimation-fill-fill');
    await flush();
    expect(mockRun).toHaveBeenCalledTimes(1);
    const args = mockRun.mock.calls[0][0];
    expect(args).toMatchObject({ mode: 'append', ownerGUID: 'u', dropCurrencySums: false, existingRoots: [{ rowGUID: 'r1', orderInList: 1 }, { rowGUID: 'r2', orderInList: 2 }] });
    expect(textOf('pm-estimation-fill-done')).toContain('24 tasks, 31 links and 11 task lines copied');
    expect(mockAsk).not.toHaveBeenCalled(); // same currencies: nothing to recalculate
    expect(q('pm-estimation-fill-done-button')).not.toBeNull();
  });

  it('Replace is refused while tasks of the project are posted (with the reason), and while documents exist', () => {
    render(summary({ postedTasks: 2 }));
    expect(textOf('pm-estimation-fill-mode-replace')).toContain('2 tasks of the project are posted');
    press('pm-estimation-fill-mode-replace');
    expect(q('pm-estimation-fill-mode-ask')).not.toBeNull(); // still nothing chosen
    cleanupUI();
    render(summary({ documents: 3 }));
    expect(textOf('pm-estimation-fill-mode-replace')).toContain('has documents');
  });

  it('Replace (allowed): runs with mode replace', async () => {
    render();
    press('pm-estimation-fill-mode-replace');
    press('pm-estimation-fill-fill');
    await flush();
    expect(mockRun.mock.calls[0][0].mode).toBe('replace');
  });

  it('an empty project has NO question: Fill is enabled at once and runs with no mode', async () => {
    render(summary({ tasks: 0, roots: [] }));
    expect(q('pm-estimation-fill-mode')).toBeNull();
    press('pm-estimation-fill-fill');
    await flush();
    expect(mockRun.mock.calls[0][0]).toMatchObject({ mode: null, existingRoots: [] });
  });

  it('other currencies: the lines come without the sums, and afterwards the user is asked "Recalculate now?" - Yes recalculates', async () => {
    render(summary({ currencyForBudget: 'USD', currencyForAccounting: 'USD' }), { currencyForBudget: 'USD', currencyForAccounting: 'USD', currencyForContract: 'EUR' });
    expect(textOf('pm-estimation-fill-currency')).toContain('EUR -> USD');
    press('pm-estimation-fill-mode-append');
    press('pm-estimation-fill-fill');
    await flush();
    expect(mockRun.mock.calls[0][0].dropCurrencySums).toBe(true);
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockAsk.mock.calls[0][0]).toMatchObject({ title: 'Recalculate the task lines now?', yesLabel: 'Yes', noLabel: 'No' });
    expect(mockAsk.mock.calls[0][0].hideNo).toBeFalsy();
    expect(mockRecalc).toHaveBeenCalledTimes(1);
    expect(mockRecalc.mock.calls[0][0]).toBe(P1);
    expect(mockRecalc.mock.calls[0][1]).toEqual({ currencyForBudget: 'USD', currencyForAccounting: 'USD', currencyForContract: 'EUR' });
  });

  it('"No" to the recalculation: nothing is recalculated', async () => {
    mockAsk.mockResolvedValue('no');
    render(summary({ currencyForBudget: 'USD' }), { currencyForBudget: 'USD' });
    press('pm-estimation-fill-mode-append');
    press('pm-estimation-fill-fill');
    await flush();
    expect(mockAsk).toHaveBeenCalledTimes(1);
    expect(mockRecalc).not.toHaveBeenCalled();
  });

  it('a failure shows the message and Try again; a cancel says nothing was changed', async () => {
    mockRun.mockRejectedValueOnce(new Error('links refused'));
    render(summary({ tasks: 0, roots: [] }));
    press('pm-estimation-fill-fill');
    await flush();
    expect(textOf('pm-estimation-fill-message')).toBe('links refused');
    expect(textOf('pm-estimation-fill-fill')).toContain('Try again');
    mockRun.mockRejectedValueOnce(new EstimationFillCancelledError());
    press('pm-estimation-fill-fill');
    await flush();
    expect(textOf('pm-estimation-fill-message')).toContain('Nothing was changed');
  });

  it('shows the note of the last fill', () => {
    render(summary(), { projectEstimationLastFill: { at: '2026-12-02T10:14:00.000Z', sourceGUID: P2, mode: 'append', tasks: 24, lines: 11 } });
    expect(textOf('pm-estimation-fill-last')).toContain('Already filled on 2026-12-02 10:14');
  });

  it('while it runs: progress, Close is locked, the left button cancels the fill', async () => {
    let finish: (v: any) => void = () => {};
    mockRun.mockImplementationOnce((args: any) => new Promise((resolve) => { args.onStep?.('Writing {{n}} tasks', 0.4, { n: 24 }); finish = resolve; }));
    const onClose = jest.fn();
    render(summary({ tasks: 0, roots: [] }), {}, onClose);
    press('pm-estimation-fill-fill');
    await flush();
    expect(textOf('pm-estimation-fill-percent')).toBe('40 %');
    expect(textOf('pm-estimation-fill-step-0')).toContain('Writing 24 tasks');
    press('pm-estimation-fill-close');
    expect(onClose).not.toHaveBeenCalled();
    expect(textOf('pm-estimation-fill-cancel')).toContain('Cancel fill');
    press('pm-estimation-fill-cancel');
    expect(mockCancel).toHaveBeenCalledTimes(1);
    finish({ mode: 'empty', tasks: 24, links: 31, lines: 11, removedRoots: 0 });
    await flush();
    expect(q('pm-estimation-fill-done')).not.toBeNull();
  });
});
