/** @jest-environment jsdom */
// The Templates tab on the task-tree structure: an example makes its tasks first (the dashboard does that, the panel only asks), a pasted table goes to the dashboard as TEXT (it makes the tasks and
// the stages), and the output examples are printed from the example's own task plan (stage headings).
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf, typeInto } from '../ui/pmUiTestKit';

const mockExport = jest.fn(async (_o: any) => undefined);
jest.mock('../../../kit8/ui/components/table/reusable/tableExportActions', () => ({ exportTableFile: (o: any) => mockExport(o) }));
jest.mock('../../../kit8/ui/components/table/reusable/tablePdf', () => ({ buildTablePdf: () => new Uint8Array() }));

import React from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import EstimationTemplatesPanel from '../../../kit8/pm/estimation/ui/EstimationTemplatesPanel';

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const props = (extra: any = {}) => ({ projectGUID: 'p1', documentGUID: 'd1', canEdit: true, gost: false, currency: 'EUR', onCreateExample: jest.fn(async () => {}), onImportTable: jest.fn(async () => 2), ...extra });
afterEach(() => { cleanupUI(); mockExport.mockClear(); });

describe('EstimationTemplatesPanel', () => {
  test('an example button asks the dashboard for that example', () => {
    const p = props();
    renderUI(<EstimationTemplatesPanel {...p} />);
    act(() => press('estimation-templates-example-quickQuote'));
    expect(p.onCreateExample).toHaveBeenCalledWith('quickQuote');
  });
  test('a pasted table is handed over as TEXT; the answer says how many positions were added, and 0 says the text holds none', async () => {
    const p = props();
    renderUI(<EstimationTemplatesPanel {...p} />);
    act(() => typeInto('estimation-templates-paste', 'section,title\nA,B\n'));
    await act(async () => { press('estimation-templates-add-lines'); });
    await flush();
    expect(p.onImportTable).toHaveBeenCalledWith('section,title\nA,B\n');
    expect(textOf('estimation-templates-message')).toBe('2 lines were added.');
    const none = props({ onImportTable: jest.fn(async () => 0) });
    cleanupUI();
    renderUI(<EstimationTemplatesPanel {...none} />);
    act(() => typeInto('estimation-templates-paste', 'nothing'));
    await act(async () => { press('estimation-templates-add-lines'); });
    await flush();
    expect(textOf('estimation-templates-message')).toMatch(/No lines were found/);
  });
  test('a failure of the import is shown, not thrown', async () => {
    const p = props({ onImportTable: jest.fn(async () => { throw new Error('permission denied'); }) });
    renderUI(<EstimationTemplatesPanel {...p} />);
    act(() => typeInto('estimation-templates-paste', 'x'));
    await act(async () => { press('estimation-templates-add-lines'); });
    await flush();
    expect(textOf('estimation-templates-message')).toBe('permission denied');
  });
  test('the example output (Excel) has the stage headings of the example, taken from its task plan', async () => {
    renderUI(<EstimationTemplatesPanel {...props()} />);
    await act(async () => { press('estimation-templates-example-xlsx'); });
    await flush();
    expect(mockExport).toHaveBeenCalledTimes(1);
    const files = unzipSync(mockExport.mock.calls[0][0].bytes);
    const sheet1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet1).toContain('Section 1. Earthworks');
    expect(sheet1).toContain('3. Section 3. Superstructure walls');
    expect(q('estimation-templates-message')).toBeTruthy();
  });
});
