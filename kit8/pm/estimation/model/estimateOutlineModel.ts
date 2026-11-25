// Estimation dashboard - the OUTLINE of an estimate (pure): what the printed forms (local estimate, resource sheet, quotation) list, in which order, under which heading.
// The hierarchy of an estimate is the TASK TREE of the project (since 2026-11-25 there are no section lines): a stage row = a heading with the sum of everything below it, a task row = its
// position (`rowJSON.taskGUID`). The order and the outline numbers are the ones of the tree (`buildTreeIndex`), so a printed form reads like the screen. Stages with no position below are left out.
// What the tree cannot place - an older document with section lines, an imported / example line, a line whose task was deleted - follows at the end, in the order of its own line tree.
import type { PMTaskRow } from '../../model/types';
import { buildTreeIndex } from '../../view/project/scheduling';
import { ROOT_KEY } from '../../view/project/rootKey';
import { addCost, calcDocument, EMPTY_COST, type CostBreakdown } from './estimationCalc';
import type { LineRow } from './estimationDocumentModel';
import type { EstimationDocumentJSON } from './estimationModel';

/** the part of a task row the outline reads (a PM store row fits) */
export type OutlineTask = Pick<PMTaskRow, 'rowGUID' | 'treePath' | 'orderInList'> & { rowJSON?: { rowKind?: string; taskDescription?: string | null } | null };

export type OutlineEntry =
  /** a stage (any task row with rows below it): a heading with the sum of its positions */
  | { type: 'stage'; depth: number; wbs: string; title: string; cost: CostBreakdown; taskGUID: string }
  /** a position: `title` = what is typed, else the name of its task; `stage` = the name of the stage it stands in ('' = directly under the project / no task) */
  | { type: 'position'; depth: number; wbs: string; title: string; stage: string; taskGUID: string | null; line: LineRow }
  /** a section line of an older document (it has no task): a heading with the sum of the lines below it */
  | { type: 'section'; depth: number; wbs: string; title: string; cost: CostBreakdown; line: LineRow }
  /** the heading in front of the lines the task tree could not place, when the tree placed others too */
  | { type: 'unplaced'; depth: number; wbs: string; title: string; cost: CostBreakdown };

export interface EstimateOutline {
  entries: OutlineEntry[];
  /** the positions in the order of the outline (what the resource sheet and the quotation list) */
  positions: Extract<OutlineEntry, { type: 'position' }>[];
  /** how many positions the task tree placed / could not place */
  placed: number;
  unplaced: number;
}

export interface OutlineInput {
  /** the tasks of the estimation project; none = the document is outlined by its own (older) line tree */
  tasks?: readonly OutlineTask[] | null;
  lines: readonly LineRow[];
  /** `calcDocument(lines, doc).byLine` */
  byLine: Record<string, CostBreakdown>;
  doc?: Partial<EstimationDocumentJSON> | null;
}

const taskName = (t: OutlineTask | undefined): string => String(t?.rowJSON?.taskDescription ?? '').trim();

