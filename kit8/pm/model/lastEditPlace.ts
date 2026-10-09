// project_task_table.rowJSON.lastEditPlace - where in a task the user edited last (pure).
//   { v: 1, surface, section, genus?, lineGUID?, at, by? }
// The task remembers it, and the place is activated when the task is opened again:
//   surface 'editModal'     the task window (PMTaskEditModal): section = 'TabMain' | 'TabUXUI' -> the window opens on that tab
//   surface 'taskPage'      the task page (PMProjectTaskInfo): section = a page section -> the page scrolls to it
//   surface 'financesView'  the Finances view of the dashboard (tree + the lines of the selected task)
// Finances (taskPage and financesView): section 'finances', genus = the management genus tab, lineGUID = the line -> the tab opens and
// the line is marked.
// It is written only when the PLACE changes (not on every keystroke), by the RPC pm_set_task_last_edit_place, so it never overwrites the
// rest of rowJSON. It is metadata: not an undo step, not a schedule input.

export type PMEditSurface = 'editModal' | 'taskPage' | 'financesView';
export const PM_EDIT_SURFACES: PMEditSurface[] = ['editModal', 'taskPage', 'financesView'];

/** the sections of the task page that can be a place (anything else is ignored: an older / newer client wrote it) */
export type PMTaskPageSection = 'progress' | 'kanbanProgress' | 'dependencies' | 'finances';
export const PM_TASK_PAGE_SECTIONS: PMTaskPageSection[] = ['progress', 'kanbanProgress', 'dependencies', 'finances'];
export const PM_TASK_MODAL_SECTIONS = ['TabMain', 'TabUXUI'] as const;
export const PM_FINANCES_SECTION: PMTaskPageSection = 'finances';

export interface PMLastEditPlace {
  v: 1;
  surface: PMEditSurface;
  section: string;
  /** Finances: managementGenus.rowGUID of the tab */
  genus?: string;
  /** Finances: task_line_table.rowGUID */
  lineGUID?: string;
  /** ISO time of the edit */
  at: string;
  /** who edited (the rows of a task are shared: the last editor wins) */
  by?: string;
}

/** what a caller says; the rest (v, at, by) is added by makeLastEditPlace */
export type PMLastEditPlaceInput = Pick<PMLastEditPlace, 'surface' | 'section'> & Partial<Pick<PMLastEditPlace, 'genus' | 'lineGUID'>>;

const text = (v: unknown, max = 80): string | undefined => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined);

const sectionAllowed = (surface: PMEditSurface, section: string) =>
  surface === 'editModal' ? (PM_TASK_MODAL_SECTIONS as readonly string[]).includes(section) : (PM_TASK_PAGE_SECTIONS as string[]).includes(section);

/** the place stored in a task's rowJSON, or null when there is none / it is not one this client understands */
export function lastEditPlaceOf(rowJSON: { lastEditPlace?: unknown } | null | undefined): PMLastEditPlace | null {
  const p = rowJSON?.lastEditPlace as Partial<PMLastEditPlace> | null | undefined;
  if (!p || typeof p !== 'object') return null;
  if (p.v !== 1 || !PM_EDIT_SURFACES.includes(p.surface as PMEditSurface)) return null;
  const section = text(p.section);
  if (!section || !sectionAllowed(p.surface as PMEditSurface, section)) return null;
  return {
    v: 1,
    surface: p.surface as PMEditSurface,
    section,
    ...(text(p.genus) ? { genus: p.genus } : {}),
    ...(text(p.lineGUID, 64) ? { lineGUID: p.lineGUID } : {}),
    at: text(p.at, 40) ?? '',
    ...(text(p.by, 64) ? { by: p.by } : {}),
  };
}

export function makeLastEditPlace(input: PMLastEditPlaceInput, by?: string | null, now: Date = new Date()): PMLastEditPlace | null {
  if (!PM_EDIT_SURFACES.includes(input.surface) || !text(input.section) || !sectionAllowed(input.surface, input.section)) return null;
  return {
    v: 1,
    surface: input.surface,
    section: input.section,
    ...(text(input.genus) ? { genus: input.genus } : {}),
    ...(text(input.lineGUID, 64) ? { lineGUID: input.lineGUID } : {}),
    at: now.toISOString(),
    ...(by ? { by } : {}),
  };
}

/** the same place (time and editor do not count): nothing needs to be written */
export function sameLastEditPlace(a: PMLastEditPlace | null | undefined, b: PMLastEditPlace | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.surface === b.surface && a.section === b.section && (a.genus ?? '') === (b.genus ?? '') && (a.lineGUID ?? '') === (b.lineGUID ?? '');
}

/** the Finances part of a place (taskPage and financesView show the same lines), else null */
export function financesPlaceOf(place: PMLastEditPlace | null | undefined): { genus?: string; lineGUID?: string } | null {
  if (!place || place.surface === 'editModal' || place.section !== PM_FINANCES_SECTION) return null;
  return { genus: place.genus, lineGUID: place.lineGUID };
}

/** the tab the task window opens on: its own place, else the first tab */
export function modalTabOf(place: PMLastEditPlace | null | undefined): 'TabMain' | 'TabUXUI' {
  return place?.surface === 'editModal' && place.section === 'TabUXUI' ? 'TabUXUI' : 'TabMain';
}

/** the section the task page scrolls to (a Finances place of the dashboard view counts: the page has the same lines) */
export function pageSectionOf(place: PMLastEditPlace | null | undefined): PMTaskPageSection | null {
  if (!place || place.surface === 'editModal') return null;
  return PM_TASK_PAGE_SECTIONS.includes(place.section as PMTaskPageSection) ? (place.section as PMTaskPageSection) : null;
}

// ───────────── the task window (PMTaskEditModal): which tab was edited ─────────────
const stable = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().filter((k) => (v as any)[k] !== undefined && (v as any)[k] !== null).map((k) => `${JSON.stringify(k)}:${stable((v as any)[k])}`).join(',')}}`;
  return JSON.stringify(v === undefined ? null : v);
};
/** two rowJSON are the same data (key order, null / undefined values and the keys in `ignore` do not count) */
export function sameRowJSON(a: Record<string, any> | null | undefined, b: Record<string, any> | null | undefined, ignore: string[] = []): boolean {
  const strip = (j: Record<string, any> | null | undefined) => Object.fromEntries(Object.entries(j || {}).filter(([k]) => !ignore.includes(k)));
  return stable(strip(a)) === stable(strip(b));
}

/**
 * The tab of the task window that holds what the user changed (null = nothing changed: the place is not touched).
 * Both tabs changed: the one the user was on when saving.
 */
export function modalEditedTab(changed: { main: boolean; uxui: boolean }, activeTab: 'TabMain' | 'TabUXUI'): 'TabMain' | 'TabUXUI' | null {
  if (changed.main && changed.uxui) return activeTab;
  if (changed.uxui) return 'TabUXUI';
  return changed.main ? 'TabMain' : null;
}
