// Subprojects - what the task tree and the Gantt chart show on an ORIGIN task: the subproject icon, the subproject name and, when the dates differ, a warning.
// Pure TypeScript (unit-testable); the data comes from useProjectSubprojectMarks (the link table + the schedule of the open project).
import { DAY_MS } from '../model/constants';

/** one row of project_subproject_link of the open project, with the name of the subproject */
export interface PMSubprojectLinkInfo {
  taskGUID: string;
  subprojectGUID: string;
  subprojectName: string;
  /** start / finish of the subproject last seen by the origin task (ISO) */
  linkStartAt: string | null;
  linkFinishAt: string | null;
}

/** what a row of the tree / a bar of the Gantt chart shows */
export interface PMSubprojectMark {
  subprojectGUID: string;
  name: string;
  /** the dates of the origin task differ from the dates of its subproject (by a day or more) although they should be the same */
  conflict: boolean;
  /** the tip text: "Subproject: B" or "Subproject: B - the dates of this task differ from the subproject (2026-11-02 - 2026-11-20)" */
  tip: string;
}

const dayOf = (ms: number): number => Math.floor(ms / DAY_MS);
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/**
 * The warning: the project says the origin task follows the dates of its subproject (`followsDates`), the subproject is scheduled, and the schedule of the task
 * (the client CPM: a predecessor can push it later; a project start can clamp it) does not give the same start day or the same finish day.
 */
export function subprojectDatesConflict(sched: { startMs: number; finishMs: number } | undefined | null, link: Pick<PMSubprojectLinkInfo, 'linkStartAt' | 'linkFinishAt'>, followsDates: boolean): boolean {
  if (!followsDates || !sched || !link.linkStartAt || !link.linkFinishAt) return false;
  const ls = Date.parse(link.linkStartAt);
  const lf = Date.parse(link.linkFinishAt);
  if (!Number.isFinite(ls) || !Number.isFinite(lf)) return false;
  return dayOf(sched.startMs) !== dayOf(ls) || dayOf(sched.finishMs) !== dayOf(lf);
}

export function buildSubprojectMarks(
  links: readonly PMSubprojectLinkInfo[],
  schedule: Record<string, { startMs: number; finishMs: number } | undefined>,
  followsDates: boolean,
  t: (s: string) => string = (s) => s,
): Record<string, PMSubprojectMark> {
  const out: Record<string, PMSubprojectMark> = {};
  for (const l of links) {
    const name = l.subprojectName || l.subprojectGUID;
    const conflict = subprojectDatesConflict(schedule[l.taskGUID], l, followsDates);
    const range = l.linkStartAt && l.linkFinishAt ? ` (${iso(Date.parse(l.linkStartAt))} - ${iso(Date.parse(l.linkFinishAt) - DAY_MS)})` : '';
    out[l.taskGUID] = {
      subprojectGUID: l.subprojectGUID,
      name,
      conflict,
      tip: conflict ? `${t('Subproject')}: ${name} - ${t('the dates of this task differ from the subproject')}${range}` : `${t('Subproject')}: ${name}${range}`,
    };
  }
  return out;
}

/** the name of a row / a bar: "Task 111  [Project B]", with a "!" at the end while the dates differ */
export const subprojectLabelOf = (name: string, mark: PMSubprojectMark | undefined): string => (mark ? `${name}  [${mark.name}]${mark.conflict ? ' !' : ''}` : name);

/** colors: the same dark orange as "posted and changed" (a warning), the primary color of the palette otherwise */
export const SUBPROJECT_CONFLICT_COLOR = '#c2410c';
