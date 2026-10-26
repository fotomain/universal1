// The Skia layers of the Gantt Extended functions (kit8/pm/extended), drawn inside the time-scrolled group of the chart:
//   PMGanttExtendedUnder  UNDER the bars: highlighted / grouped rows (F8 / F9), the status date and the project edge lines (E4 / C5)
//   PMGanttExtendedOver   OVER the bars: baseline + actual strips (C2 / C3), split gaps (A12), deadline markers (A5), inactive rows (A14), milestone flags (G2), rollup bars (E6),
//                         text left / right of the bars (E3), task path outlines (B7), the progress line (C7)
// Every part draws only while its function is on; with everything off both layers draw nothing. Pure drawing: the data comes from the chart.
import React from 'react';
import { Circle, Group, Path, Rect, RoundedRect, Skia, Text as SkText } from '@shopify/react-native-skia';
import type { SkFont } from '@shopify/react-native-skia';
import type { PMScheduledRow, PMTaskRow } from '../../model/types';
import type { PMPalette } from '../theme';
import type { PMExtendedOptions } from '../../extended/extendedOptions';
import { actualBarOf, baselineOf, progressLineX } from '../../extended/tracking';
import type { PMTaskPathRole } from '../../extended/taskPath';
import { highlightHit, groupKeyOf, groupColorOf } from '../../extended/rowRules';
import { formatPlanDate, PMPlanDateInputFormat } from '../../model/types';
import { ROOT_KEY, PMTreeIndex } from '../project/scheduling';

const DAY = 86400000;

export interface PMExtendedLayerProps {
  firstRow: number;
  lastRow: number;
  visibleRows: string[];
  schedule: Record<string, PMScheduledRow>;
  tasksById: Record<string, PMTaskRow>;
  tree: PMTreeIndex;
  expanded: Record<string, boolean>;
  xOf: (ms: number) => number;
  palette: PMPalette;
  fonts: { small: SkFont | null; smallBold: SkFont | null; regular: SkFont | null };
  flags: Record<string, boolean>;
  opts: PMExtendedOptions;
  statusMs: number;
  rowHeight: number;
  barVPad: number;
  /** where the visible time line ends (px), for full-width row bands */
  timelineWidth: number;
  /** y of the top / bottom of the body that is drawn */
  yTop: number;
  yBottom: number;
  pathRoles: Record<string, PMTaskPathRole>;
  dateFormat: PMPlanDateInputFormat;
  criticalOf: (guid: string) => boolean;
}

const GROUP_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

export const PMGanttExtendedUnder = React.memo(function PMGanttExtendedUnder(p: PMExtendedLayerProps) {
  const { flags, opts } = p;
  const showHighlight = flags.ganttHighlightFilterEnabled && opts.highlight !== 'none';
  const showGroup = flags.ganttGroupByEnabled && opts.groupBy !== 'none';
  const bands: React.ReactNode[] = [];
  if (showHighlight || showGroup) {
    for (let i = p.firstRow; i <= p.lastRow && i < p.visibleRows.length; i++) {
      const guid = p.visibleRows[i];
      const r = p.schedule[guid];
      const t = p.tasksById[guid];
      if (!r || !t) continue;
      const y = i * p.rowHeight;
      if (showGroup && !r.isSummary) bands.push(<Rect key={`g${guid}`} x={0} y={y} width={p.timelineWidth} height={p.rowHeight} color={groupColorOf(groupKeyOf(opts.groupBy, t, r), GROUP_COLORS)} opacity={0.1} />);
      if (showHighlight && highlightHit(opts.highlight, t, r, opts.baselineNo, p.statusMs)) bands.push(<Rect key={`h${guid}`} x={0} y={y} width={p.timelineWidth} height={p.rowHeight} color="#facc15" opacity={0.28} />);
    }
  }
  const lines: React.ReactNode[] = [];
  const h = p.yBottom - p.yTop;
  if (flags.ganttGridlinesEnabled) {
    if (opts.gridlines.projectEdges) {
      // the project start / finish lines are drawn by the chart header band; here the full-height lines
    }
  }
  if ((flags.ganttStatusDateEnabled || flags.ganttProgressLinesEnabled || flags.ganttEarnedValueEnabled) && (!flags.ganttGridlinesEnabled || opts.gridlines.status)) {
    lines.push(<Rect key="status" x={p.xOf(p.statusMs) - 1} y={p.yTop} width={2} height={h} color="#0ea5e9" opacity={0.8} />);
  }
  return (
    <Group>
      {bands}
      {lines}
    </Group>
  );
});

