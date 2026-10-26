// F8 Group by and F9 Highlight filter (pure): which group a row belongs to, and whether a row matches a highlight rule.
import type { PMScheduledRow, PMTaskRow } from '../model/types';
import type { PMGroupBy, PMHighlight } from './extendedOptions';
import { baselineOf } from './tracking';

const DAY = 86400000;

/** the group of a row: a short key (rows with the same key belong together) */
export function groupKeyOf(by: PMGroupBy, t: PMTaskRow, r: PMScheduledRow): string {
  const j: any = t.rowJSON ?? {};
  switch (by) {
    case 'priority': { const p = Number(j.taskPriority ?? 500); return p >= 800 ? 'priority: high' : p >= 400 ? 'priority: normal' : 'priority: low'; }
    case 'critical': return r.isCritical ? 'critical' : 'not critical';
    case 'percent': { const p = Math.round(r.progress); return p >= 100 ? '100%' : p >= 75 ? '75-99%' : p >= 50 ? '50-74%' : p >= 25 ? '25-49%' : p > 0 ? '1-24%' : '0%'; }
    case 'duration': return r.isMilestone ? 'milestone' : r.durationDays <= 1 ? '1 day' : r.durationDays <= 5 ? '2-5 days' : r.durationDays <= 20 ? '6-20 days' : 'over 20 days';
    case 'inactive': return r.isInactive || j.taskInactive === true ? 'inactive' : 'active';
    default: return '';
  }
}

/** a stable colour from the palette for a group key */
export function groupColorOf(key: string, palette: readonly string[]): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

/** the order key used to keep the rows of a group together (a sort of the siblings): smaller = first */
export function groupOrderOf(by: PMGroupBy, t: PMTaskRow, r: PMScheduledRow): number {
  const j: any = t.rowJSON ?? {};
  switch (by) {
    case 'priority': return -Number(j.taskPriority ?? 500);
    case 'critical': return r.isCritical ? 0 : 1;
    case 'percent': return Math.floor(r.progress / 25);
    case 'duration': return r.isMilestone ? 0 : r.durationDays <= 1 ? 1 : r.durationDays <= 5 ? 2 : r.durationDays <= 20 ? 3 : 4;
    case 'inactive': return r.isInactive || j.taskInactive === true ? 1 : 0;
    default: return 0;
  }
}

/** does the row match the highlight rule? (a stage never matches) */
export function highlightHit(rule: PMHighlight, t: PMTaskRow, r: PMScheduledRow, baselineNo: number, statusMs: number): boolean {
  if (rule === 'none' || r.isSummary) return false;
  const j: any = t.rowJSON ?? {};
  switch (rule) {
    case 'critical': return r.isCritical;
    case 'late': return (r.finishMs - DAY <= statusMs && r.progress < 100) || r.deadlineMissed === true;
    case 'milestones': return r.isMilestone || j.taskMarkAsMilestone === true;
    case 'inProgress': return r.progress > 0 && r.progress < 100;
    case 'behindBaseline': { const b = baselineOf(j, baselineNo); return !!b && r.finishMs > b.finishMs; }
    case 'highPriority': return Number(j.taskPriority ?? 500) > 700;
    default: return false;
  }
}
