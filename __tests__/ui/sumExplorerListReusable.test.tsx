/** @jest-environment jsdom */
// SumExplorerListReusable: the window that lists the source transactions of a number - the lists, the subtotals, the check line, paging, Open.
import { act } from 'react';
import { cleanupUI, press, q, qa, renderUI, textOf } from '../pm/ui/pmUiTestKit';
import SumExplorerListReusable, { SumExplorerSource, sumExplorerCheck } from '../../kit8/ui/components/common/SumExplorerListReusable';

interface Tx { id: string; day: string; qty: number }
const rows = (...q: number[]): Tx[] => q.map((qty, i) => ({ id: `r${i}`, day: `2026-10-${14 + i}`, qty }));
const source = (over: Partial<SumExplorerSource<Tx>> & { pages?: Tx[][]; sum?: number } = {}): SumExplorerSource<Tx> => {
  const pages = over.pages ?? [rows(8, 8, 8)];
  const total = pages.flat().length;
  const sum = over.sum ?? pages.flat().reduce((a, r) => a + r.qty, 0);
  return {
    key: 'planned', title: 'Plan movements', sign: 1, rowKey: (r) => r.id,
    columns: [{ key: 'day', title: 'Day', render: (r) => r.day }, { key: 'qty', title: 'Qty', align: 'right', render: (r) => String(r.qty) }],
    fetchPage: jest.fn(async (page: number) => ({ rows: pages[page] ?? [], totalCount: total, sum })),
    ...over,
  } as SumExplorerSource<Tx>;
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('sumExplorerCheck (pure)', () => {
  it('equal within half a cent is ok', () => {
    expect(sumExplorerCheck(24, 24)).toEqual({ ok: true, difference: 0 });
    expect(sumExplorerCheck(24.001, 24)).toMatchObject({ ok: true });
  });
  it('a difference is told with its sign', () => {
    expect(sumExplorerCheck(23, 24)).toEqual({ ok: false, difference: -1 });
    expect(sumExplorerCheck(25.5, 24)).toEqual({ ok: false, difference: 1.5 });
  });
  it('no number to compare with = no check', () => {
    expect(sumExplorerCheck(24, null)).toBeNull();
    expect(sumExplorerCheck(24, undefined)).toBeNull();
    expect(sumExplorerCheck(24, NaN)).toBeNull();
  });
});

describe('the window', () => {
  it('is closed until visible', () => {
    renderUI(<SumExplorerListReusable visible={false} onClose={jest.fn()} title="x" sources={[source()]} />);
    expect(q('sum-explorer')).toBeNull();
  });

  it('lists the transactions of the number, with the subtotal and a check line "= ✓"', async () => {
    const s = source();
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="Data Analyst · Oct 2026 · task01 · planned" value={24} unit="hour" sources={[s]} resetKey="a" />);
    await flush();
    expect(textOf('sum-explorer-title')).toContain('task01');
    expect(textOf('sum-explorer-value')).toBe('24.00 hour');
    expect(qa('sum-explorer-row-')).toEqual(['sum-explorer-row-r0', 'sum-explorer-row-r1', 'sum-explorer-row-r2']);
    expect(textOf('sum-explorer-subtotal-planned')).toContain('3 · 24.00');
    expect(textOf('sum-explorer-check')).toContain('= 24.00 ✓');
  });

  it('a derived number has two lists with signs: planned − contracted = rest', async () => {
    const planned = source({ key: 'planned', title: 'Plan movements', pages: [rows(24)] });
    const contracted = source({ key: 'contracted', title: 'With a contract', sign: -1, pages: [rows(10)] });
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="rest" value={14} sources={[planned, contracted]} resetKey="b" />);
    await flush();
    expect(q('sum-explorer-source-planned')).not.toBeNull();
    expect(textOf('sum-explorer-source-contracted')).toContain('− With a contract');
    expect(textOf('sum-explorer-check')).toContain('List total 14.00 = 14.00 ✓');
  });

  it('a difference is told, not hidden', async () => {
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={30} sources={[source()]} resetKey="c" />);
    await flush();
    expect(textOf('sum-explorer-check')).toContain('differs from 30.00 by -6.00');
  });

  it('paging: "Load more" reads the next page and appends', async () => {
    const s = source({ pages: [rows(1, 1), rows(1, 1)], sum: 4 });
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={4} sources={[s]} resetKey="d" />);
    await flush();
    expect(qa('sum-explorer-row-')).toHaveLength(2);
    expect(textOf('sum-explorer-more-planned')).toContain('2 of 4');
    press('sum-explorer-more-planned');
    await flush();
    expect(qa('sum-explorer-row-')).toHaveLength(4);
    expect(q('sum-explorer-more-planned')).toBeNull();
    expect(s.fetchPage).toHaveBeenCalledTimes(2);
  });

  it('an empty list says why', async () => {
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={0} sources={[source({ pages: [[]], emptyText: 'No data yet.' })]} resetKey="e" />);
    await flush();
    expect(textOf('sum-explorer-empty-planned')).toBe('No data yet.');
    expect(textOf('sum-explorer-check')).toContain('= 0.00 ✓');
  });

  it('a failing list shows its message and no check line', async () => {
    const s = source({ fetchPage: jest.fn(async () => { throw new Error('permission denied'); }) });
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={1} sources={[s]} resetKey="f" />);
    await flush();
    expect(textOf('sum-explorer-error-planned')).toBe('permission denied');
    expect(q('sum-explorer-check')).toBeNull();
  });

  it('Open shows the transaction in its own screen; a new resetKey reads the lists again', async () => {
    const onOpen = jest.fn();
    const s = source({ onOpen, openLabel: 'Plan' });
    const { rerender } = renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={24} sources={[s]} resetKey="g1" />);
    await flush();
    press('sum-explorer-open-r1');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    rerender(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={24} sources={[s]} resetKey="g2" />);
    await flush();
    expect(s.fetchPage).toHaveBeenCalledTimes(2);
  });

  it('Close and the backdrop close it', async () => {
    const onClose = jest.fn();
    renderUI(<SumExplorerListReusable visible onClose={onClose} title="x" sources={[source()]} resetKey="h" />);
    await flush();
    press('sum-explorer-close');
    expect(onClose).toHaveBeenCalled();
  });
});
