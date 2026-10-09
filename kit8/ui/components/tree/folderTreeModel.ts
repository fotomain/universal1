// TREE.PLUGIN - folderTreeModel: the pure data side of FolderTreeReusable (no React, no react-native).
//
// Built for BIG data (200 000+ folders): the flat node list is turned into typed arrays (parent index + a
// CSR child list), so building the index is O(n), a flatten of the VISIBLE rows is O(visible), and nothing
// recurses (a 100 000-level chain cannot overflow the stack).
//
//   nodes (flat: id, parentId, title, order)
//     -> buildTreeIndex()   parent[] + childStart[] / childList[] (siblings sorted by `order`), cycles / orphans healed
//     -> flattenTree()      the rows to draw now (expanded set + optional search mask), depth per row
//     -> computeSubtreeTotals()   item counts per folder incl. subfolders
//     -> planMove() / planCreate() / planDuplicate()   what a CRUD / drag & drop operation saves (parent + order)
//     -> treeOps            immutable updates of the flat list (for local state / demos / optimistic UI)

/** one folder */
export interface FolderTreeNode {
  id: string;
  /** null / undefined / '' / 'empty' = a top level folder */
  parentId?: string | null;
  title: string;
  /** sort key among the siblings (ascending). Any number; fractions are fine (a new order is the middle of its neighbours) */
  order?: number;
  /** icon name for the row (default: folder / folder_open) */
  icon?: string;
  /** color of the icon */
  color?: string;
  /** anything the caller needs back (the source row ...) */
  data?: any;
}

/** pinned row "All items": selection = no folder filter; as a drop target of a folder = the top level */
export const TREE_ALL_ID = '__tree_all__';
/** pinned row "No folder": items without a folder */
export const TREE_NONE_ID = '__tree_none__';

/** the gap between two orders when a node is put first / last */
export const ORDER_GAP = 1000;

export interface TreeIndex {
  nodes: FolderTreeNode[];
  /** number of nodes; also the index of the virtual root */
  n: number;
  idToIdx: Map<string, number>;
  /** parent index per node (n = the virtual root); parent[n] = -1 */
  parent: Int32Array;
  /** children of node i (or of the root, i = n): childList[childStart[i] .. childStart[i + 1]) */
  childStart: Int32Array;
  childList: Int32Array;
  /** nodes whose parent was missing (shown at the top level) and nodes whose parent loop was cut */
  orphans: number;
  loops: number;
}

const isRootParent = (p: string | null | undefined) => p == null || p === '' || p === 'empty';

/** O(n) (+ O(n log n) only when the nodes are not sorted by `order` already) */
export function buildTreeIndex(nodes: FolderTreeNode[]): TreeIndex {
  const n = nodes.length;
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) idToIdx.set(nodes[i].id, i);

  // parent index: missing / self parent -> top level
  const parent = new Int32Array(n + 1);
  parent[n] = -1;
  let orphans = 0;
  for (let i = 0; i < n; i++) {
    const pid = nodes[i].parentId;
    if (isRootParent(pid)) { parent[i] = n; continue; }
    const p = idToIdx.get(pid as string);
    if (p === undefined || p === i) { parent[i] = n; orphans++; } else parent[i] = p;
  }

  // a parent loop (A -> B -> A) would hide its nodes for ever: cut it at the node where the walk closes
  let loops = 0;
  const state = new Uint8Array(n); // 0 new, 1 on the current walk, 2 done
  const path: number[] = [];
  for (let s = 0; s < n; s++) {
    if (state[s] !== 0) continue;
    path.length = 0;
    let cur = s;
    while (cur !== n && state[cur] === 0) { state[cur] = 1; path.push(cur); cur = parent[cur]; }
    if (cur !== n && state[cur] === 1) { parent[cur] = n; loops++; }
    for (let k = 0; k < path.length; k++) state[path[k]] = 2;
  }

  // siblings sorted by order (stable); skipped when the list is sorted already
  let sorted = true;
  const ord = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const o = nodes[i].order;
    ord[i] = typeof o === 'number' && Number.isFinite(o) ? o : 0;
    if (i > 0 && ord[i] < ord[i - 1]) sorted = false;
  }
  let sequence: ArrayLike<number> | null = null;
  if (!sorted) {
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    idx.sort((a, b) => ord[a] - ord[b] || a - b);
    sequence = idx;
  }

  // CSR child lists (counting sort by parent keeps the order of `sequence`)
  const childStart = new Int32Array(n + 2);
  for (let i = 0; i < n; i++) childStart[parent[i] + 1]++;
  for (let i = 0; i <= n; i++) childStart[i + 1] += childStart[i];
  const cursor = childStart.slice(0, n + 1);
  const childList = new Int32Array(n);
  for (let k = 0; k < n; k++) {
    const i = sequence ? sequence[k] : k;
    childList[cursor[parent[i]]++] = i;
  }
  return { nodes, n, idToIdx, parent, childStart, childList, orphans, loops };
}

