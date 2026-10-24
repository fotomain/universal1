// The calls of Monitor07: the names of the functions and of their parameters (SQL PART 39), the contract '' -> 'none', an error of the database is an Error with its message.
import {
  RPC_PARTNER_BALANCE_FILTER_ITEMS, RPC_PARTNER_BALANCE_MOVEMENTS_LIST, RPC_PARTNER_BALANCE_REPORT, fetchPartnerBalanceFilterItems, fetchPartnerBalanceMovements, fetchPartnerBalanceReport,
} from '../../../../kit8/pm/reports/partner_balance/partnerBalanceApi';

const fake = (answers: Record<string, { data?: any; error?: any }>) => {
  const calls: { name: string; args: any }[] = [];
  return { calls, client: { rpc: async (name: string, args: any) => { calls.push({ name, args }); return answers[name] ?? { data: null, error: null }; } } };
};

describe('partner_balance_report', () => {
  it('sends the role, the dates, the filters, the sort and the group; an answer that is not a list is an empty list', async () => {
    const f = fake({ [RPC_PARTNER_BALANCE_REPORT]: { data: [{ partner: 'pt1' }] } });
    const rows = await fetchPartnerBalanceReport(f.client, { role: 'vendor', from: '2030-01-01', to: '2030-01-31', filters: { sumBiggerThan: 5 }, sort: { sortBy: 'partnerName', sortDir: 'asc' } });
    expect(rows).toEqual([{ partner: 'pt1' }]);
    expect(f.calls[0]).toEqual({ name: 'partner_balance_report', args: { p_role: 'vendor', p_from: '2030-01-01', p_to: '2030-01-31', p_filters: { sumBiggerThan: 5 }, p_sort: { sortBy: 'partnerName', sortDir: 'asc' }, p_group: 'contract' } });
    const g = fake({});
    expect(await fetchPartnerBalanceReport(g.client, { role: 'customer', from: null, to: null, filters: {}, sort: { sortBy: 'contractFinishDate', sortDir: 'desc' }, group: 'task' })).toEqual([]);
    expect(g.calls[0].args.p_group).toBe('task');
  });
  it('an error of the database is thrown with its message', async () => {
    const f = fake({ [RPC_PARTNER_BALANCE_REPORT]: { error: { message: 'dateFrom is after dateTo' } } });
    await expect(fetchPartnerBalanceReport(f.client, { role: 'vendor', from: null, to: null, filters: {}, sort: { sortBy: 'partnerName', sortDir: 'asc' } })).rejects.toThrow('dateFrom is after dateTo');
  });
});

describe('partner_balance_filter_items', () => {
  it('sends the role, the project and the partner (empty = null) and turns the answer into select items', async () => {
    const f = fake({ [RPC_PARTNER_BALANCE_FILTER_ITEMS]: { data: { projects: [{ id: 'p', title: 'Alpha' }], tasks: [], partners: [{ id: 'pt1', title: 'S1' }], contracts: [{ id: 'none', title: '(no contract)' }], legalEntities: [] } } });
    const items = await fetchPartnerBalanceFilterItems(f.client, 'vendor', '', null);
    expect(f.calls[0].args).toEqual({ p_role: 'vendor', p_project: null, p_partner: null });
    expect(items.projects).toEqual([{ value: 'p', label: 'Alpha' }]);
    expect(items.contracts).toEqual([{ value: 'none', label: '(no contract)' }]);
  });
});

describe('partner_balance_movements_list', () => {
  it('a contract "" (no contract) is asked as "none"; null stays null (any)', async () => {
    const f = fake({ [RPC_PARTNER_BALANCE_MOVEMENTS_LIST]: { data: [{ id: 'm1' }] } });
    await fetchPartnerBalanceMovements(f.client, { role: 'customer', partner: 'pt3', contract: '', project: null, task: null, from: null, to: '2030-01-31' });
    await fetchPartnerBalanceMovements(f.client, { role: 'customer', partner: 'pt3', contract: null, project: 'pr', task: 't', from: '2030-01-01', to: null });
    await fetchPartnerBalanceMovements(f.client, { role: 'customer', partner: 'pt3', contract: 'c4', project: null, task: null, from: null, to: null });
    expect(f.calls.map((c) => c.args.p_contract)).toEqual(['none', null, 'c4']);
    expect(f.calls[1].args).toEqual({ p_role: 'customer', p_partner: 'pt3', p_contract: null, p_project: 'pr', p_task: 't', p_from: '2030-01-01', p_to: null });
  });
  it('an error is thrown', async () => {
    const f = fake({ [RPC_PARTNER_BALANCE_MOVEMENTS_LIST]: { error: { message: 'no organization' } } });
    await expect(fetchPartnerBalanceMovements(f.client, { role: 'vendor', partner: 'p', contract: null, project: null, task: null, from: null, to: null })).rejects.toThrow('no organization');
  });
});
