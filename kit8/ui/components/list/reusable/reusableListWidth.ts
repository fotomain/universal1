/** the widest the list gets when `reusableListWidth` is not set (px) */
export const REUSABLE_LIST_DEFAULT_MAX_WIDTH = 960;

/** width rule of the list: `reusableListWidth` px when set, else the width of the parent up to 960 px; never wider than the parent, centred when narrower */
export function reusableListWidthStyle(reusableListWidth?: number) {
  const fixed = typeof reusableListWidth === 'number' && Number.isFinite(reusableListWidth) && reusableListWidth > 0;
  return fixed
    ? ({ width: reusableListWidth, maxWidth: '100%', alignSelf: 'center' } as const)
    : ({ width: '100%', maxWidth: REUSABLE_LIST_DEFAULT_MAX_WIDTH, alignSelf: 'center' } as const);
}
