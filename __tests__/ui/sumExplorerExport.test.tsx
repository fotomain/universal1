/** @jest-environment jsdom */
// SumExplorerListReusable - the ⋮ menu at the top right: Export / Share of the lists (JSON · CSV · PDF), ALL rows (pages not read yet are read first).
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from '../pm/ui/pmUiTestKit';

const mockDownloadText = jest.fn(async () => 'downloaded');
const mockDownloadBinary = jest.fn(async () => 'downloaded');
jest.mock('../../kit8/pm/crud/exchange/project/export/downloadTextFile', () => ({ downloadTextFile: (...a: any[]) => (mockDownloadText as any)(...a) }));
jest.mock('../../kit8/pm/crud/exchange/pdf/downloadBinaryFile', () => ({ downloadBinaryFile: (...a: any[]) => (mockDownloadBinary as any)(...a) }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../kit8/pm/inner/menu/PMContextMenu', () => {
  const R = require('react');
  const { Pressable, Text, View } = require('react-native');
  return { __esModule: true, default: ({ items, testID }: any) => R.createElement(View, { testID }, items.flatMap((i: any) => [i, ...(i.submenu || [])]).map((i: any) => R.createElement(Pressable, { key: i.testID, testID: i.testID, onPress: i.onPress }, R.createElement(Text, null, i.label)))) };
});
jest.mock('../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress }: any) => R.createElement(Pressable, { testID, onPress }, R.createElement(Text, null, icon)) };
});

import SumExplorerListReusable, { SumExplorerSource } from '../../kit8/ui/components/common/SumExplorerListReusable';
import { buildSumExplorerExportData, readAllRows } from '../../kit8/ui/components/common/sumExplorerExport';

interface Tx { id: string; day: string; qty: number }
const tx = (i: number, qty = 2): Tx => ({ id: `r${i}`, day: `2026-10-${10 + i}`, qty });
const source = (over: Partial<SumExplorerSource<Tx>> & { pages?: Tx[][] } = {}): SumExplorerSource<Tx> => {
  const pages = over.pages ?? [[tx(1), tx(2)], [tx(3)]];
  const total = pages.flat().length;
  return {
    key: 'planned', title: 'Plan movements', sign: 1, rowKey: (r) => r.id,
    columns: [{ key: 'day', title: 'Day', render: (r) => r.day }, { key: 'qty', title: 'Qty', align: 'right', render: (r) => String(r.qty) }],
    fetchPage: jest.fn(async (page: number) => ({ rows: pages[page] ?? [], totalCount: total, sum: pages.flat().reduce((a, r) => a + r.qty, 0) })),
    ...over,
  } as SumExplorerSource<Tx>;
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('buildSumExplorerExportData (pure)', () => {
  it('one flat table, the column "List" first, a negative list marked with −', () => {
    const planned = source({ key: 'p', title: 'Plan movements' });
    const contracted = source({ key: 'c', title: 'With a contract', sign: -1 });
    const data = buildSumExplorerExportData('rest', [planned, contracted], { p: [tx(1, 5)], c: [tx(2, 3)] });
    expect(data.headers).toEqual(['List', 'Day', 'Qty']);
    expect(data.rows).toEqual([['Plan movements', '2026-10-11', '5'], ['− With a contract', '2026-10-12', '3']]);
    expect(data.records[1]).toEqual({ List: '− With a contract', Day: '2026-10-12', Qty: '3' });
  });
  it('lists with different columns share the union of the titles; a missing cell is empty', () => {
    const a = source({ key: 'a', title: 'A' });
    const b = source({ key: 'b', title: 'B', columns: [{ key: 'qty', title: 'Qty', render: (r: Tx) => String(r.qty) }, { key: 'x', title: 'Doc', render: () => 'D1' }] });
    const data = buildSumExplorerExportData('t', [a, b], { a: [tx(1)], b: [tx(2)] });
    expect(data.headers).toEqual(['List', 'Day', 'Qty', 'Doc']);
    expect(data.rows[0]).toEqual(['A', '2026-10-11', '2', '']);
    expect(data.rows[1]).toEqual(['B', '', '2', 'D1']);
  });
});

describe('readAllRows (pure)', () => {
  it('reads the pages that are missing, until the exact count', async () => {
    const s = source();
    const all = await readAllRows(s, [tx(1), tx(2)], 3, 0);
    expect(all.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(s.fetchPage).toHaveBeenCalledTimes(1);
    expect(s.fetchPage).toHaveBeenCalledWith(1);
  });
  it('an empty page ends it (no endless loop)', async () => {
    const s = source({ pages: [[tx(1)]] });
    const all = await readAllRows(s, [], Number.POSITIVE_INFINITY, -1);
    expect(all).toHaveLength(1);
  });
});

describe('the ⋮ menu of the window', () => {
  it('is at the top right, with Export and Share of JSON · CSV · PDF', async () => {
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="Subtotal Project 1" value={6} sources={[source()]} resetKey="a" />);
    await flush();
    expect(q('sum-explorer-more')).not.toBeNull();
    expect(q('sum-explorer-more-menu')).toBeNull();
    press('sum-explorer-more');
    for (const id of ['export', 'export-json', 'export-csv', 'export-pdfVisible', 'share', 'share-json', 'share-csv', 'share-pdfVisible']) expect(q(`sum-explorer-more-${id}`)).not.toBeNull();
  });

  it('Export to CSV downloads ALL rows, also the page that "Load more" did not read', async () => {
    const s = source();
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="Subtotal Project 1" value={6} sources={[s]} resetKey="b" />);
    await flush();
    press('sum-explorer-more');
    await act(async () => { q('sum-explorer-more-export-csv')!.click(); });
    await flush();
    expect(mockDownloadText).toHaveBeenCalledTimes(1);
    const [name, text] = (mockDownloadText.mock.calls[0] as unknown) as [string, string];
    expect(name).toMatch(/^subtotal_project_1_.*\.csv$/);
    expect(text).toContain('List,Day,Qty');
    expect(text).toContain('Plan movements,2026-10-13,2');
    expect(textOf('sum-explorer-notice')).toBe(`${name} downloaded`);
    expect(q('sum-explorer-more-menu')).toBeNull();
  });

  it('Export to JSON and PDF', async () => {
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={6} sources={[source()]} resetKey="c" />);
    await flush();
    press('sum-explorer-more');
    await act(async () => { q('sum-explorer-more-export-json')!.click(); });
    await flush();
    const json = JSON.parse(((mockDownloadText.mock.calls[0] as unknown) as [string, string])[1]);
    expect(json.rowCount).toBe(3);
    expect(json.rows[0]).toMatchObject({ List: 'Plan movements', Day: '2026-10-11', Qty: '2' });
    press('sum-explorer-more');
    await act(async () => { q('sum-explorer-more-export-pdfVisible')!.click(); });
    await flush();
    expect(mockDownloadBinary).toHaveBeenCalledTimes(1);
    expect((mockDownloadBinary.mock.calls[0] as any)[0]).toMatch(/\.pdf$/);
  });

  it('a failing read of the missing pages is told, nothing is downloaded', async () => {
    const s = source();
    renderUI(<SumExplorerListReusable visible onClose={jest.fn()} title="x" value={6} sources={[s]} resetKey="d" />);
    await flush();
    (s.fetchPage as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    press('sum-explorer-more');
    await act(async () => { q('sum-explorer-more-export-csv')!.click(); });
    await flush();
    expect(mockDownloadText).not.toHaveBeenCalled();
    expect(textOf('sum-explorer-notice')).toBe('Export failed: network down');
  });
});
