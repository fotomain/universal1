// Progress lines (task bar lines + project line in the time scale): shared types and
// constants. No imports -> safe to use from model/types.ts / model/constants.ts.

/** Where a progress line is drawn: on the top edge, on the bottom edge, or through the middle (under the text). */
export type PMProgressLinePosition = 'onTop' | 'onBottom' | 'atTheMiddle';

export const PM_PROGRESS_LINE_POSITIONS: PMProgressLinePosition[] = ['onTop', 'atTheMiddle', 'onBottom'];

export const PM_PROGRESS_LINE_POSITION_LABEL: Record<PMProgressLinePosition, string> = {
  onTop: 'On top',
  atTheMiddle: 'Middle (under text)',
  onBottom: 'On bottom',
};

/** Default color of both progress lines (each project can override it in uxuiSettings). */
export const PM_DEFAULT_PROGRESS_LINE_COLOR = 'yellow';
/** Legacy name of the default color. */
export const progressLineColor = PM_DEFAULT_PROGRESS_LINE_COLOR;

/** Thickness (px) of every progress line. */
export const PM_PROGRESS_LINE_HEIGHT = 4;

/** Colors offered by the Gantt settings window. */
export const PM_PROGRESS_LINE_SWATCHES = ['yellow', '#f59e0b', '#f97316', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#ffffff', '#111827'];
