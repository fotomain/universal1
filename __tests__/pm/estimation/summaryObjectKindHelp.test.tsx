/** @jest-environment jsdom */
// The Summary tab: the object-kind buttons have the help for the CFO (right click / double click / double touch / long press), the fields of the row are centred vertically.
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf, wait } from '../ui/pmUiTestKit';

const mockSeg: Record<string, any> = {};
jest.mock('../../../kit8/ui/components/common/SegmentButtonsApp', () => ({
  __esModule: true,
  default: (p: any) => {
    const R = require('react'); const { Pressable, View } = require('react-native');
    mockSeg[p.testID] = p;
    return R.createElement(View, { testID: p.testID }, p.buttons.map((b: any) => R.createElement(Pressable, { key: b.value, testID: `${p.testID}-${b.value}-info`, onPress: () => p.onInfo && p.onInfo(b.value) })));
  },
}));
jest.mock('../../../kit8/pm/crud/api/apiUtils', () => ({ readAllPages: async () => [] }));

import React from 'react';
import EstimationSummaryPanel from '../../../kit8/pm/estimation/ui/EstimationSummaryPanel';
import { objectKindHelp, EXAMPLE_VAT_PCT } from '../../../kit8/pm/estimation/model/objectKindHelpModel';
import { contingencyCap, summaryEstimate } from '../../../kit8/pm/estimation/model/estimationCalc';

afterEach(() => cleanupUI());
const KINDS = ['nonProduction', 'production', 'linear', 'unique'] as const;

test('each object-kind button opens its own help; Close closes it; the selected kind does not change', async () => {
  renderUI(<EstimationSummaryPanel client={{}} projectGUID="p1" documents={[]} currency="EUR" />);
  await act(async () => { await wait(20); });
  expect(mockSeg['estimation-summary-kind'].value).toBe('nonProduction');
  act(() => press('estimation-summary-kind-unique-info'));
  expect(textOf('estimation-summary-kind-help-heading')).toBe('Unique / hazardous object');
  expect(textOf('estimation-summary-kind-help')).toContain('10 %');
  expect(mockSeg['estimation-summary-kind'].value).toBe('nonProduction');
  act(() => press('estimation-summary-kind-help-close'));
  expect(q('estimation-summary-kind-help')).toBeNull();
});

test('the row of the fields and the buttons is centred vertically (no bottom margin on the fields)', async () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../../kit8/pm/estimation/ui/EstimationSummaryPanel.tsx'), 'utf8');
  expect(src).toMatch(/row: \{[^}]*alignItems: 'center'/);
  expect((src.match(/style=\{\{ marginBottom: 0 \}\} testID/g) ?? []).length).toBe(2);
});

describe('the help texts', () => {
  const nums = (k: typeof KINDS[number]) => objectKindHelp(k).sections.flatMap((s) => s.blocks).find((b: any) => b.type === 'numbers') as any;
  test('every kind has its cap and a worked example calculated by summaryEstimate', () => {
    for (const k of KINDS) {
      const cap = contingencyCap(k);
      const s = summaryEstimate([{ chapter: 2, title: '', construction: 700000, installation: 200000, equipment: 100000, other: 0 }] as any, { contingencyPct: cap, vatPct: EXAMPLE_VAT_PCT, objectKind: k });
      const rows = nums(k).rows as [string, string][];
      expect(rows[0][1]).toBe('1,000.00');
      expect(rows[1][1]).toBe(s.contingency.total.toLocaleString('en-US', { minimumFractionDigits: 2 }));
      expect(rows[3][1]).toBe(s.grand.total.toLocaleString('en-US', { minimumFractionDigits: 2 }));
      expect(JSON.stringify(objectKindHelp(k))).toContain(`${cap} %`);
    }
  });
  test('the caps in the help are the caps of the calculation: 2 / 3 / 3 / 10 %', () => {
    expect(KINDS.map(contingencyCap)).toEqual([2, 3, 3, 10]);
    expect(nums('nonProduction').rows.map((r: any) => r[1])).toEqual(['1,000.00', '20.00', '204.00', '1,224.00']);
    expect(nums('unique').rows.map((r: any) => r[1])).toEqual(['1,000.00', '100.00', '220.00', '1,320.00']);
  });
  test('it says that the kind changes only the cap of the contingency', () => {
    for (const k of KINDS) expect(JSON.stringify(objectKindHelp(k))).toContain('does NOT change any amount');
  });
});
