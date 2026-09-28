// Picks the inline editor for a tree cell (Start / Days / %) and places it over the cell.

import React from 'react';
import { PM_TREE_COL_DAYS, PM_TREE_COL_PROGRESS } from '../constants';
import { PMCellField } from '../store';
import { PMViewport } from '../useGanttViewport';
import { PMCrud } from '../usePMCrud';
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
  cols: { colStartX: number; colDaysX: number; colProgX: number; width: number };
  scrollY: PMViewport['scrollY'];
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}) {
  const common = { guid, rowIndex, scrollY, crud, colors };
  if (field === 'start') {
    // a date needs more room than the column: grow to the left over the name column
    const w = Math.max(104, cols.colDaysX - cols.colStartX - 4);
    return <EditTaskStart {...common} x={Math.max(2, cols.colDaysX - 2 - w)} width={w} />;
  }
  if (field === 'days') return <EditTaskDays {...common} x={cols.colDaysX + 2} width={PM_TREE_COL_DAYS - 4} />;
  return <EditTaskProgress {...common} x={cols.colProgX + 2} width={Math.min(PM_TREE_COL_PROGRESS, cols.width - cols.colProgX) - 4} />;
}
