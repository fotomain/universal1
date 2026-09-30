// Picks the inline editor for a tree cell (Start / Days / % / custom column) and places it over
// the cell (the columns can be in any order - tree/columns). x values are CONTENT x: the parent
// translates this layer by the tree's horizontal scroll.

import React from 'react';
import { PMTreeColumnsLayout } from '../columns/treeColumns';
import { isCustomColumnKey } from '../columns/customColumns';
import { PMCellField, usePMStore } from '../../../store/store_pm';
import { PMViewport } from '../../gantt/useGanttViewport';
import { PMCrud } from '../../../crud/usePMCrud';
import EditTaskStart from './EditTaskStart';
import EditTaskDays from './EditTaskDays';
import EditTaskProgress from './EditTaskProgress';
import EditTaskCustomValue from './EditTaskCustomValue';
import EditTaskKanbanStage from './EditTaskKanbanStage';

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
  const customColumns = usePMStore((s) => s.customColumns);
  const common = { guid, rowIndex, scrollY, crud, colors };
  const col = cols.byKey[field];
  if (!col) return null; // column hidden (narrow pane)
  const contentW = Math.max(cols.width, cols.contentWidth);
  if (isCustomColumnKey(field)) {
    const def = customColumns.find((c) => c.key === field);
    if (!def || def.type === 'boolean') return null; // booleans toggle on click
    // text / dates need room: at least 120 / 104 px, growing to the right (or left at the content's right edge)
    const minW = def.type === 'text' ? 140 : def.type === 'date' ? 104 : 72;
    const w = Math.min(Math.max(minW, col.w - 4), contentW - 4);
    const x = Math.min(col.x + 2, contentW - 2 - w);
    return <EditTaskCustomValue {...common} column={def} x={Math.max(2, x)} width={w} />;
  }
  if (field === 'start') {
    // a date needs more room than the column: grow to the left (or right, at the pane's left edge)
    const w = Math.min(Math.max(104, col.w - 4), contentW - 4);
    const x = Math.min(Math.max(2, col.x + col.w - 2 - w), contentW - 2 - w);
    return <EditTaskStart {...common} x={x} width={w} />;
  }
  if (field === 'kanban') {
    const w = Math.min(Math.max(160, col.w - 4), contentW - 4);
    const x = Math.min(Math.max(2, col.x + col.w - 2 - w), contentW - 2 - w);
    return <EditTaskKanbanStage {...common} x={x} width={w} />;
  }
  if (field === 'days') return <EditTaskDays {...common} x={col.x + 2} width={col.w - 4} />;
  return <EditTaskProgress {...common} x={col.x + 2} width={Math.min(col.w, contentW - col.x) - 4} />;
}
