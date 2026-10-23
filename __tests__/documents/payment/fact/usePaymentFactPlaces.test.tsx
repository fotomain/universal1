/** @jest-environment jsdom */
// usePaymentFactPlaces - the project and task NAMES of the lines (a line has their GUIDs only): one read of project_task_table and project_table, a map line GUID → place.
import React, { act } from 'react';
import { cleanupUI, renderUI } from '../../../pm/ui/pmUiTestKit';

const calls: { table: string; ids: string[] }[] = [];
const tables: Record<string, any[]> = {
  project_task_table: [{ rowGUID: 't1', rowJSON: { taskDescription: 'Task One' } }, { rowGUID: 't2', rowJSON: { taskDescription: 'Task Two' } }],
  project_table: [{ rowGUID: 'p1', rowJSON: { name: 'Alpha' } }, { rowGUID: 'p2', rowJSON: { title: 'Beta' } }],
};
const client = { from: (table: string) => ({ select: () => ({ in: async (_col: string, ids: string[]) => { calls.push({ table, ids }); return { data: tables[table].filter((r) => ids.includes(r.rowGUID)), error: null }; } }) }) };
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: client }) }));
const { usePaymentFactPlaces } = require('../../../../kit8/documents/payment/fact/usePaymentFactPlaces');

const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
let latest: any;
afterEach(() => { cleanupUI(); calls.length = 0; });

it('names the project and the task of every line; one read of each table with the distinct GUIDs', async () => {
  const rows = [{ rowGUID: 'l1', rowProjectGUID: 'p1', rowOwnerGUID: 't1' }, { rowGUID: 'l2', rowProjectGUID: 'p2', rowOwnerGUID: 't2' }, { rowGUID: 'l3', rowProjectGUID: 'p1', rowOwnerGUID: 't1' }];
  function Probe() { latest = usePaymentFactPlaces(rows); return null; }
  renderUI(<Probe />);
  await flush();
  expect(calls.map((c) => c.table).sort()).toEqual(['project_table', 'project_task_table']);
  expect(calls.find((c) => c.table === 'project_task_table')!.ids).toEqual(['t1', 't2']);
  expect(latest.l1).toEqual({ projectGUID: 'p1', projectName: 'Alpha', taskGUID: 't1', taskName: 'Task One', taskLineGUID: null });
  expect(latest.l2).toMatchObject({ projectName: 'Beta', taskName: 'Task Two' });
  expect(latest.l3.taskName).toBe('Task One');
});

it('before the names are read (and for a task that is not readable) the names are empty; no lines = nothing is read', async () => {
  const rows = [{ rowGUID: 'l9', rowProjectGUID: 'p9', rowOwnerGUID: 't9' }];
  function Probe() { latest = usePaymentFactPlaces(rows); return null; }
  renderUI(<Probe />);
  expect(latest.l9).toMatchObject({ projectName: '', taskName: '', taskGUID: 't9' });
  await flush();
  expect(latest.l9).toMatchObject({ projectName: '', taskName: '' });
  cleanupUI();
  calls.length = 0;
  function None() { latest = usePaymentFactPlaces([]); return null; }
  renderUI(<None />);
  await flush();
  expect(calls).toEqual([]);
  expect(latest).toEqual({});
});
