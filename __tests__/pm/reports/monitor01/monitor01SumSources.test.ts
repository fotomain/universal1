// monitor01SumSources: the lists behind a number of the report. "received" = the movements of the POSTED product receipts (SQL PART 30), "Open" shows the receipt.
import { buildMonitor01Sources } from '../../../../kit8/pm/reports/monitor01/monitor01SumSources';

const client = { rpc: jest.fn(async () => ({ data: { measure: 'received', totalCount: 1, sum: 9, rows: [] }, error: null })) };
const row: any = { rowGUID: 'm1', documentGUID: 'r1', taskGUID: 't1', documentNumber: 'GRN-1', qty: 9, day: '2026-10-20' };

it('Received: one list of posted product receipts, with the Receipt column and the Document action', async () => {
  const openProductReceipt = jest.fn();
  const [src] = buildMonitor01Sources(client, 'received', { taskGUID: 't1' }, { openProductReceipt });
  expect(src).toMatchObject({ key: 'received', title: 'Posted product receipts', sign: 1, emptyText: 'No posted product receipts.', openLabel: 'Document' });
  expect(src.columns.map((c: any) => c.title)).toContain('Receipt');
  expect(src.columns.find((c: any) => c.key === 'document')!.render(row)).toBe('GRN-1');
  src.onOpen!(row);
  expect(openProductReceipt).toHaveBeenCalledWith('r1', 't1');
  await src.fetchPage(0);
  expect((client.rpc as jest.Mock).mock.calls[0][1]).toMatchObject({ p_measure: 'received' });
});

it('without a handler the Document action does nothing; the other measures keep their own lists', () => {
  const [d] = buildMonitor01Sources(client, 'received', {}, {});
  expect(d.onOpen).toBeUndefined();
  const [o] = buildMonitor01Sources(client, 'ordered', {}, { openProductReceipt: jest.fn() });
  expect(o).toMatchObject({ title: 'Posted purchase orders', openLabel: 'Document' });
  const [p] = buildMonitor01Sources(client, 'planned', {}, {});
  expect(p.openLabel).toBe('Plan');
  const onHand = buildMonitor01Sources(client, 'onHand', {}, {});
  expect(onHand.map((s: any) => [s.key, s.sign])).toEqual([['received', 1], ['used', -1]]);
});