export const PMGanttExtendedOver = React.memo(function PMGanttExtendedOver(p: PMExtendedLayerProps) {
  const { flags, opts, rowHeight, barVPad } = p;
  const barH = rowHeight - 2 * barVPad;
  const items: React.ReactNode[] = [];
  const progressPoints: { x: number; y: number }[] = [];
  const showText = flags.ganttBarTextEnabled && (opts.barText.left !== 'none' || opts.barText.right !== 'none');
  const textOf = (field: PMExtendedOptions['barText']['left'], t: PMTaskRow, r: PMScheduledRow): string => {
    switch (field) {
      case 'start': return formatPlanDate(r.startMs, p.dateFormat);
      case 'finish': return formatPlanDate(r.finishMs > r.startMs ? r.finishMs - DAY : r.startMs, p.dateFormat);
      case 'duration': return `${r.durationDays}d`;
      case 'percent': return `${Math.round(r.progress)}%`;
      case 'priority': return String(t.rowJSON.taskPriority ?? 500);
      default: return '';
    }
  };

  for (let i = p.firstRow; i <= p.lastRow && i < p.visibleRows.length; i++) {
    const guid = p.visibleRows[i];
    const r = p.schedule[guid];
    const t = p.tasksById[guid];
    if (!r || !t) continue;
    const y = i * rowHeight + barVPad;
    const x1 = p.xOf(r.startMs);
    const x2 = r.isMilestone ? x1 : Math.max(x1 + 2, p.xOf(r.finishMs));
    const cy = i * rowHeight + rowHeight / 2;
    const json = t.rowJSON;

    // C2 / C3: the baseline and the actual strip under the plan bar (3 px each)
    if (!r.isSummary) {
      let stripY = y + barH + 1;
      if (flags.ganttTrackingBarsEnabled && flags.ganttBaselinesEnabled) {
        const b = baselineOf(json, opts.baselineNo);
        if (b) { items.push(<Rect key={`b${guid}`} x={p.xOf(b.startMs)} y={stripY} width={Math.max(2, p.xOf(b.finishMs) - p.xOf(b.startMs))} height={3} color="#94a3b8" />); stripY += 4; }
      }
      if (flags.ganttActualDatesEnabled) {
        const a = actualBarOf(json, r, r.progress, p.statusMs);
        if (a) items.push(<Rect key={`a${guid}`} x={p.xOf(a.startMs)} y={stripY} width={Math.max(2, p.xOf(a.finishMs) - p.xOf(a.startMs))} height={3} color="#0d9488" />);
      }
    }
    // A12: the gaps of a split task (the bar is drawn whole; the gap is wiped and joined by a thin line)
    if (flags.ganttSplitTasksEnabled && r.segments && r.segments.length > 1) {
      for (let k = 1; k < r.segments.length; k++) {
        const gx1 = p.xOf(r.segments[k - 1].finishMs);
        const gx2 = p.xOf(r.segments[k].startMs);
        if (gx2 > gx1) {
          items.push(<Rect key={`sp${guid}${k}`} x={gx1} y={y - 1} width={gx2 - gx1} height={barH + 2} color={p.palette.background} />);
          items.push(<Rect key={`sl${guid}${k}`} x={gx1} y={cy - 0.5} width={gx2 - gx1} height={1} color={p.palette.text} opacity={0.6} />);
        }
      }
    }
    // A5: the deadline marker (a small flag arrow at the end of the deadline day), red when missed
    if (flags.ganttDeadlineEnabled && r.deadlineMs !== undefined) {
      const dx = p.xOf(r.deadlineMs + DAY);
      const path = Skia.Path.Make();
      path.moveTo(dx - 5, i * rowHeight + 1);
      path.lineTo(dx + 5, i * rowHeight + 1);
      path.lineTo(dx, i * rowHeight + 9);
      path.close();
      items.push(<Path key={`dl${guid}`} path={path} color={r.deadlineMissed ? '#dc2626' : '#16a34a'} />);
    }
    // G2: a diamond at the finish of a task that has a duration
    if (flags.ganttMilestoneFlagEnabled && json.taskMarkAsMilestone === true && !r.isMilestone && !r.isSummary) {
      const mx = x2;
      const path = Skia.Path.Make();
      path.moveTo(mx, cy - 7);
      path.lineTo(mx + 7, cy);
      path.lineTo(mx, cy + 7);
      path.lineTo(mx - 7, cy);
      path.close();
      items.push(<Path key={`ms${guid}`} path={path} color={p.palette.milestone} />);
    }
    // A14: an inactive task is greyed and struck through
    if (flags.ganttInactiveTasksEnabled && r.isInactive) {
      items.push(<Rect key={`in${guid}`} x={x1 - 1} y={y - 1} width={Math.max(4, x2 - x1 + 2)} height={barH + 2} color={p.palette.background} opacity={0.6} />);
      items.push(<Rect key={`is${guid}`} x={x1} y={cy - 0.5} width={Math.max(4, x2 - x1)} height={1.5} color={p.palette.text} opacity={0.8} />);
    }
    // E6 / E5: the small bars of the tasks of a summary row (collapsed stage, or "summary bars show the details")
    if (flags.ganttRollupBarsEnabled && r.isSummary && (p.expanded[guid] === false || (flags.ganttLayoutOptionsEnabled && opts.layout.summaryDetails))) {
      const leaves: string[] = [];
      const visit = (g: string) => { const ks = p.tree.childrenById[g] || []; if (!ks.length) leaves.push(g); else ks.forEach(visit); };
      (p.tree.childrenById[guid] || []).forEach(visit);
      for (const l of leaves.slice(0, 80)) {
        const lr = p.schedule[l];
        if (!lr || lr.isInactive) continue;
        if (lr.isMilestone) {
          const path = Skia.Path.Make();
          const mx = p.xOf(lr.startMs);
          path.moveTo(mx, cy - 4); path.lineTo(mx + 4, cy); path.lineTo(mx, cy + 4); path.lineTo(mx - 4, cy); path.close();
          items.push(<Path key={`rm${guid}${l}`} path={path} color={p.palette.textOnBar} />);
        } else {
          items.push(<Rect key={`rb${guid}${l}`} x={p.xOf(lr.startMs)} y={cy - 2} width={Math.max(2, p.xOf(lr.finishMs) - p.xOf(lr.startMs))} height={4} color={p.palette.textOnBar} opacity={0.85} />);
        }
      }
    }
    // E3: the text left and right of the bar
    if (showText && p.fonts.small && !r.isSummary) {
      const left = textOf(opts.barText.left, t, r);
      const right = textOf(opts.barText.right, t, r);
      if (left) {
        const w = p.fonts.small.measureText(left).width;
        items.push(<SkText key={`tl${guid}`} x={x1 - w - 22} y={cy + 4} text={left} font={p.fonts.small} color={p.palette.text} />);
      }
      if (right) items.push(<SkText key={`tr${guid}`} x={x2 + 22} y={cy + 4} text={right} font={p.fonts.small} color={p.palette.text} />);
    }
    // B7: the task path - an outline of the role of the row
    const role = p.pathRoles[guid];
    if (role && !r.isSummary) {
      const color = role === 'self' ? p.palette.text : role === 'drivingPredecessor' ? '#dc2626' : role === 'predecessor' ? '#f59e0b' : role === 'drivenSuccessor' ? '#7c3aed' : '#2563eb';
      items.push(<RoundedRect key={`tp${guid}`} x={x1 - 2} y={y - 2} width={Math.max(6, x2 - x1 + 4)} height={barH + 4} r={5} style="stroke" strokeWidth={2.5} color={color} />);
    }
    // C7: a point of the progress line
    if (flags.ganttProgressLinesEnabled) {
      const px = progressLineX(r, r.progress, p.statusMs);
      if (px !== null) progressPoints.push({ x: p.xOf(px), y: cy });
    }
  }

  if (flags.ganttProgressLinesEnabled && progressPoints.length > 1) {
    const path = Skia.Path.Make();
    const sx = p.xOf(p.statusMs);
    path.moveTo(sx, progressPoints[0].y - rowHeight / 2);
    for (const pt of progressPoints) {
      path.lineTo(sx, pt.y - rowHeight / 2 + 1);
      path.lineTo(pt.x, pt.y);
      path.lineTo(sx, pt.y + rowHeight / 2 - 1);
    }
    items.push(<Path key="progressline" path={path} style="stroke" strokeWidth={1.6} color="#ea580c" />);
    for (const pt of progressPoints) items.push(<Circle key={`pp${pt.y}`} cx={pt.x} cy={pt.y} r={2.2} color="#ea580c" />);
  }
  return <Group>{items}</Group>;
});