export const childCount = (ix: TreeIndex, i: number) => ix.childStart[i + 1] - ix.childStart[i];
export const hasChildren = (ix: TreeIndex, i: number) => ix.childStart[i + 1] > ix.childStart[i];
export const childrenOf = (ix: TreeIndex, i: number): Int32Array => ix.childList.subarray(ix.childStart[i], ix.childStart[i + 1]);
/** parent index of a node: n = the top level */
export const parentOf = (ix: TreeIndex, i: number) => ix.parent[i];
export const rootIndex = (ix: TreeIndex) => ix.n;

/** depth of a node (0 = top level) */
export function depthOf(ix: TreeIndex, i: number): number {
  let d = 0;
  for (let p = ix.parent[i]; p !== ix.n && p >= 0; p = ix.parent[p]) d++;
  return d;
}

/** ancestor indices, nearest first (without the virtual root) */
export function ancestorsOf(ix: TreeIndex, i: number): number[] {
  const out: number[] = [];
  for (let p = ix.parent[i]; p !== ix.n && p >= 0; p = ix.parent[p]) out.push(p);
  return out;
}

/** titles from the top level down to the node */
export function pathOf(ix: TreeIndex, i: number): string[] {
  return [...ancestorsOf(ix, i).reverse(), i].map((k) => ix.nodes[k].title);
}

/** `ancestor` is `i` itself or one of its ancestors */
export function isSelfOrAncestor(ix: TreeIndex, ancestor: number, i: number): boolean {
  for (let p = i; p !== ix.n && p >= 0; p = ix.parent[p]) if (p === ancestor) return true;
  return false;
}

/** the node and every node below it (pre-order, iterative) */
export function subtreeOf(ix: TreeIndex, i: number): number[] {
  const out: number[] = [];
  const stack = [i];
  while (stack.length) {
    const k = stack.pop() as number;
    out.push(k);
    for (let c = ix.childStart[k + 1] - 1; c >= ix.childStart[k]; c--) stack.push(ix.childList[c]);
  }
  return out;
}

/** ids of a node and everything below it */
export const subtreeIds = (ix: TreeIndex, i: number): string[] => subtreeOf(ix, i).map((k) => ix.nodes[k].id);

// ───────────────────────────── search ─────────────────────────────

export interface SearchMask {
  /** 1 = the node matches or has a matching descendant */
  mask: Uint8Array;
  matches: number;
}

/** nodes whose title contains `query` (case-insensitive) + all their ancestors */
export function buildSearchMask(ix: TreeIndex, query: string): SearchMask {
  const q = query.trim().toLowerCase();
  const mask = new Uint8Array(ix.n);
  let matches = 0;
  if (!q) return { mask, matches };
  for (let i = 0; i < ix.n; i++) {
    if (ix.nodes[i].title.toLowerCase().indexOf(q) < 0) continue;
    matches++;
    for (let k = i; k !== ix.n && k >= 0 && mask[k] === 0; k = ix.parent[k]) mask[k] = 1;
    mask[i] = 1;
  }
  return { mask, matches };
}