export function buildEstimateOutline(input: OutlineInput): EstimateOutline {
  const entries: OutlineEntry[] = [];
  const positions: EstimateOutline['positions'] = [];
  const tasks = (input.tasks ?? []) as OutlineTask[];
  const byTask = new Map<string, LineRow[]>();
  const placedLines = new Set<string>();
  const taskSet = new Set(tasks.map((t) => t.rowGUID));
  for (const l of input.lines) {
    const g = l.rowJSON.taskGUID;
    if (l.rowJSON.lineKind !== 'position' || !g || !taskSet.has(g)) continue;
    if (!byTask.has(g)) byTask.set(g, []);
    byTask.get(g)!.push(l);
  }
  for (const list of byTask.values()) list.sort((a, b) => a.orderInList - b.orderInList);

  if (tasks.length) {
    const tree = buildTreeIndex(tasks as PMTaskRow[]);
    const byGUID = new Map(tasks.map((t) => [t.rowGUID, t]));
    const memo = new Map<string, { cost: CostBreakdown; count: number }>();
    const total = (guid: string, seen = new Set<string>()): { cost: CostBreakdown; count: number } => {
      const hit = memo.get(guid);
      if (hit) return hit;
      if (seen.has(guid)) return { cost: EMPTY_COST, count: 0 };
      seen.add(guid);
      let cost = EMPTY_COST;
      let count = 0;
      for (const l of byTask.get(guid) ?? []) { cost = addCost(cost, input.byLine[l.rowGUID] ?? EMPTY_COST); count += 1; }
      for (const k of tree.childrenById[guid] ?? []) { const c = total(k, seen); cost = addCost(cost, c.cost); count += c.count; }
      const r = { cost, count };
      memo.set(guid, r);
      return r;
    };
    const walk = (guid: string, stageName: string, visited: Set<string>): void => {
      if (visited.has(guid)) return;
      visited.add(guid);
      const t = byGUID.get(guid);
      const sum = total(guid);
      if (!sum.count) return; // nothing to print under this row
      const kids = tree.childrenById[guid] ?? [];
      const isStage = kids.length > 0;
      const depth = tree.depthById[guid] ?? 0;
      const wbs = tree.wbsById[guid] ?? '';
      if (isStage) entries.push({ type: 'stage', depth, wbs, title: taskName(t), cost: sum.cost, taskGUID: guid });
      for (const l of byTask.get(guid) ?? []) {
        placedLines.add(l.rowGUID);
        const e: Extract<OutlineEntry, { type: 'position' }> = { type: 'position', depth: isStage ? depth + 1 : depth, wbs, title: String(l.rowJSON.title ?? '').trim() || taskName(t), stage: isStage ? taskName(t) : stageName, taskGUID: guid, line: l };
        entries.push(e);
        positions.push(e);
      }
      for (const k of kids) walk(k, isStage ? taskName(t) : stageName, visited);
    };
    const visited = new Set<string>();
    for (const r of tree.childrenById[ROOT_KEY] ?? []) walk(r, '', visited);
  }

  // what the tree did not place, in the order of the lines' own tree (an older document keeps its sections)
  const rest = input.lines.filter((l) => !placedLines.has(l.rowGUID) && (l.rowJSON.lineKind === 'position' || l.rowJSON.lineKind === 'section') && !(l.rowJSON.lineKind === 'section' && !!l.rowJSON.taskGUID && taskSet.has(l.rowJSON.taskGUID)));
  const placed = positions.length;
  if (rest.some((l) => l.rowJSON.lineKind === 'position')) {
    const calc = calcDocument(rest, input.doc);
    const byGUID = new Map(rest.map((l) => [l.rowGUID, l]));
    const tail: OutlineEntry[] = [];
    const tailPositions: EstimateOutline['positions'] = [];
    let section = '';
    for (const { rowGUID, depth } of calc.order) {
      const l = byGUID.get(rowGUID)!;
      if (l.rowJSON.lineKind === 'section') { section = String(l.rowJSON.title ?? '').trim(); tail.push({ type: 'section', depth, wbs: '', title: section, cost: calc.byLine[rowGUID] ?? EMPTY_COST, line: l }); continue; }
      if (l.rowJSON.lineKind !== 'position') continue;
      const e: Extract<OutlineEntry, { type: 'position' }> = { type: 'position', depth, wbs: '', title: String(l.rowJSON.title ?? '').trim(), stage: depth > 0 ? section : '', taskGUID: null, line: l };
      tail.push(e);
      tailPositions.push(e);
    }
    // a section heading with nothing below it is not printed
    const clean = tail.filter((e, i) => e.type !== 'section' || (tail[i + 1] && tail[i + 1].depth > e.depth));
    if (placed) entries.push({ type: 'unplaced', depth: 0, wbs: '', title: '', cost: calc.total });
    entries.push(...clean);
    positions.push(...tailPositions);
    return { entries, positions, placed, unplaced: tailPositions.length };
  }
  return { entries, positions, placed, unplaced: 0 };
}
