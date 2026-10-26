// B1 Predecessors column (pure): the links of a task as text, and the text back to links.
//   "3, 5SS-1d, 7FS+2w, 9FF+50%"   row number (the outline number of the # column, "1.2.3"), link type (FS default), lag: d (working days, default) · w (5 days) · mo (20 days) · % of the predecessor duration (B4)
import type { PMLinkType } from '../model/types';

export interface PMPredecessorItem {
  /** the outline number of the predecessor row */
  wbs: string;
  type: PMLinkType;
  lagDays: number;
  /** lag as a percentage of the predecessor duration (B4); null = days */
  lagPercent: number | null;
}

const UNIT_DAYS: Record<string, number> = { d: 1, w: 5, mo: 20 };

/** the items of the text + the problems (a wrong token is reported, the others are kept) */
export function parsePredecessors(text: string, allowPercent = true): { items: PMPredecessorItem[]; errors: string[] } {
  const items: PMPredecessorItem[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const raw of (text || '').split(/[,;]/)) {
    const tok = raw.trim();
    if (!tok) continue;
    const m = /^(\d+(?:\.\d+)*)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*(%|mo|w|d)?)?$/i.exec(tok);
    if (!m) { errors.push(`"${tok}" is not a link: use row number, type and lag, for example 5SS-1d`); continue; }
    if (seen.has(m[1])) { errors.push(`row ${m[1]} is listed twice`); continue; }
    seen.add(m[1]);
    const sign = m[3] === '-' ? -1 : 1;
    const n = m[4] ? Number(m[4]) : 0;
    const unit = (m[5] || 'd').toLowerCase();
    if (unit === '%') {
      if (!allowPercent) { errors.push(`"${tok}": a lag in percent is switched off`); continue; }
      items.push({ wbs: m[1], type: ((m[2] || 'FS').toUpperCase() as PMLinkType), lagDays: 0, lagPercent: sign * n });
    } else {
      items.push({ wbs: m[1], type: ((m[2] || 'FS').toUpperCase() as PMLinkType), lagDays: sign * Math.round(n * UNIT_DAYS[unit]), lagPercent: null });
    }
  }
  return { items, errors };
}

/** the text of the links of a task: "3, 5SS-1d, 9FF+50%" */
export function formatPredecessors(items: PMPredecessorItem[]): string {
  return items
    .map((i) => {
      const type = i.type === 'FS' ? '' : i.type;
      let lag = '';
      if (i.lagPercent) lag = `${i.lagPercent > 0 ? '+' : '-'}${Math.abs(i.lagPercent)}%`;
      else if (i.lagDays) lag = `${i.lagDays > 0 ? '+' : '-'}${Math.abs(i.lagDays)}d`;
      return `${i.wbs}${type}${lag}`;
    })
    .join(', ');
}