// ───────────────────────────── flatten ─────────────────────────────

export interface FlatRows {
  /** node index per visible row */
  idx: Int32Array;
  /** depth per visible row */
  depth: Int32Array;
  length: number;
}

export interface FlattenOptions {
  expanded: ReadonlySet<string>;
  /** search: only masked nodes are shown, and every masked node that has masked children is open */
  mask?: Uint8Array | null;
  /** every folder open (expand all) */
  expandAll?: boolean;
}

/** the visible rows in display order: O(visible rows) */
export function flattenTree(ix: TreeIndex, { expanded, mask, expandAll }: FlattenOptions): FlatRows {
  const { n, nodes, childStart, childList } = ix;
  const idx = new Int32Array(n);
  const depth = new Int32Array(n);
  let len = 0;
  const stackIdx = new Int32Array(n + 1);
  const stackDepth = new Int32Array(n + 1);
  let sp = 0;
  for (let c = childStart[n + 1] - 1; c >= childStart[n]; c--) {
    const k = childList[c];
    if (mask && !mask[k]) continue;
    stackIdx[sp] = k; stackDepth[sp] = 0; sp++;
  }
  while (sp > 0) {
    sp--;
    const k = stackIdx[sp];
    const d = stackDepth[sp];
    idx[len] = k; depth[len] = d; len++;
    const s = childStart[k];
    const e = childStart[k + 1];
    if (e === s) continue;
    if (!(mask || expandAll || expanded.has(nodes[k].id))) continue;
    for (let c = e - 1; c >= s; c--) {
      const ch = childList[c];
      if (mask && !mask[ch]) continue;
      stackIdx[sp] = ch; stackDepth[sp] = d + 1; sp++;
    }
  }
  return { idx: idx.slice(0, len), depth: depth.slice(0, len), length: len };
}

/** a masked node has masked children (so it is drawn open in a search) */
export function hasMaskedChildren(ix: TreeIndex, i: number, mask: Uint8Array): boolean {
  for (let c = ix.childStart[i]; c < ix.childStart[i + 1]; c++) if (mask[ix.childList[c]]) return true;
  return false;
}

// ───────────────────────────── counts ─────────────────────────────

/**
 * items per folder including all subfolders. `direct` = items directly in a folder (by node id).
 * Result: Int32Array(n + 1), the last entry = every counted item below the top level.
 */
export function computeSubtreeTotals(ix: TreeIndex, direct: ReadonlyMap<string, number> | Record<string, number>): Int32Array {
  const { n, nodes, parent, childStart, childList } = ix;
  const total = new Int32Array(n + 1);
  const get = direct instanceof Map ? (id: string) => direct.get(id) ?? 0 : (id: string) => (direct as Record<string, number>)[id] ?? 0;
  for (let i = 0; i < n; i++) total[i] = get(nodes[i].id);
  // pre-order, then walk it backwards: a child is always added before its parent is read
  const order = new Int32Array(n);
  let len = 0;
  const stack = new Int32Array(n + 1);
  let sp = 0;
  for (let c = childStart[n + 1] - 1; c >= childStart[n]; c--) stack[sp++] = childList[c];
  while (sp > 0) {
    const k = stack[--sp];
    order[len++] = k;
    for (let c = childStart[k + 1] - 1; c >= childStart[k]; c--) stack[sp++] = childList[c];
  }
  for (let k = len - 1; k >= 0; k--) { const i = order[k]; total[parent[i]] += total[i]; }
  return total;
}

/** counts per folder id from items (rows): `folderOf(item)` = the folder id (or a value that is no folder) */
export function countItemsByFolder<T>(items: readonly T[], folderOf: (item: T) => string | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    const f = folderOf(items[i]);
    const key = f == null || f === '' ? 'empty' : f;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

// ───────────────────────────── order ─────────────────────────────

/** an order strictly between two (undefined = open end) */
export function orderBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return ORDER_GAP;
  if (prev === undefined) return (next as number) - ORDER_GAP;
  if (next === undefined) return prev + ORDER_GAP;
  const mid = (prev + next) / 2;
  // the floats ran out of room between two neighbours
  if (mid > prev && mid < next) return mid;
  return prev + (next - prev) / 4 || prev + 1e-9;
}

