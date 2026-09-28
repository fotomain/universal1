// Pure placement math of the progress lines (no Skia): used by the chart and unit tests.

import { PMProgressLinePosition, PM_PROGRESS_LINE_HEIGHT } from './progressLineConstants';

/** true = the line is drawn before the text (it runs through the middle, under the labels). */
export function isProgressLineUnderText(pos: PMProgressLinePosition): boolean {
  return pos === 'atTheMiddle';
}

/** Top y of a task progress line on a bar (barTop, barHeight in row coordinates). */
export function taskProgressLineY(pos: PMProgressLinePosition, barTop: number, barHeight: number, H = PM_PROGRESS_LINE_HEIGHT): number {
  if (pos === 'onBottom') return barTop + barHeight - H / 2;
  if (pos === 'atTheMiddle') return barTop + barHeight / 2 - H / 2;
  return barTop - H / 2;
}

/** Width of a task progress line: progress (0..1) of the bar width, never thinner than a dot. */
export function taskProgressLineWidth(barWidth: number, progress01: number, H = PM_PROGRESS_LINE_HEIGHT): number {
  return Math.max(H, barWidth * Math.max(0, Math.min(1, progress01)));
}

/** Project line + "Project XX%" label placement inside the time-scale header. */
export function projectProgressLineLayout(pos: PMProgressLinePosition, scaleHeight: number, H = PM_PROGRESS_LINE_HEIGHT) {
  const y = pos === 'onTop' ? 1 : pos === 'atTheMiddle' ? scaleHeight / 2 - H / 2 : scaleHeight - H - 1;
  const baseline = pos === 'onTop' ? H + 12 : pos === 'atTheMiddle' ? scaleHeight / 2 + 4 : scaleHeight - H - 5;
  return { y, H, baseline };
}
