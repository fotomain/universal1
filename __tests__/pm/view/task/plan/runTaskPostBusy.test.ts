// runTaskPost hands the answer of the capacity check (mode + busy) to the screen; an answer from a database without the check reads as capacityModeOff / no conflict.
const mockCreate = jest.fn();
jest.mock('../../../../../kit8/pm/view/task/plan/taskLinePlanApi', () => ({ createTaskLinePlan: (j: any) => mockCreate(j) }));
jest.mock('../../../../../kit8/catalog/management/calendar/managementCalendarApi', () => ({
  fetchCalendarDays: async (_c: string, from: string, to: string) => {
    const { daysBetween } = require('../../../../../kit8/catalog/management/calendar/managementCalendarModel');
    return daysBetween(from, to).map((day: string) => ({ rowJSON: { day, isActive: ![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()) } }));
  },
}));
import { runTaskPost } from '../../../../../kit8/pm/view/task/plan/runTaskPost';
import { DISTRIBUTION } from '../../../../../kit8/catalog/distribution/distributionModel';

const distributions = Object.values(DISTRIBUTION).map((code) => ({ rowGUID: code, rowOwnerGUID: 'distributionGenericCatalog', rowParentGUID: 'g', rowJSON: {} })) as any[];
const timeLine: any = {
  rowGUID: 'l1', rowOwnerGUID: 't1', rowParentGUID: 'timeGenus', orderInList: 1,
  rowJSON: { budgetItemTaskLine: 'timeBudgetItem', distributionForBudgetTaskLine: 'uniformDistribution', qtyTaskLine: 16, sumForBudget: 160, sumForContract: 160, taskIsPosted: false, taskResourceKind: 'person', taskResourceItem: 'p-boris' },
};
const args = () => ({
  taskGUID: 't1', lines: [timeLine], distributions, calendars: [], startMs: Date.parse('2026-10-14T00:00:00Z'), finishMs: Date.parse('2026-10-16T00:00:00Z'),
});
beforeEach(() => mockCreate.mockReset());

it('capacityModeBlock: the busy conflicts come back with the mode', async () => {
  const busy = [{ resourceKind: 'person', resourceGUID: 'p-boris', resourceTitle: 'Boris M', day: '2026-10-14', capacityHours: 8, bookedHere: 8, bookedOthers: 8, overHours: 8, notFilled: false, lines: ['l1'], others: [] }];
  const { parseBusy } = require('../../../../../kit8/pm/view/task/plan/busyControl');
  mockCreate.mockResolvedValue({ lines: 0, rows: 0, mode: 'capacityModeBlock', busy: parseBusy(busy) });
  const r: any = await runTaskPost(args());
  expect(r.status).toBe('posted');
  expect(r.mode).toBe('capacityModeBlock');
  expect(r.busy).toHaveLength(1);
  expect(r.busy[0].resourceTitle).toBe('Boris M');
  expect(mockCreate.mock.calls[0][0].lines[0].lineGUID).toBe('l1');   // the plan itself is sent as before
});

it('an answer without the check (an older database): capacityModeOff and no conflict', async () => {
  mockCreate.mockResolvedValue({ lines: 1, rows: 2 });
  const r: any = await runTaskPost(args());
  expect(r).toMatchObject({ status: 'posted', lines: 1, rows: 2, mode: 'capacityModeOff', busy: [] });
});

it('the database refused (an exception): the message is returned', async () => {
  mockCreate.mockRejectedValue(new Error('task is not yours'));
  const r: any = await runTaskPost(args());
  expect(r).toEqual({ status: 'error', message: 'task is not yours' });
});