/** order of a node among its siblings (a node without `order` takes its place in the list) */
function orderAtRank(ix: TreeIndex, siblings: ArrayLike<number>, rank: number): number {
  const o = ix.nodes[siblings[rank]].order;
  return typeof o === 'number' && Number.isFinite(o) ? o : (rank + 1) * ORDER_GAP;
}

/** the sibling list of `parentIdx` without `skip` */
function siblingsWithout(ix: TreeIndex, parentIdx: number, skip: number): number[] {
  const out: number[] = [];
  for (let c = ix.childStart[parentIdx]; c < ix.childStart[parentIdx + 1]; c++) if (ix.childList[c] !== skip) out.push(ix.childList[c]);
  return out;
}

/** order for a new last child of `parentIdx` (n = the top level) */
export function orderForAppend(ix: TreeIndex, parentIdx: number, skip = -1): number {
  const sib = siblingsWithout(ix, parentIdx, skip);
  return sib.length === 0 ? ORDER_GAP : orderAtRank(ix, sib, sib.length - 1) + ORDER_GAP;
}

// ───────────────────────────── drop positions / moves ─────────────────────────────

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Where in a row the pointer is: top quarter = before, bottom quarter = after, the middle = inside.
 * Without `canReorder` the whole row means inside; without `canNest` only before / after.
 */
export function dropPositionAt(yInRow: number, rowHeight: number, canNest: boolean, canReorder: boolean): DropPosition {
  if (!canReorder) return 'inside';
  const r = rowHeight > 0 ? yInRow / rowHeight : 0.5;
  if (!canNest) return r < 0.5 ? 'before' : 'after';
  return r < 0.25 ? 'before' : r > 0.75 ? 'after' : 'inside';
}

export interface MovePlan {
  ok: boolean;
  /** why not */
  reason?: 'self' | 'inside-itself' | 'same-place';
  /** new parent (null = top level) */
  parentId: string | null;
  parentIdx: number;
  order: number;
}

export interface PlanMoveOptions {
  /** the target folder is open (an 'after' drop on an open folder with children becomes its first child) */
  targetExpanded?: boolean;
}

/** what dropping `moving` before / after / inside `target` saves */
export function planMove(ix: TreeIndex, moving: number, target: number, position: DropPosition, opts: PlanMoveOptions = {}): MovePlan {
  const none = (reason: MovePlan['reason']): MovePlan => ({ ok: false, reason, parentId: null, parentIdx: ix.n, order: 0 });
  if (moving === target) return none('self');
  if (isSelfOrAncestor(ix, moving, target)) return none('inside-itself');
  // 'after' an open folder with children = its first child (that is where the row is drawn)
  const firstChild = position === 'after' && !!opts.targetExpanded && hasChildren(ix, target);
  const pos: DropPosition = firstChild ? 'inside' : position;

  let parentIdx: number;
  let order: number;
  if (pos === 'inside') {
    parentIdx = target;
    const sib = siblingsWithout(ix, target, moving);
    if (firstChild) order = sib.length ? orderBetween(undefined, orderAtRank(ix, sib, 0)) : ORDER_GAP;
    else order = sib.length ? orderAtRank(ix, sib, sib.length - 1) + ORDER_GAP : ORDER_GAP;
  } else {
    parentIdx = ix.parent[target];
    const sib = siblingsWithout(ix, parentIdx, moving);
    const at = sib.indexOf(target);
    if (pos === 'before') order = orderBetween(at > 0 ? orderAtRank(ix, sib, at - 1) : undefined, orderAtRank(ix, sib, at));
    else order = orderBetween(orderAtRank(ix, sib, at), at + 1 < sib.length ? orderAtRank(ix, sib, at + 1) : undefined);
  }
  const parentId = parentIdx === ix.n ? null : ix.nodes[parentIdx].id;
  // the same parent and the same slot (same neighbours) = nothing to save
  if (ix.parent[moving] === parentIdx) {
    const sib = Array.from(childrenOf(ix, parentIdx));
    const before = sib.indexOf(moving);
    const without = sib.filter((k) => k !== moving);
    let slot = 0;
    while (slot < without.length && orderAtRank(ix, without, slot) < order) slot++;
    if (slot === before) return { ok: false, reason: 'same-place', parentId, parentIdx, order };
  }
  return { ok: true, parentId, parentIdx, order };
}

