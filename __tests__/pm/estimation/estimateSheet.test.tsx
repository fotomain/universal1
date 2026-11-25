/** @jest-environment jsdom */
// EstimateSheet: positions only (the hierarchy is the task tree), the norm of a position is SELECTED from the norm book.
import { act } from 'react';
import { cleanupUI, press, q, renderUI } from '../ui/pmUiTestKit';

let mockTableProps: any = null;
jest.mock('../../../kit8/ui/components/table/reusable/ReusableTable', () => ({ __esModule: true, default: (p: any) => { mockTableProps = p; return null; } }));

import React from 'react';
import EstimateSheet, { LAYOUT_COLUMNS, type EstimationLayout } from '../../../kit8/pm/estimation/ui/EstimateSheet';
import { applyNormToLine, newDocumentRow, newLineRow, type LineRow } from '../../../kit8/pm/estimation/model/estimationDocumentModel';
import { calcDocument } from '../../../kit8/pm/estimation/model/estimationCalc';

afterEach(() => { cleanupUI(); mockTableProps = null; });

const doc = newDocumentRow('p1', 'local', { title: 'Hall', currency: 'EUR' });
const pos = newLineRow('p1', doc.rowGUID, 'position', 'empty', 10, { title: '', qty: 3 });
const sheet = (over: any = {}) => {
  const lines: LineRow[] = over.lines ?? [pos];
  return <EstimateSheet projectGUID="p1" document={doc} lines={lines} calc={calcDocument(lines, doc.rowJSON)} layout={(over.layout ?? 'simple') as EstimationLayout} basis="budget" readOnly={!!over.readOnly} onChangeLines={over.onChangeLines ?? jest.fn()} onDeleteLines={jest.fn()} onSelectNorm={over.onSelectNorm} />;
};

test('the table has its own toolbar and row menu for the positions (no buttons of the sheet), and no Section column: positions only', () => {
  renderUI(sheet({ layout: 'advanced' }));
  expect(q('estimation-sheet-add-section')).toBeNull();
  expect(q('estimation-sheet-add-position')).toBeNull();
  expect(q('estimation-sheet-delete')).toBeNull();
  expect(mockTableProps).toMatchObject({ crudPanelEnabled: true, addEnabled: true, deleteEnabled: true, reorderEnabled: true, contextMenuEnabled: true });
  expect(mockTableProps.visualColumns.map((c: any) => c.key)).not.toContain('section');
  expect(LAYOUT_COLUMNS.advanced.map((c) => c.key)).not.toContain('section');
});

test('adding is off while a stage is picked; a read only sheet changes nothing', () => {
  renderUI(<EstimateSheet projectGUID="p1" document={doc} lines={[]} calc={calcDocument([], doc.rowJSON)} layout="simple" basis="budget" readOnly={false} onChangeLines={jest.fn()} onDeleteLines={jest.fn()} addBlocked />);
  expect(mockTableProps.addEnabled).toBe(false);
  cleanupUI();
  renderUI(sheet({ readOnly: true }));
  expect(mockTableProps.readOnly).toBe(true);
});

test('a row ADDED by the toolbar / row menu of the table becomes a position of the document with the task of the tree (also in the trade breakdown)', () => {
  const onChangeLines = jest.fn();
  renderUI(<EstimateSheet projectGUID="p1" document={doc} lines={[]} calc={calcDocument([], doc.rowJSON)} layout="trades" basis="budget" readOnly={false} onChangeLines={onChangeLines} onDeleteLines={jest.fn()} newLineTaskGUID="t1" />);
  // the new row of the table starts from the defaults of the sheet
  expect(mockTableProps.defaultRowJSON()).toMatchObject({ documentGUID: doc.rowGUID, lineKind: 'position', taskGUID: 't1', qty: 1 });
  act(() => { mockTableProps.onLocalRowsChange([{ rowGUID: 'new1', rowOwnerGUID: 'empty', rowParentGUID: 'empty', orderInList: 5, rowJSON: mockTableProps.defaultRowJSON() }]); });
  const next = onChangeLines.mock.calls[0][0]([]);
  expect(next).toHaveLength(1);
  expect(next[0]).toMatchObject({ rowGUID: 'new1', rowOwnerGUID: 'p1', rowJSON: { lineKind: 'position', taskGUID: 't1', documentGUID: doc.rowGUID } });
});

