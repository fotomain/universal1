/** @jest-environment jsdom */
// useFactDocumentList / useFactProjects: the filter goes to task_fact_document_list as the RPC filter, the answer is typed, the projects come from project_table.
import React, { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanupUI, renderUI } from '../../../pm/ui/pmUiTestKit';

const fake: any = { calls: [] as any[], rpc: null as any, projects: null as any };
jest.doMock('../../../../kit8/providers/WithSupabase', () => ({ useSupabase: () => ({ supabase: fake.client }) }));
const { useFactDocumentList, useFactProjects } = require('../../../../kit8/documents/fact/input/useFactDocumentList');
import { EMPTY_FACT_LIST_FILTER } from '../../../../kit8/documents/fact/input/factInputModel';

function setup(rpc: any, projects: any = { data: [], error: null }) {
  fake.calls = [];
  fake.client = {
    rpc: jest.fn(async (name: string, args: any) => { fake.calls.push({ name, args }); return typeof rpc === 'function' ? rpc(args) : rpc; }),
    from: jest.fn((table: string) => ({ select: () => ({ order: async () => { fake.calls.push({ name: `from.${table}` }); return projects; } }) })),
  };
}
let latest: any;
let projectsSeen: any;
function Probe({ filter, limit }: { filter: any; limit?: number }) {
  latest = useFactDocumentList(filter, limit);
  projectsSeen = useFactProjects();
  return React.createElement('div', null, String(latest.answer.rows.length));
}
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); }); };
const raw = { totalCount: 5, totals: { sumForBudget: '1.5', sumForContract: '2', sumForAccounting: '3.25' }, rows: [{ documentGUID: 'd1', documentNumber: 'FI-1', documentStatus: 'posted', strongInput: true, sumForBudget: '10', lineCount: '4', authorName: 'Anna' }] };
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

// first: the projects are cached by the (shared) query client for a minute
it('the projects of the user: GUID + name (title as the fallback)', async () => {
  setup({ data: raw, error: null }, { data: [{ rowGUID: 'p1', rowJSON: { name: 'Alpha' } }, { rowGUID: 'p2', rowJSON: { title: 'Beta' } }, { rowGUID: 'p3', rowJSON: {} }], error: null });
  renderUI(<Probe filter={{ ...EMPTY_FACT_LIST_FILTER, author: 'proj' }} />);
  await flush();
  expect(projectsSeen).toEqual([{ guid: 'p1', name: 'Alpha' }, { guid: 'p2', name: 'Beta' }, { guid: 'p3', name: 'p3' }]);
});

it('an empty filter sends an empty p_filter, a page of 200 from 0; the answer is typed', async () => {
  setup({ data: raw, error: null });
  renderUI(<Probe filter={{ ...EMPTY_FACT_LIST_FILTER, author: '' }} limit={200} />);
  await flush();
  const call = fake.calls.find((c: any) => c.name === 'task_fact_document_list');
  expect(call.args).toEqual({ p_filter: {}, p_limit: 200, p_offset: 0 });
  expect(latest.answer.totalCount).toBe(5);
  expect(latest.answer.totals).toEqual({ sumForBudget: 1.5, sumForContract: 2, sumForAccounting: 3.25 });
  expect(latest.answer.rows[0]).toMatchObject({ documentGUID: 'd1', documentStatus: 'posted', strongInput: true, sumForBudget: 10, lineCount: 4, authorName: 'Anna' });
  expect(latest.error).toBeNull();
});

it('the six filters become the RPC filter (unset and unreadable ones are left out)', async () => {
  setup({ data: raw, error: null });
  renderUI(<Probe filter={{ fromDay: '2026-10-01', toDay: 'soon', projectGUID: 'p1', businessUnitGUID: 'bu1', roleGUID: 'r1', resourceGUID: 'x1', author: ' Anna ' }} limit={50} />);
  await flush();
  const call = fake.calls.find((c: any) => c.name === 'task_fact_document_list');
  expect(call.args).toEqual({ p_filter: { fromDay: '2026-10-01', projectGUID: 'p1', businessUnitGUID: 'bu1', roleGUID: 'r1', resourceGUID: 'x1', author: 'Anna' }, p_limit: 50, p_offset: 0 });
});

it('an error of the database is a message; the answer stays empty', async () => {
  setup({ data: null, error: { message: 'permission denied' } });
  renderUI(<Probe filter={{ ...EMPTY_FACT_LIST_FILTER, author: 'err' }} />);
  await flush();
  expect(latest.error).toBe('permission denied');
  expect(latest.answer.rows).toEqual([]);
});

it('refetch asks the database again', async () => {
  setup({ data: raw, error: null });
  renderUI(<Probe filter={{ ...EMPTY_FACT_LIST_FILTER, author: 'again' }} />);
  await flush();
  const before = fake.calls.filter((c: any) => c.name === 'task_fact_document_list').length;
  await act(async () => { latest.refetch(); });
  await flush();
  expect(fake.calls.filter((c: any) => c.name === 'task_fact_document_list').length).toBeGreaterThan(before);
});

