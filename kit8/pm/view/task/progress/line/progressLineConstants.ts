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

/**
 * The ONLY colors a progress line may have (Gantt settings window swatches): 9 colors + white + black.
 * Saved values outside this set (e.g. the old 'yellow') are read as the default - progressLineColorOf().
 */
export const PM_PROGRESS_LINE_SWATCHES = ['#FCFF00', '#FFAA00', '#FF5500', '#00FF66', '#00F0FF', '#4455FF', '#9D00FF', '#FF007F', '#FF0033', '#FFFFFF', '#000000'];

/** Default color of both progress lines (the first color of the set; each user can override it per project). */
export const PM_DEFAULT_PROGRESS_LINE_COLOR = PM_PROGRESS_LINE_SWATCHES[0];

/** A saved color -> the matching color of the set (case-insensitive), anything else -> the default. */
export function progressLineColorOf(value: unknown): string {
  if (typeof value !== 'string') return PM_DEFAULT_PROGRESS_LINE_COLOR;
  const v = value.trim().toUpperCase();
  return PM_PROGRESS_LINE_SWATCHES.find((c) => c === v) ?? PM_DEFAULT_PROGRESS_LINE_COLOR;
}
/** Legacy name of the default color. */
export const progressLineColor = PM_DEFAULT_PROGRESS_LINE_COLOR;

/** Thickness (px) of every progress line. */
export const PM_PROGRESS_LINE_HEIGHT = 4;