test('a row DELETED in the table (toolbar or row menu) leaves the document; lines of other tasks stay; an edited cell is merged', () => {
  const a = newLineRow('p1', doc.rowGUID, 'position', 'empty', 10, { title: 'A', taskGUID: 't1' });
  const b = newLineRow('p1', doc.rowGUID, 'position', 'empty', 20, { title: 'B', taskGUID: 't1' });
  const other = newLineRow('p1', doc.rowGUID, 'position', 'empty', 30, { title: 'Other', taskGUID: 't2' });
  const onChangeLines = jest.fn();
  renderUI(<EstimateSheet projectGUID="p1" document={doc} lines={[a, b]} calc={calcDocument([a, b], doc.rowJSON)} layout="simple" basis="budget" readOnly={false} onChangeLines={onChangeLines} onDeleteLines={jest.fn()} newLineTaskGUID="t1" />);
  act(() => { mockTableProps.onLocalRowsChange([{ ...a, rowJSON: { ...a.rowJSON, qty: 9 } }]); });
  const next = onChangeLines.mock.calls[0][0]([a, b, other]);
  expect(next.map((l: any) => l.rowGUID).sort()).toEqual([a.rowGUID, other.rowGUID].sort());
  expect(next.find((l: any) => l.rowGUID === a.rowGUID).rowJSON.qty).toBe(9);
});

test('the norm column of a position is a button that asks for the norm books; a typed code is plain text without the picker', () => {
  const onSelectNorm = jest.fn();
  renderUI(sheet({ onSelectNorm }));
  const col = mockTableProps.visualColumns.find((c: any) => c.key === 'normCode');
  expect(col.type).toBe('custom');
  // a HYPERLINK with the book icon (not a button), centred in the cell
  expect(col.align).toBe('center');
  const cell = col.renderCell(pos);
  expect(cell.props.title).toBe('Select norm');
  expect(cell.props.icon).toBe('menu_book');
  act(() => { cell.props.onPress(); });
  expect(onSelectNorm).toHaveBeenCalledWith(pos.rowGUID);
  const withNorm = { ...pos, rowJSON: { ...pos.rowJSON, normCode: '01-01-001' } };
  expect(col.renderCell(withNorm).props.title).toBe('01-01-001');
  cleanupUI();
  renderUI(col.renderCell(pos));
  const link = q('estimation-sheet-norm-' + pos.rowGUID)!;
  expect(link.getAttribute('role')).toBe('link');
  expect(link.textContent).toContain('Select norm');
  cleanupUI();
  renderUI(sheet());
  expect(mockTableProps.visualColumns.find((c: any) => c.key === 'normCode').type).toBe('text');
});

test('applyNormToLine writes the norm and the unit costs into a position and keeps the typed quantity and description', () => {
  const costs = { unitLabour: 5, unitMachines: 2, unitOperators: 1, unitMaterials: 7, unitOther: 0, unitEquipment: 0, missing: [] as string[] };
  const norm = { rowGUID: 'estn-1', rowJSON: { code: '01-01-001', unit: 'm3' } };
  const out = applyNormToLine(pos, norm, costs, 'Dig the trench');
  expect(out.rowJSON).toMatchObject({ title: 'Dig the trench', normCode: '01-01-001', normGUID: 'estn-1', unit: 'm3', qty: 3, unitLabour: 5, unitMachines: 2, unitOperators: 1, unitMaterials: 7 });
  expect(out.rowGUID).toBe(pos.rowGUID);
  const typed = applyNormToLine({ ...pos, rowJSON: { ...pos.rowJSON, title: 'My text' } }, norm, costs, 'Dig the trench');
  expect(typed.rowJSON.title).toBe('My text');
  const section = newLineRow('p1', doc.rowGUID, 'section', 'empty', 5, { title: 'S' });
  expect(applyNormToLine(section, norm, costs, 'x')).toBe(section);
});

test('every edited number column is wide enough to show the whole number between the − + buttons and the calculator icon', () => {
  const { ESTIMATE_NUMBER_COLUMN_MIN_WIDTH } = require('../../../kit8/pm/estimation/ui/EstimateSheet');
  for (const layout of ['simple', 'advanced', 'quote', 'trades'] as const) {
    renderUI(sheet({ layout }));
    const numbers = mockTableProps.visualColumns.filter((c: any) => c.type === 'number');
    expect(numbers.length).toBeGreaterThan(0);
    numbers.forEach((c: any) => expect(c.width).toBeGreaterThanOrEqual(ESTIMATE_NUMBER_COLUMN_MIN_WIDTH));
    cleanupUI();
  }
  expect(ESTIMATE_NUMBER_COLUMN_MIN_WIDTH).toBeGreaterThanOrEqual(200);
});
