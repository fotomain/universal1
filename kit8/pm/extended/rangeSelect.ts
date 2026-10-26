// F3 Range selection (pure): the rows between the first and the last checked row (in the order the user sees them).

/** the rows of `visible` from the first to the last checked row; [] when fewer than 2 are checked */
export function rangeBetweenChecked(visible: string[], checked: Record<string, true>): string[] {
  const idx = visible.map((g, i) => (checked[g] ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2) return [];
  return visible.slice(idx[0], idx[idx.length - 1] + 1);
}

/** the rows from the row `anchor` to the row `to` (both included); [] when one of them is not visible */
export function rangeBetween(visible: string[], anchor: string, to: string): string[] {
  const a = visible.indexOf(anchor);
  const b = visible.indexOf(to);
  if (a < 0 || b < 0) return [];
  return visible.slice(Math.min(a, b), Math.max(a, b) + 1);
}
