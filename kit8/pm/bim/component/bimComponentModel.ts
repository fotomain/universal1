// BIM component (one detail of the model) - the pure part: the route and its params, the IFC properties as lines, the details text that "Share" sends, "one task = one component".
// No React, no three, no Supabase (tested in __tests__/bim/bimComponentModel.test.ts).
import type { BimElementRow } from '../model/bimModel';
import { dashboardLinkPath, dashboardProjectPath } from '../../view/project/dashboardDeepLink';

/** the screen of ONE component: its 3D image (only this element), its properties and, under the image, the edit tables of its task */
export const BIM_COMPONENT_ROUTE = '/pm/bim/component';

export interface BimComponentLink {
  projectGUID: string;
  /** the IFC GlobalId of the element */
  elementGUID: string;
  /** the task of the element (the screen finds it itself when it is missing) */
  taskGUID?: string | null;
  /** where Back goes when there is no history (a link typed in a new browser tab): a route path; default = the dashboard */
  returnTo?: string | null;
}

const clean = (v: unknown, max = 128): string | undefined => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === 'string' && t.trim() && t.length <= max ? t.trim() : undefined;
};

/** only what is given */
export function bimComponentParams(link: BimComponentLink): Record<string, string> {
  return {
    projectGUID: link.projectGUID,
    elementGUID: link.elementGUID,
    ...(link.taskGUID ? { taskGUID: link.taskGUID } : {}),
    ...(link.returnTo ? { returnTo: link.returnTo } : {}),
  };
}

export function bimComponentPath(link: BimComponentLink): string {
  const q = Object.entries(bimComponentParams(link)).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${BIM_COMPONENT_ROUTE}?${q}`;
}

/** the route params -> the link; null when the project or the element is missing. `returnTo` must be a path of this app ("/..." and not "//"), else it is dropped. */
export function parseBimComponentParams(params: Record<string, unknown> | null | undefined): BimComponentLink | null {
  const projectGUID = clean(params?.projectGUID, 64);
  const elementGUID = clean(params?.elementGUID, 64);
  if (!projectGUID || !elementGUID) return null;
  const taskGUID = clean(params?.taskGUID, 64);
  const rt = clean(params?.returnTo, 300);
  const returnTo = rt && rt.startsWith('/') && !rt.startsWith('//') ? rt : undefined;
  return { projectGUID, elementGUID, ...(taskGUID ? { taskGUID } : {}), ...(returnTo ? { returnTo } : {}) };
}

/** the property sets of an element as plain lines: a head line per set, a line per value */
export function propertyLines(json: Record<string, any> | null): Array<{ head: boolean; text: string }> {
  if (!json || !json.sets) return [];
  const out: Array<{ head: boolean; text: string }> = [];
  for (const [set, vals] of Object.entries<any>(json.sets)) {
    out.push({ head: true, text: set });
    for (const [k, v] of Object.entries<any>(vals || {})) out.push({ head: false, text: `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}` });
  }
  return out;
}

/** taskGUID -> its elements, from the rows of the model */
export function elementsOfTasks(elements: BimElementRow[]): Map<string, BimElementRow[]> {
  const m = new Map<string, BimElementRow[]>();
  for (const e of elements) {
    if (!e.taskGUID) continue;
    const list = m.get(e.taskGUID);
    if (list) list.push(e);
    else m.set(e.taskGUID, [e]);
  }
  return m;
}

/** "single detail = task": the element of a task that has exactly ONE element; undefined for a task of many elements (a grouped task, a stage) or of none */
export function singleElementOfTask(byTask: Map<string, BimElementRow[]>, taskGUID: string | null | undefined): BimElementRow | undefined {
  if (!taskGUID) return undefined;
  const list = byTask.get(taskGUID);
  return list && list.length === 1 ? list[0] : undefined;
}

export interface BimComponentInfoInput {
  projectName?: string | null;
  /** the stage / parents of the task, outermost first */
  taskPath?: string[];
  taskName?: string | null;
  element: Pick<BimElementRow, 'ifcGuid' | 'name' | 'ifcClass' | 'typeName'>;
  storeyName?: string | null;
  properties?: Record<string, any> | null;
  link?: string | null;
}

/** the details text of "Share": what the component is, where it sits in the plan, its IFC properties, the link to its screen */
export function buildBimComponentInfoText(i: BimComponentInfoInput): string {
  const lines: string[] = [];
  if (i.projectName) lines.push(`Project: ${i.projectName}`);
  if (i.taskPath && i.taskPath.length) lines.push(`In: ${i.taskPath.join(' › ')}`);
  if (i.taskName) lines.push(`Task: ${i.taskName}`);
  lines.push(`Component: ${i.element.name || i.element.ifcGuid}`);
  const kind = [i.element.ifcClass, i.element.typeName].filter(Boolean).join(' · ');
  if (kind) lines.push(`Class: ${kind}`);
  if (i.storeyName) lines.push(`Storey: ${i.storeyName}`);
  lines.push(`IFC GlobalId: ${i.element.ifcGuid}`);
  const props = propertyLines(i.properties ?? null);
  if (props.length) {
    lines.push('', 'Properties:');
    for (const p of props) lines.push(p.head ? `${p.text}` : `  ${p.text}`);
  }
  if (i.link) lines.push('', `Link: ${i.link}`);
  return lines.join('\n');
}

/** the file name of the picture of a component: letters, digits, - and _ only */
export function bimComponentFileBase(element: Pick<BimElementRow, 'name' | 'ifcGuid'>): string {
  const base = (element.name || element.ifcGuid).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return `bim_${base || 'component'}`;
}

// ---- the screen: where Back goes without history, and the heights of its parts ----
const PROPS_H = 170;
const MIN_EDIT_H = 340;

/** where Back goes when there is no `returnTo` and no history: the dashboard at the task (or the project) */
export function bimComponentBackTarget(link: Pick<BimComponentLink, 'projectGUID' | 'taskGUID'>, taskGUID: string | null | undefined): string {
  const t = taskGUID || link.taskGUID;
  return t ? dashboardLinkPath({ projectGUID: link.projectGUID, taskGUID: t }) : dashboardProjectPath(link.projectGUID);
}

/** the heights of the three parts: the image, the properties, the edit tables (the part under the image scrolls when the window is short) */
export function bimComponentLayout(bodyHeight: number, full: boolean): { viewerH: number; propsH: number; editH: number } {
  if (full) return { viewerH: Math.max(120, bodyHeight), propsH: 0, editH: 0 };
  const viewerH = Math.round(Math.min(560, Math.max(200, bodyHeight * 0.42)));
  const lower = Math.max(0, bodyHeight - viewerH);
  return { viewerH, propsH: PROPS_H, editH: Math.max(MIN_EDIT_H, lower - PROPS_H - 16) };
}
