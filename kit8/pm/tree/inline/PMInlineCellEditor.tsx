// Picks the inline editor for a tree cell (Start / Days / %) and places it over the cell
// (the columns can be in any order - tree/columns).

import React from 'react';
import { PMTreeColumnsLayout } from '../columns/treeColumns';
import { PMCellField } from '../../store';
import { PMViewport } from '../../useGanttViewport';
import { PMCrud } from '../../usePMCrud';
import EditTaskStart from './EditTaskStart';
import EditTaskDays from './EditTaskDays';
import EditTaskProgress from './EditTaskProgress';

export default function PMInlineCellEditor({
  field,
  guid,
  rowIndex,
  cols,
  scrollY,
  crud,
  colors,
}: {
  field: PMCellField;
  guid: string;
  rowIndex: number;
  cols: PMTreeColumnsLayout;
  scrollY: PMViewport['scrollY'];
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}) {
  const common = { guid, rowIndex, scrollY, crud, colors };
  const col = cols.byKey[field];
  if (!col) return null; // column hidden (narrow pane)
  if (field === 'start') {
    // a date needs more room than the column: grow to the left (or right, at the pane's left edge)
    const w = Math.min(Math.max(104, col.w - 4), cols.width - 4);
    const x = Math.min(Math.max(2, col.x + col.w - 2 - w), cols.width - 2 - w);
    return <EditTaskStart {...common} x={x} width={w} />;
  }
  if (field === 'days') return <EditTaskDays {...common} x={col.x + 2} width={col.w - 4} />;
  return <EditTaskProgress {...common} x={col.x + 2} width={Math.min(col.w, cols.width - col.x) - 4} />;
}