/** new node under `parentIdx` (n / -1 = top level): last child, or right after `afterIdx` */
export function planCreate(ix: TreeIndex, parentIdx: number, afterIdx = -1): { parentId: string | null; order: number } {
  const p = parentIdx < 0 || parentIdx > ix.n ? ix.n : parentIdx;
  const parentId = p === ix.n ? null : ix.nodes[p].id;
  if (afterIdx < 0 || ix.parent[afterIdx] !== p) return { parentId, order: orderForAppend(ix, p) };
  const sib = Array.from(childrenOf(ix, p));
  const at = sib.indexOf(afterIdx);
  return { parentId, order: orderBetween(orderAtRank(ix, sib, at), at + 1 < sib.length ? orderAtRank(ix, sib, at + 1) : undefined) };
}

export interface NewNode { id: string; parentId: string | null; title: string; order: number }

/**
 * copy of a folder and its subfolders (not the items) right after the original. `newId` makes the ids.
 * Returns null when the subtree is bigger than `limit`.
 */
export function planDuplicate(ix: TreeIndex, i: number, newId: () => string, titleOf: (title: string) => string = (t) => `${t} (copy)`, limit = 2000): NewNode[] | null {
  const sub = subtreeOf(ix, i);
  if (sub.length > limit) return null;
  const ids = new Map<number, string>();
  for (const k of sub) ids.set(k, newId());
  const top = planCreate(ix, ix.parent[i], i);
  return sub.map((k) => k === i
    ? { id: ids.get(k) as string, parentId: top.parentId, title: titleOf(ix.nodes[k].title), order: top.order }
    : { id: ids.get(k) as string, parentId: ids.get(ix.parent[k]) as string, title: ix.nodes[k].title, order: ix.nodes[k].order ?? 0 });
}

/** move up (-1) / down (1) among the siblings: a MovePlan of the neighbour jump, or null at the end of the list */
export function planStep(ix: TreeIndex, i: number, direction: 1 | -1): MovePlan | null {
  const p = ix.parent[i];
  const sib = Array.from(childrenOf(ix, p));
  const at = sib.indexOf(i);
  const to = at + direction;
  if (at < 0 || to < 0 || to >= sib.length) return null;
  return planMove(ix, i, sib[to], direction === -1 ? 'before' : 'after');
}

// ───────────────────────────── immutable updates of the flat list ─────────────────────────────

/** local-state helpers (demo / optimistic UI): every call returns a new array, O(n) */
export const treeOps = {
  create: (nodes: FolderTreeNode[], node: FolderTreeNode): FolderTreeNode[] => [...nodes, node],
  createMany: (nodes: FolderTreeNode[], add: FolderTreeNode[]): FolderTreeNode[] => nodes.concat(add),
  rename: (nodes: FolderTreeNode[], id: string, title: string): FolderTreeNode[] => nodes.map((x) => (x.id === id ? { ...x, title } : x)),
  remove: (nodes: FolderTreeNode[], ids: ReadonlySet<string>): FolderTreeNode[] => nodes.filter((x) => !ids.has(x.id)),
  move: (nodes: FolderTreeNode[], id: string, parentId: string | null, order: number): FolderTreeNode[] => nodes.map((x) => (x.id === id ? { ...x, parentId, order } : x)),
};

/** a short, unique-enough id for local trees (use expo-crypto randomUUID for stored data) */
let localCounter = 0;
export const localNodeId = () => `n_${Date.now().toString(36)}_${(localCounter++).toString(36)}`;
