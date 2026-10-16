// Subprojects - the keys, the defaults and the error texts (documentation/SUBPROJECTS_BRD_TRD.html, SQL PART 29, README next to this file).
// Pure TypeScript, no React / Supabase imports: unit-testable.
//   project_table.rowJSON  (Project settings -> Subprojects):
//     subprojectsFunctionalityEnabled                         false by default - the master switch; everything below is shown / used only while it is on
//     autoChangeOriginTaskBasedOnSubprojects                  true by default - the origin task follows its subproject; the four switches below are shown / used only while it is on
//       autoChangeStartAndFinishDatesForOriginTask            true by default
//       aggregateTimeFromSubprojectToTheOriginTask            false by default
//       aggregateMaterialFromSubprojectToTheOriginTask        false by default
//       aggregateExpenceFromSubprojectToTheOriginTask         false by default
//   project_task_table.rowJSON:  taskIsSubproject (flag) + taskSubprojectGUID (the project)

export interface PMSubprojectValues {
  subprojectsFunctionalityEnabled?: boolean;
  autoChangeOriginTaskBasedOnSubprojects?: boolean;
  autoChangeStartAndFinishDatesForOriginTask?: boolean;
  aggregateTimeFromSubprojectToTheOriginTask?: boolean;
  aggregateMaterialFromSubprojectToTheOriginTask?: boolean;
  aggregateExpenceFromSubprojectToTheOriginTask?: boolean;
}

/** a missing key reads as its default (the same rule as the SQL functions subproject_enabled / subproject_setting) */
export const subprojectValuesOf = (j: PMSubprojectValues | undefined | null): Required<PMSubprojectValues> => ({
  subprojectsFunctionalityEnabled: j?.subprojectsFunctionalityEnabled === true,
  autoChangeOriginTaskBasedOnSubprojects: j?.autoChangeOriginTaskBasedOnSubprojects !== false,
  autoChangeStartAndFinishDatesForOriginTask: j?.autoChangeStartAndFinishDatesForOriginTask !== false,
  aggregateTimeFromSubprojectToTheOriginTask: j?.aggregateTimeFromSubprojectToTheOriginTask === true,
  aggregateMaterialFromSubprojectToTheOriginTask: j?.aggregateMaterialFromSubprojectToTheOriginTask === true,
  aggregateExpenceFromSubprojectToTheOriginTask: j?.aggregateExpenceFromSubprojectToTheOriginTask === true,
});

/** is the functionality in use for this project (the task editor shows the flag only then) */
export const subprojectsEnabledOf = (j: PMSubprojectValues | undefined | null): boolean => j?.subprojectsFunctionalityEnabled === true;

/** the switches that really work: a child switch counts only while the functionality AND autoChangeOriginTaskBasedOnSubprojects are on */
export function subprojectEffectiveOf(j: PMSubprojectValues | undefined | null) {
  const v = subprojectValuesOf(j);
  const on = v.subprojectsFunctionalityEnabled && v.autoChangeOriginTaskBasedOnSubprojects;
  return {
    enabled: v.subprojectsFunctionalityEnabled,
    follow: on,
    dates: on && v.autoChangeStartAndFinishDatesForOriginTask,
    time: on && v.aggregateTimeFromSubprojectToTheOriginTask,
    material: on && v.aggregateMaterialFromSubprojectToTheOriginTask,
    expense: on && v.aggregateExpenceFromSubprojectToTheOriginTask,
  };
}

/** one row of the picker (RPC subproject_candidates) */
export interface PMSubprojectCandidate {
  projectGUID: string;
  projectName: string;
  startAt: string | null;
  finishAt: string | null;
  usedByCount: number;
}

export const parseSubprojectCandidate = (r: any): PMSubprojectCandidate => ({
  projectGUID: String(r?.projectGUID ?? ''),
  projectName: String(r?.projectName ?? ''),
  startAt: r?.startAt ?? null,
  finishAt: r?.finishAt ?? null,
  usedByCount: Number(r?.usedByCount ?? 0) || 0,
});

/** the error prefixes of the database (SQL PART 29) and the texts shown to the user (pmT is applied by the caller) */
export const SUBPROJECT_ERRORS: Record<string, string> = {
  SUBPROJECT_CYCLE: 'A project cannot be a subproject of itself, directly or through other subprojects:',
  SUBPROJECT_DISABLED: 'Switch on "Subprojects" in the settings of the project first.',
  SUBPROJECT_NOT_FOUND: 'The project does not exist or you cannot see it.',
  SUBPROJECT_IN_USE: 'The project is in use as a subproject:',
  SUBPROJECT_BAD_TASK: 'Only a task (not a stage or a milestone) can stand for a subproject.',
};

/** { code, detail } when the message of the database is one of ours, else null */
export function parseSubprojectError(message: unknown): { code: string; detail: string } | null {
  const m = /(SUBPROJECT_[A-Z_]+):\s*([\s\S]*)/.exec(String((message as any)?.message ?? message ?? ''));
  if (!m || !SUBPROJECT_ERRORS[m[1]]) return null;
  return { code: m[1], detail: m[2].trim() };
}

/** the readable text of a database error; undefined when it is not a subproject error */
export function subprojectErrorText(message: unknown, t: (s: string) => string = (s) => s): string | undefined {
  const e = parseSubprojectError(message);
  if (!e) return undefined;
  const base = t(SUBPROJECT_ERRORS[e.code]);
  return e.detail && (e.code === 'SUBPROJECT_CYCLE' || e.code === 'SUBPROJECT_IN_USE') ? `${base} ${e.detail}` : base;
}

/** Monitor01 radio: which kind of projects to show */
export type Monitor01ProjectKind = 'projects' | 'subprojects' | 'all';
export const MONITOR01_PROJECT_KIND_DEFAULT: Monitor01ProjectKind = 'projects';
