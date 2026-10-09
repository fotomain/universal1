// TREE.PLUGIN - FolderTreeReusable: a folder tree for web + iOS + Android that stays fast with 200 000+ folders.
//
//   data       flat nodes { id, parentId, title, order } (controlled: the caller keeps them in redux / state)
//   speed      typed-array index (folderTreeModel) + a windowed list: only the rows in view are mounted (~40),
//              expand / collapse / search / select never touch the other rows
//   CRUD       create folder / subfolder (inline rename right away) · rename (F2, double click, menu) · sql_for_delete with its
//              subfolders (asks first) · duplicate with subfolders · move up / down · every command is a callback;
//              a callback that is not given hides its command
//   drag&drop  drag a folder to reorder it (line before / after) or to nest it (inside); drop ROWS of a table (any
//              'items' payload, see folderTreeDnd) on a folder = onDropItems(folderId); drop on "No folder" = null;
//              hover over a closed folder opens it, near the edge the list scrolls
//   keyboard   (web) ↑ ↓ ← → Home End · F2 rename · Delete · Insert / Ctrl+N new subfolder · * expand all below
//   counts     itemCounts = items per folder; the tree adds up the subfolders
//   works alone, and together with ReusableTable (uxuiTable.showFoldersTree, see ../table/reusable)
//
// Minimal use:
//   const { nodes, treeProps } = useLocalFolderTree(initialNodes);
//   <FolderTreeReusable nodes={nodes} {...treeProps} />
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextInput, useWindowDimensions, View, ViewStyle } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { FABContextAction, useFABContextActions } from '../../../providers/FABProvider';
import { PMIconButton } from '../../../pm/inner/buttons/PMIconButton';
import PMContextMenu from '../../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../../pm/inner/menu/PMMenuItem';
import AskBeforeDeletePostComponent from '../common/AskBeforeDeletePostComponent';
import IconApp from '../common/IconApp';
import FolderTreeDragGhost from './FolderTreeDragGhost';
import FolderTreeRow, { RowDropState } from './FolderTreeRow';
import {
  DropRect, FolderDragPayload, measureViewRect, registerDropZone, useFolderDragActive,
} from './folderTreeDnd';
import {
  ancestorsOf, buildSearchMask, buildTreeIndex, computeSubtreeTotals, DropPosition, dropPositionAt, flattenTree, FlatRows, FolderTreeNode,
  hasChildren, hasMaskedChildren, localNodeId, NewNode, orderForAppend, planCreate, planDuplicate, planMove, planStep, subtreeIds, subtreeOf, TREE_ALL_ID, TREE_NONE_ID, TreeIndex,
} from './folderTreeModel';

export interface FolderTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
  /** open the ancestors of a folder, select it and scroll to it */
  reveal: (id: string) => void;
  select: (id: string) => void;
  /** new folder under parentId (null / undefined = top level), named right away */
  startCreate: (parentId?: string | null) => void;
  startRename: (id: string) => void;
  scrollToNode: (id: string) => void;
}

/** how the tree looks and behaves (prop `uxuiFolders`) */
export interface FolderTreeUxUi {
  /**
   * The tree (and the table beside it in ReusableTable) is as high as the screen: from its top edge down to the bottom of the
   * window, so everything is visible without scrolling the page; the rows scroll inside (default true).
   * An explicit `height` prop wins. false = the height the parent gives it (default '100%').
   */
  alwaysFullHeight?: boolean;
  /** px kept free below the tree when alwaysFullHeight (default 16) */
  fullHeightBottomOffset?: number;
  /** smallest height when alwaysFullHeight (default 260) */
  fullHeightMin?: number;
  /**
   * double click (web) on a folder: 'toggleOpenClose' (default) = open / close its subfolders (a folder without subfolders: nothing)
   * | 'openToEdit' = rename it in place
   */
  doubleClickOnBranch?: 'toggleOpenClose' | 'openToEdit';
  /** the main FAB (bottom right) shows the folder commands while the tree is on the screen (default true) */
  commandsInMainFab?: boolean;
}

export interface FolderTreeMove { id: string; parentId: string | null; order: number }

export interface FolderTreeReusableProps {
  nodes: FolderTreeNode[];
  /** an index built by the caller (ReusableTable builds one for its own folder filter): saves a second build */
  index?: TreeIndex;
  testID?: string;
  title?: string;
  /** header (title + buttons + search) */
  showHeader?: boolean;
  showToolbar?: boolean;
  showSearch?: boolean;
  /** px: the title + buttons bar / the search row (to line the tree up with a table: ReusableTable sets them) */
  toolbarHeight?: number;
  searchHeight?: number;
  rowHeight?: number;
  /** px per level */
  indent?: number;
  /** px or '100%' (default: fills the parent) */
  height?: number | string;
  style?: StyleProp<ViewStyle>
  /** no CRUD, no drag & drop of folders (selection, search and item drops still work) */
  readOnly?: boolean;
  /** look + behaviour: alwaysFullHeight (default true), doubleClickOnBranch (default 'toggleOpenClose'), commandsInMainFab (default true) */
  uxuiFolders?: FolderTreeUxUi;

  // ---- selection ----
  /** TREE_ALL_ID / TREE_NONE_ID / a folder id (controlled) */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string, node?: FolderTreeNode) => void;
  /** pinned row "All items" (selecting it = no folder filter; a folder dropped on it goes to the top level) */
  showAllNode?: boolean;
  allLabel?: string;
  /** pinned row "No folder" (items dropped on it get no folder) */
  showNoneNode?: boolean;
  noneLabel?: string;

  // ---- expansion ----
  defaultExpandedIds?: string[];
  /** open the first N levels at the start (default 1 = the top level folders are open) */
  initialExpandDepth?: number;

  // ---- counts ----
  /** items directly in a folder, by folder id */
  itemCounts?: ReadonlyMap<string, number> | Record<string, number>;
  /** 'total' = with the subfolders (default) | 'direct' */
  countMode?: 'total' | 'direct';
  totalCount?: number;
  noneCount?: number;

  // ---- CRUD (a missing callback hides its command) ----
  onCreate?: (node: NewNode) => void;
  onRename?: (id: string, title: string, previousTitle: string) => void;
  /** ids = the folder and ALL its subfolders; rootId = the folder the user chose */
  onDelete?: (ids: string[], rootId: string) => void;
  /** a folder was dropped / moved: new parent (null = top level) and order */
  onMove?: (move: FolderTreeMove) => void;
  onRefresh?: () => void;
  newFolderTitle?: string;
  /** id of a new folder (default: a local id; pass Crypto.randomUUID for stored data) */
  newId?: () => string;
  /** ask before deleting (default true) */
  confirmDelete?: boolean;
  /** what the sql_for_delete question says besides the folder name */
  deleteHint?: string;
  /** duplicate with subfolders is refused above this many folders (default 2000) */
  maxDuplicateNodes?: number;
  extraMenuItems?: (node: FolderTreeNode, close: () => void) => PMMenuItemProps[];

  // ---- drag & drop ----
  /** folders can be dragged (default true; needs onMove) */
  dragEnabled?: boolean;
  /** rows dropped on a folder (null = "No folder"); payload.kind 'items' */
  onDropItems?: (folderId: string | null, payload: FolderDragPayload) => void;
  /** which payload kinds may be dropped INTO a folder (default ['items']) */
  acceptItemKinds?: string[];
  /** draw the dragged picture (default true; ReusableTable draws it itself) */
  dragGhost?: boolean;
  /** hover over a closed folder opens it after this many ms (default 700, 0 = off) */
  hoverExpandMs?: number;

  onMessage?: (message: string) => void;
  emptyText?: string;
}

let treeCounter = 0;
const OVERSCAN = 8;
const EDGE = 30;

function initialExpanded(ix: TreeIndex, ids: string[] | undefined, depth: number): Set<string> {
  const s = new Set<string>(ids || []);
  if (depth <= 0) return s;
  // top `depth` levels, breadth first - never more than a few thousand even on a huge tree
  let level: number[] = Array.from(ix.childList.subarray(ix.childStart[ix.n], ix.childStart[ix.n + 1]));
  for (let d = 0; d < depth && level.length && s.size < 5000; d++) {
    const next: number[] = [];
    for (const i of level) {
      if (!hasChildren(ix, i)) continue;
      s.add(ix.nodes[i].id);
      for (let c = ix.childStart[i]; c < ix.childStart[i + 1]; c++) next.push(ix.childList[c]);
    }
    level = next;
  }
  return s;
}

type Target = { kind: 'node'; row: number; idx: number; id: string; pos: DropPosition } | { kind: 'all' } | { kind: 'none' };
interface Hover { id: string; pos: DropPosition; valid: boolean }

const FolderTreeReusable = forwardRef<FolderTreeHandle, FolderTreeReusableProps>(function FolderTreeReusable(props, handleRef) {
  const {
    nodes, testID = 'folder-tree', title = 'Folders', showHeader = true, showToolbar = true, showSearch = true, toolbarHeight, searchHeight,
    rowHeight = 28, indent = 16, height, style, readOnly = false,
    showAllNode = false, allLabel = 'All items', showNoneNode = false, noneLabel = 'No folder',
    defaultExpandedIds, initialExpandDepth = 1, itemCounts, countMode = 'total', totalCount, noneCount,
    onCreate, onRename, onDelete, onMove, onRefresh, newFolderTitle = 'New folder', newId = localNodeId, confirmDelete = true, deleteHint,
    maxDuplicateNodes = 2000, extraMenuItems, dragEnabled = true, onDropItems, acceptItemKinds = ['items'], dragGhost = true, hoverExpandMs = 700,
    onMessage, emptyText,
  } = props;
  const { themeColors: c } = useDesignSystem();
  const treeId = useRef(`tree_${++treeCounter}`).current;
  const index = useMemo(() => props.index ?? buildTreeIndex(nodes), [props.index, nodes]);
  const canCreate = !readOnly && !!onCreate;
  const canRename = !readOnly && !!onRename;
  const canDelete = !readOnly && !!onDelete;
  const canMove = !readOnly && !!onMove;
  const canDrag = canMove && dragEnabled;
  const ux = props.uxuiFolders;
  const alwaysFullHeight = ux?.alwaysFullHeight !== false;
  const doubleClick = ux?.doubleClickOnBranch ?? 'toggleOpenClose';
  const commandsInMainFab = ux?.commandsInMainFab !== false;

  // ---- full screen height: from the top edge of the tree to the bottom of the window ----
  const win = useWindowDimensions();
  const [topEdge, setTopEdge] = useState<number | null>(null);
  const measureTop = useCallback(() => measureViewRect(rootRef.current, (r) => { if (r) setTopEdge((p) => (p !== null && Math.abs(p - r.top) < 1 ? p : r.top)); }), []);
  const fullHeight = height === undefined && alwaysFullHeight && topEdge !== null
    ? Math.max(ux?.fullHeightMin ?? 260, Math.round(win.height - topEdge - (ux?.fullHeightBottomOffset ?? 16)))
    : undefined;
  useEffect(() => { measureTop(); }, [win.height, measureTop]);

  const rootRef = useRef<any>(null);

  // ---------------- state ----------------
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded(index, defaultExpandedIds, initialExpandDepth));
  const [innerSelected, setInnerSelected] = useState<string | null>(props.defaultSelectedId ?? (showAllNode ? TREE_ALL_ID : null));
  const selectedId = props.selectedId !== undefined ? props.selectedId : innerSelected;
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [toolsMenu, setToolsMenu] = useState<{ x: number; y: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; ids: string[] } | null>(null);
  const dragging = useFolderDragActive();

  // search (debounced: typing in a 200k tree stays smooth)
  useEffect(() => { const t = setTimeout(() => setSearchText(query), query ? 160 : 0); return () => clearTimeout(t); }, [query]);
  const search = useMemo(() => (searchText.trim() ? buildSearchMask(index, searchText) : null), [index, searchText]);

  const flat: FlatRows = useMemo(() => flattenTree(index, { expanded, mask: search?.mask ?? null }), [index, expanded, search]);
  const totals = useMemo(() => (itemCounts && countMode === 'total' ? computeSubtreeTotals(index, itemCounts) : null), [index, itemCounts, countMode]);
  const directCount = useCallback((id: string) => (itemCounts instanceof Map ? itemCounts.get(id) : (itemCounts as Record<string, number> | undefined)?.[id]) ?? 0, [itemCounts]);

  // live copies for callbacks that must stay stable while the rows scroll
  const live = useRef({ index, flat, expanded, selectedId, search, nodes });
  live.current = { index, flat, expanded, selectedId, search, nodes };

  const select = useCallback((id: string) => {
    if (props.selectedId === undefined) setInnerSelected(id);
    props.onSelect?.(id, live.current.index.idToIdx.has(id) ? live.current.index.nodes[live.current.index.idToIdx.get(id) as number] : undefined);
  }, [props.selectedId, props.onSelect]);

  // ---------------- window (virtualization) ----------------
  const scrollRef = useRef<ScrollView>(null);
  const scrollTop = useRef(0);
  const [viewH, setViewH] = useState(360);
  const [firstRow, setFirstRow] = useState(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    scrollTop.current = y;
    const f = Math.floor(y / rowHeight);
    setFirstRow((p) => (p === f ? p : f));
  }, [rowHeight]);
  const scrollToRow = useCallback((row: number, center = false) => {
    const top = row * rowHeight;
    const cur = scrollTop.current;
    let y = cur;
    if (center) y = top - viewH / 2 + rowHeight / 2;
    else if (top < cur) y = top;
    else if (top + rowHeight > cur + viewH) y = top + rowHeight - viewH;
    y = Math.max(0, y);
    if (y !== cur) { scrollTop.current = y; scrollRef.current?.scrollTo({ y, animated: false }); setFirstRow(Math.floor(y / rowHeight)); }
  }, [rowHeight, viewH]);
  const rowOf = useCallback((idx: number): number => {
    const a = live.current.flat.idx;
    for (let r = 0; r < a.length; r++) if (a[r] === idx) return r;
    return -1;
  }, []);

  // a dragged row stays mounted (a touch is lost when its view unmounts)
  const [dragRow, setDragRow] = useState(-1);
  useEffect(() => { if (!dragging) setDragRow(-1); }, [dragging]);

  // ---------------- expand / collapse ----------------
  const toggle = useCallback((id: string) => {
    setExpanded((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  }, []);
  const expandIds = useCallback((ids: string[]) => setExpanded((prev) => { const s = new Set(prev); ids.forEach((i) => s.add(i)); return s; }), []);
  const expandAll = useCallback(() => {
    // every folder that has children (a 200k tree: ~50k ids - still instant)
    const ix = live.current.index;
    const s = new Set<string>();
    for (let i = 0; i < ix.n; i++) if (ix.childStart[i + 1] > ix.childStart[i]) s.add(ix.nodes[i].id);
    setExpanded(s);
  }, []);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);
  const expandBelow = useCallback((id: string, open: boolean) => {
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    if (i === undefined) return;
    const below = subtreeOf(ix, i).filter((k) => hasChildren(ix, k)).map((k) => ix.nodes[k].id);
    setExpanded((prev) => { const s = new Set(prev); below.forEach((b) => (open ? s.add(b) : s.delete(b))); return s; });
  }, []);

  // ---------------- reveal / pending (a folder that is about to appear) ----------------
  const pending = useRef<{ id: string; select: boolean; edit: boolean } | null>(null);
  const [pendingTick, setPendingTick] = useState(0);
  const clearSearch = useCallback(() => { setQuery(''); setSearchText(''); }, []);
  const reveal = useCallback((id: string, opts: { select?: boolean; edit?: boolean } = { select: true }) => {
    pending.current = { id, select: !!opts.select, edit: !!opts.edit };
    if (live.current.search) clearSearch();
    setPendingTick((t) => t + 1);
  }, [clearSearch]);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    const i = index.idToIdx.get(p.id);
    if (i === undefined) return; // not there yet: the caller's data arrives later
    if (search) return; // the search was cleared; wait for the next flatten
    const missing = ancestorsOf(index, i).map((a) => index.nodes[a].id).filter((a) => !expanded.has(a));
    if (missing.length) { expandIds(missing); return; }
    const row = rowOf(i);
    if (row < 0) return;
    pending.current = null;
    scrollToRow(row, true);
    if (p.select) select(p.id);
    if (p.edit) setEditingId(p.id);
  }, [index, flat, expanded, search, pendingTick, expandIds, rowOf, scrollToRow, select]);

  // ---------------- CRUD ----------------
  const createFolder = useCallback((parentId: string | null, afterId?: string) => {
    if (!onCreate) return;
    const ix = live.current.index;
    const parentIdx = parentId == null ? ix.n : ix.idToIdx.get(parentId);
    if (parentIdx === undefined) return;
    const afterIdx = afterId ? ix.idToIdx.get(afterId) ?? -1 : -1;
    const plan = planCreate(ix, parentIdx, afterIdx);
    const node: NewNode = { id: newId(), parentId: plan.parentId, title: newFolderTitle, order: plan.order };
    if (parentId != null) expandIds([parentId]);
    onCreate(node);
    reveal(node.id, { select: true, edit: canRename });
  }, [onCreate, newId, newFolderTitle, expandIds, reveal, canRename]);

  // web: the rename input leaves the page when it closes - give the keyboard back to the tree (arrows, F2, Delete)
  const refocus = useCallback(() => { if (Platform.OS === 'web') setTimeout(() => rootRef.current?.focus?.(), 0); }, []);
  const commitEdit = useCallback((id: string, value: string) => {
    setEditingId(null);
    refocus();
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    const next = value.trim();
    if (i === undefined || !next || next === ix.nodes[i].title) return;
    onRename?.(id, next, ix.nodes[i].title);
  }, [onRename, refocus]);
  const startEdit = useCallback((id: string) => { if (canRename) setEditingId(id); }, [canRename]);
  const cancelEdit = useCallback(() => { setEditingId(null); refocus(); }, [refocus]);

  const askDelete = useCallback((id: string) => {
    if (!onDelete) return;
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    if (i === undefined) return;
    const ids = subtreeIds(ix, i);
    if (confirmDelete) setPendingDelete({ id, ids }); else onDelete(ids, id);
  }, [onDelete, confirmDelete]);
  const doDelete = useCallback((id: string, ids: string[]) => {
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    const parentId = i === undefined || ix.parent[i] === ix.n ? null : ix.nodes[ix.parent[i]].id;
    onDelete?.(ids, id);
    // the selection leaves the deleted folders
    const sel = live.current.selectedId;
    if (sel && ids.includes(sel)) select(parentId ?? (showAllNode ? TREE_ALL_ID : ''));
  }, [onDelete, select, showAllNode]);

  const duplicate = useCallback((id: string) => {
    if (!onCreate) return;
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    if (i === undefined) return;
    const copy = planDuplicate(ix, i, newId, (t) => `${t} (copy)`, maxDuplicateNodes);
    if (!copy) { onMessage?.(`Too many folders to duplicate at once (more than ${maxDuplicateNodes}).`); return; }
    copy.forEach((n) => onCreate(n));
    reveal(copy[0].id, { select: true });
  }, [onCreate, newId, maxDuplicateNodes, onMessage, reveal]);

  const step = useCallback((id: string, direction: 1 | -1) => {
    if (!onMove) return;
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    if (i === undefined) return;
    const plan = planStep(ix, i, direction);
    if (plan?.ok) onMove({ id, parentId: plan.parentId, order: plan.order });
  }, [onMove]);

  // ---------------- drag & drop: this tree is a drop zone ----------------
  const scrollBoxRef = useRef<any>(null);
  const pinnedRef = useRef<any>(null);
  const rects = useRef<{ root: DropRect | null; scroll: DropRect | null; pinned: DropRect | null }>({ root: null, scroll: null, pinned: null });
  const measureAll = useCallback(() => {
    measureViewRect(rootRef.current, (r) => { rects.current.root = r; });
    measureViewRect(scrollBoxRef.current, (r) => { rects.current.scroll = r; });
    measureViewRect(pinnedRef.current, (r) => { rects.current.pinned = r; });
  }, []);
  const pinnedIds = useMemo(() => [...(showAllNode ? [TREE_ALL_ID] : []), ...(showNoneNode ? [TREE_NONE_ID] : [])], [showAllNode, showNoneNode]);

  const hoverTimer = useRef<any>(null);
  const hoverKey = useRef('');
  const auto = useRef({ speed: 0, timer: null as any, x: 0, y: 0, payload: null as FolderDragPayload | null });
  const stopAuto = useCallback(() => { if (auto.current.timer) clearInterval(auto.current.timer); auto.current.timer = null; auto.current.speed = 0; }, []);
  const clearHover = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null; hoverKey.current = '';
    setHover(null);
  }, []);

  /** the row / special row under the pointer, and where in it */
  const targetAt = useCallback((x: number, y: number, payload: FolderDragPayload): Target | null => {
    const { index: ix, flat: fl } = live.current;
    const pr = rects.current.pinned;
    const sr = rects.current.scroll;
    const isFolder = payload.kind === 'folder';
    if (pr && x >= pr.left && x <= pr.left + pr.width && y >= pr.top && y <= pr.top + pr.height) {
      const id = pinnedIds[Math.min(pinnedIds.length - 1, Math.max(0, Math.floor((y - pr.top) / rowHeight)))];
      if (id === TREE_ALL_ID) return isFolder ? { kind: 'all' } : null;
      return isFolder ? null : { kind: 'none' };
    }
    if (!sr || x < sr.left || x > sr.left + sr.width || y < sr.top || y > sr.top + sr.height) return null;
    const rel = y - sr.top + scrollTop.current;
    const row = Math.floor(rel / rowHeight);
    if (row < 0 || row >= fl.length) return null;
    const idx = fl.idx[row];
    const pos: DropPosition = isFolder ? dropPositionAt(rel - row * rowHeight, rowHeight, true, true) : 'inside';
    return { kind: 'node', row, idx, id: ix.nodes[idx].id, pos };
  }, [pinnedIds, rowHeight]);

  const evaluate = useCallback((t: Target, payload: FolderDragPayload): { hover: Hover | null; plan?: { parentId: string | null; order: number } } => {
    const ix = live.current.index;
    if (payload.kind !== 'folder') return t.kind === 'node' ? { hover: { id: t.id, pos: 'inside', valid: true } } : { hover: { id: TREE_NONE_ID, pos: 'inside', valid: true } };
    const moving = ix.idToIdx.get(payload.ids[0]);
    if (moving === undefined) return { hover: null };
    if (t.kind === 'all') {
      // already the last top level folder = nothing to do
      const already = ix.parent[moving] === ix.n && ix.childList[ix.childStart[ix.n + 1] - 1] === moving;
      return { hover: { id: TREE_ALL_ID, pos: 'inside', valid: !already }, plan: already ? undefined : { parentId: null, order: orderForAppend(ix, ix.n, moving) } };
    }
    if (t.kind !== 'node') return { hover: null };
    const open = live.current.expanded.has(t.id);
    const plan = planMove(ix, moving, t.idx, t.pos, { targetExpanded: open });
    return { hover: { id: t.id, pos: t.pos, valid: plan.ok }, plan: plan.ok ? { parentId: plan.parentId, order: plan.order } : undefined };
  }, []);

  const hoverAt = useCallback((x: number, y: number, payload: FolderDragPayload) => {
    // web: getBoundingClientRect is synchronous - the page may have scrolled since the last layout
    if (Platform.OS === 'web') measureAll();
    auto.current.x = x; auto.current.y = y; auto.current.payload = payload;
    const t = targetAt(x, y, payload);
    const { hover: h } = t ? evaluate(t, payload) : { hover: null };
    const key = h ? `${h.id}|${h.pos}|${h.valid}` : '';
    if (key !== hoverKey.current) {
      hoverKey.current = key;
      setHover(h);
      if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
      // hover over a closed folder: open it
      if (h && h.valid && h.pos === 'inside' && hoverExpandMs > 0 && t?.kind === 'node') {
        const ix = live.current.index;
        if (hasChildren(ix, t.idx) && !live.current.expanded.has(t.id)) hoverTimer.current = setTimeout(() => expandIds([t.id]), hoverExpandMs);
      }
    }
    // near the top / bottom edge of the list: scroll
    const sr = rects.current.scroll;
    let speed = 0;
    if (sr) {
      if (y < sr.top + EDGE) speed = -Math.ceil(((sr.top + EDGE - y) / EDGE) * 18);
      else if (y > sr.top + sr.height - EDGE) speed = Math.ceil(((y - (sr.top + sr.height - EDGE)) / EDGE) * 18);
    }
    auto.current.speed = speed;
    if (speed !== 0 && !auto.current.timer) {
      auto.current.timer = setInterval(() => {
        const max = Math.max(0, live.current.flat.length * rowHeight - viewHRef.current);
        const next = Math.max(0, Math.min(max, scrollTop.current + auto.current.speed));
        if (next !== scrollTop.current) {
          scrollTop.current = next;
          scrollRef.current?.scrollTo({ y: next, animated: false });
          setFirstRow(Math.floor(next / rowHeight));
          if (auto.current.payload) hoverAtRef.current(auto.current.x, auto.current.y, auto.current.payload);
        }
        if (auto.current.speed === 0) stopAuto();
      }, 30);
    } else if (speed === 0) stopAuto();
  }, [targetAt, evaluate, hoverExpandMs, expandIds, rowHeight, stopAuto, measureAll]);
  const hoverAtRef = useRef(hoverAt);
  hoverAtRef.current = hoverAt;
  const viewHRef = useRef(viewH);
  viewHRef.current = viewH;

  const drop = useCallback((x: number, y: number, payload: FolderDragPayload): boolean => {
    if (Platform.OS === 'web') measureAll();
    stopAuto();
    clearHover();
    const t = targetAt(x, y, payload);
    if (!t) return false;
    if (payload.kind === 'folder') {
      const { plan, hover: h } = evaluate(t, payload);
      if (!plan) {
        if (h && !h.valid && t.kind === 'node') {
          const ix = live.current.index;
          const moving = ix.idToIdx.get(payload.ids[0]);
          if (moving !== undefined && planMove(ix, moving, t.idx, t.pos).reason === 'inside-itself') onMessage?.('A folder cannot be moved into itself.');
        }
        return true;
      }
      onMove?.({ id: payload.ids[0], parentId: plan.parentId, order: plan.order });
      if (plan.parentId) expandIds([plan.parentId]);
      return true;
    }
    if (!onDropItems) return false;
    onDropItems(t.kind === 'node' ? t.id : null, payload);
    return true;
  }, [stopAuto, clearHover, targetAt, evaluate, onMove, onMessage, expandIds, onDropItems, measureAll]);

  const dropHandlers = useRef({ hoverAt, drop, clearHover, stopAuto });
  dropHandlers.current = { hoverAt, drop, clearHover, stopAuto };
  const acceptKey = acceptItemKinds.join('|');
  useEffect(() => registerDropZone({
    id: treeId,
    getRect: () => { if (Platform.OS === 'web') measureAll(); return rects.current.root; },
    accepts: (p) => (p.kind === 'folder' ? canMove && p.source === treeId : !!onDropItems && acceptKey.split('|').includes(p.kind)),
    onMove: (x, y, p) => dropHandlers.current.hoverAt(x, y, p),
    onLeave: () => { dropHandlers.current.stopAuto(); dropHandlers.current.clearHover(); },
    onDrop: (x, y, p) => dropHandlers.current.drop(x, y, p),
    refresh: measureAll,
  }), [treeId, canMove, onDropItems, acceptKey, measureAll]);
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); if (auto.current.timer) clearInterval(auto.current.timer); }, []);

  const dragPayload = useCallback((id: string): FolderDragPayload | null => {
    const ix = live.current.index;
    const i = ix.idToIdx.get(id);
    if (i === undefined) return null;
    const row = rowOf(i);
    if (row >= 0) setDragRow(row);
    return { kind: 'folder', ids: [id], label: ix.nodes[i].title, source: treeId };
  }, [treeId, rowOf]);

  // ---------------- menu ----------------
  const openMenu = useCallback((id: string, x: number, y: number) => {
    select(id);
    setMenu({ id, x, y });
  }, [select]);

  const selectedNodeIdx = selectedId != null ? index.idToIdx.get(selectedId) : undefined;
  const selectedNode = selectedNodeIdx !== undefined ? index.nodes[selectedNodeIdx] : undefined;

  const menuItems = (id: string): PMMenuItemProps[] => {
    const i = index.idToIdx.get(id);
    if (i === undefined) return [];
    const node = index.nodes[i];
    // the menu is a Modal: it gives the focus back to the page while it closes, which would end an inline rename that started
    // at the same moment. So every command runs after the menu has gone.
    const close = () => setMenu(null);
    const later = (fn: () => void) => () => { close(); setTimeout(fn, 250); };
    const t = `${testID}-menu`;
    const kids = hasChildren(index, i);
    const items: PMMenuItemProps[] = [];
    if (canCreate) {
      items.push({ testID: `${t}-new-sub`, label: 'New subfolder', icon: 'create_new_folder', onPress: later(() => createFolder(id)) });
      items.push({ testID: `${t}-new-same`, label: 'New folder below', icon: 'add', onPress: later(() => createFolder(index.parent[i] === index.n ? null : index.nodes[index.parent[i]].id, id)) });
    }
    if (canRename) items.push({ testID: `${t}-rename`, label: 'Rename', icon: 'edit', onPress: later(() => startEdit(id)) });
    if (canCreate) items.push({ testID: `${t}-duplicate`, label: kids ? 'Duplicate with subfolders' : 'Duplicate', icon: 'content_copy', onPress: later(() => duplicate(id)) });
    if (canMove) {
      items.push({ testID: `${t}-up`, label: 'Move up', icon: 'arrow_upward', disabled: !planStep(index, i, -1)?.ok, onPress: later(() => step(id, -1)) });
      items.push({ testID: `${t}-down`, label: 'Move down', icon: 'arrow_downward', disabled: !planStep(index, i, 1)?.ok, onPress: later(() => step(id, 1)) });
    }
    if (kids) {
      items.push({ testID: `${t}-expand`, label: 'Expand all below', icon: 'unfold_more', onPress: later(() => expandBelow(id, true)) });
      items.push({ testID: `${t}-collapse`, label: 'Collapse all below', icon: 'unfold_less', onPress: later(() => expandBelow(id, false)) });
    }
    if (extraMenuItems) items.push(...extraMenuItems(node, close));
    if (canDelete) items.push({ testID: `${t}-delete`, label: 'Delete', icon: 'delete', danger: true, onPress: later(() => askDelete(id)) });
    return items;
  };
  const menuEnabled = canCreate || canRename || canMove || canDelete || !!extraMenuItems;

  // ---------------- main FAB: the same commands as the context menu, for the selected folder ----------------
  const fabActions = useMemo<FABContextAction[] | null>(() => {
    if (!commandsInMainFab) return null;
    const out: FABContextAction[] = [];
    const add = (icon: string, label: string, onPress: () => void, color?: string) => out.push({ icon, label, onPress, color, testID: `${testID}-fab-${icon}` });
    if (canCreate) add('folder-plus-outline', 'New top level folder', () => createFolder(null));
    if (selectedNode) {
      const i = selectedNodeIdx as number;
      const kids = hasChildren(index, i);
      if (canCreate) {
        add('folder-plus', `New subfolder in "${selectedNode.title}"`, () => createFolder(selectedNode.id));
        add('plus', 'New folder below', () => createFolder(index.parent[i] === index.n ? null : index.nodes[index.parent[i]].id, selectedNode.id));
      }
      if (canRename) add('pencil-outline', `Rename "${selectedNode.title}"`, () => startEdit(selectedNode.id));
      if (canCreate) add('content-copy', kids ? 'Duplicate with subfolders' : 'Duplicate', () => duplicate(selectedNode.id));
      if (canMove && planStep(index, i, -1)?.ok) add('arrow-up', 'Move up', () => step(selectedNode.id, -1));
      if (canMove && planStep(index, i, 1)?.ok) add('arrow-down', 'Move down', () => step(selectedNode.id, 1));
      if (kids) {
        add('unfold-more-horizontal', 'Expand all below', () => expandBelow(selectedNode.id, true));
        add('unfold-less-horizontal', 'Collapse all below', () => expandBelow(selectedNode.id, false));
      }
      if (extraMenuItems) for (const m of extraMenuItems(selectedNode, () => {})) if (!m.disabled && !m.submenu) add(String(m.icon).replace(/_/g, '-'), m.label, m.onPress, m.danger ? c.error : undefined);
      if (canDelete) add('delete-outline', `Delete "${selectedNode.title}"`, () => askDelete(selectedNode.id), c.error);
    }
    add('unfold-more-horizontal', 'Expand all folders', expandAll);
    add('unfold-less-horizontal', 'Collapse all folders', collapseAll);
    if (onRefresh) add('refresh', 'Refresh folders', onRefresh);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandsInMainFab, canCreate, canRename, canMove, canDelete, index, selectedNode, selectedNodeIdx, extraMenuItems, onRefresh, createFolder, startEdit, duplicate, step, expandBelow, askDelete, expandAll, collapseAll, c.error, testID]);
  useFABContextActions(`folder-tree-${treeId}`, fabActions);

  // ---------------- keyboard (web) ----------------
  const onKeyDown = (e: any) => {
    const t = e?.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const fl = live.current.flat;
    const sel = selectedId != null ? index.idToIdx.get(selectedId) : undefined;
    const row = sel === undefined ? -1 : rowOf(sel);
    const go = (r: number) => { const rr = Math.max(0, Math.min(fl.length - 1, r)); if (fl.length) { select(index.nodes[fl.idx[rr]].id); scrollToRow(rr); } };
    const done = () => { e.preventDefault?.(); e.stopPropagation?.(); };
    switch (e.key) {
      case 'ArrowDown': done(); go(row < 0 ? 0 : row + 1); break;
      case 'ArrowUp': done(); go(row < 0 ? 0 : row - 1); break;
      case 'Home': done(); go(0); break;
      case 'End': done(); go(fl.length - 1); break;
      case 'ArrowRight':
        if (sel === undefined) break;
        done();
        if (hasChildren(index, sel) && !expanded.has(index.nodes[sel].id) && !search) toggle(index.nodes[sel].id);
        else if (row >= 0 && row + 1 < fl.length && index.parent[fl.idx[row + 1]] === sel) go(row + 1);
        break;
      case 'ArrowLeft':
        if (sel === undefined) break;
        done();
        if (hasChildren(index, sel) && expanded.has(index.nodes[sel].id) && !search) toggle(index.nodes[sel].id);
        else if (index.parent[sel] !== index.n) { const pr = rowOf(index.parent[sel]); if (pr >= 0) go(pr); }
        break;
      case 'F2': if (sel !== undefined && canRename) { done(); startEdit(index.nodes[sel].id); } break;
      case 'Delete': case 'Backspace': if (sel !== undefined && canDelete) { done(); askDelete(index.nodes[sel].id); } break;
      case 'Insert': if (canCreate) { done(); createFolder(selectedNode?.id ?? null); } break;
      case 'n': case 'N': if ((e.ctrlKey || e.metaKey) && canCreate) { done(); createFolder(selectedNode?.id ?? null); } break;
      case '*': if (sel !== undefined) { done(); expandBelow(index.nodes[sel].id, true); } break;
      case 'Enter': if (sel !== undefined) { done(); if (hasChildren(index, sel)) toggle(index.nodes[sel].id); else startEdit(index.nodes[sel].id); } break;
      default:
    }
  };

  useImperativeHandle(handleRef, () => ({
    expandAll, collapseAll,
    reveal: (id) => reveal(id, { select: true }),
    select,
    startCreate: (parentId) => createFolder(parentId ?? null),
    startRename: startEdit,
    scrollToNode: (id) => reveal(id, { select: false }),
  }), [expandAll, collapseAll, reveal, select, createFolder, startEdit]);

  // ---------------- render ----------------
  const len = flat.length;
  const from = Math.max(0, firstRow - OVERSCAN);
  const to = Math.min(len - 1, firstRow + Math.ceil(viewH / rowHeight) + OVERSCAN);
  const rowsToDraw: number[] = [];
  for (let r = from; r <= to; r++) rowsToDraw.push(r);
  if (dragRow >= 0 && dragRow < len && (dragRow < from || dragRow > to)) rowsToDraw.push(dragRow);

  const counts = (idx: number, id: string): number | null => (!itemCounts ? null : countMode === 'total' && totals ? totals[idx] : directCount(id));
  const dropStateOf = (id: string): RowDropState => (hover && hover.id === id ? (hover.valid ? hover.pos : 'denied') : null);

  const barH = toolbarHeight;
  const searchH = searchHeight;
  const lastPress = useRef({ x: 200, y: 80 });
  const toolButtons = (
    <View style={styles.tools} onStartShouldSetResponderCapture={(e: any) => { lastPress.current = { x: e?.nativeEvent?.pageX ?? 200, y: (e?.nativeEvent?.pageY ?? 66) + 14 }; return false; }}>
      {canCreate && <PMIconButton compact tipScope="app" testID={`${testID}-new-root`} icon="create_new_folder" title="New top level folder" color={c.primary} onPress={() => createFolder(null)} />}
      {canCreate && <PMIconButton compact tipScope="app" testID={`${testID}-new-sub`} icon="add" title="New subfolder of the selected folder" color={c.text} disabled={!selectedNode} onPress={() => selectedNode && createFolder(selectedNode.id)} />}
      {canRename && <PMIconButton compact tipScope="app" testID={`${testID}-rename`} icon="edit" title="Rename the selected folder (F2)" color={c.text} disabled={!selectedNode} onPress={() => selectedNode && startEdit(selectedNode.id)} />}
      {canDelete && <PMIconButton compact tipScope="app" testID={`${testID}-delete`} icon="delete" title="Delete the selected folder and its subfolders" color={c.error} disabled={!selectedNode} onPress={() => selectedNode && askDelete(selectedNode.id)} />}
      <PMIconButton compact tipScope="app" testID={`${testID}-more`} icon="more_vert" title="Expand, collapse, refresh" color={c.text}
        onPress={() => setToolsMenu({ ...lastPress.current })} />
    </View>
  );
  const toolsMenuItems: PMMenuItemProps[] = [
    { testID: `${testID}-expand-all`, label: 'Expand all', icon: 'unfold_more', onPress: () => { setToolsMenu(null); expandAll(); } },
    { testID: `${testID}-collapse-all`, label: 'Collapse all', icon: 'unfold_less', onPress: () => { setToolsMenu(null); collapseAll(); } },
    ...(selectedNode ? [{ testID: `${testID}-reveal`, label: 'Show the selected folder', icon: 'my_location', onPress: () => { setToolsMenu(null); reveal(selectedNode.id); } }] : []),
    ...(onRefresh ? [{ testID: `${testID}-refresh`, label: 'Refresh', icon: 'refresh', onPress: () => { setToolsMenu(null); onRefresh(); } }] : []),
  ];

  const deleteName = pendingDelete ? index.nodes[index.idToIdx.get(pendingDelete.id) ?? 0]?.title ?? '' : '';
  const specialRow = (id: string, label: string, top: number, count: number | null | undefined, icon: string) => (
    <FolderTreeRow key={id} id={id} testID={`${testID}-row-${id}`} title={label} top={top} height={rowHeight} depth={0} indent={indent} hasKids={false} open={false}
      selected={selectedId === id} special doubleClick={doubleClick} icon={icon} count={count ?? null} editing={false} dropState={dropStateOf(id)} dragEnabled={false} menuEnabled={false} level={1}
      onToggle={toggle} onPress={select} onMenu={openMenu} onCommitEdit={commitEdit} onCancelEdit={cancelEdit} onStartEdit={startEdit} dragPayload={dragPayload} />
  );

  return (
    <View
      ref={rootRef}
      testID={testID}
      onLayout={() => { measureAll(); measureTop(); }}
      {...(Platform.OS === 'web' ? ({ tabIndex: 0, onKeyDown, role: 'tree', 'aria-label': title } as any) : {})}
      style={[styles.root, { borderColor: c.border, backgroundColor: c.surface, height: (height ?? fullHeight ?? '100%') as any }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null, style]}
    >
      {showHeader && (
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <View style={[styles.bar, barH ? { height: barH } : { minHeight: 36 }]} testID={`${testID}-bar`}>
            <Text numberOfLines={1} testID={`${testID}-title`} style={[styles.title, { color: c.text }]}>{title}</Text>
            <Text testID={`${testID}-total`} style={[styles.small, { color: c.text }]}>{nodes.length.toLocaleString()}</Text>
            <View style={{ flex: 1 }} />
            {showToolbar && toolButtons}
          </View>
          {showSearch && (
            <View style={[styles.searchRow, searchH ? { height: searchH } : { height: 38 }]} testID={`${testID}-search-row`}>
              <IconApp name="search" size={15} color={c.text} />
              <TextInput testID={`${testID}-search`} value={query} onChangeText={setQuery} placeholder="Search folders…" placeholderTextColor={c.text + '88'}
                style={[styles.search, { color: c.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} autoCorrect={false} autoCapitalize="none" />
              {search && <Text testID={`${testID}-matches`} style={[styles.small, { color: c.text }]}>{search.matches.toLocaleString()}</Text>}
              {query.length > 0 && (
                <Pressable testID={`${testID}-search-clear`} hitSlop={8} onPress={clearSearch}><IconApp name="close" size={15} color={c.text} /></Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {pinnedIds.length > 0 && (
        <View ref={pinnedRef} onLayout={measureAll} style={{ height: pinnedIds.length * rowHeight, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }} testID={`${testID}-pinned`}>
          {pinnedIds.map((id, k) => (id === TREE_ALL_ID
            ? specialRow(id, allLabel, k * rowHeight, totalCount ?? null, 'inventory_2')
            : specialRow(id, noneLabel, k * rowHeight, noneCount ?? null, 'folder_off')))}
        </View>
      )}

      <View ref={scrollBoxRef} testID={`${testID}-list`} style={{ flex: 1, minHeight: 0 }} onLayout={(e) => { setViewH(e.nativeEvent.layout.height); measureAll(); }}>
        {len === 0 ? (
          <View style={styles.empty} testID={`${testID}-empty`}>
            <Text style={{ color: c.text, opacity: 0.6, textAlign: 'center' }}>
              {search ? 'No folders match.' : emptyText ?? (canCreate ? 'No folders yet. Press the folder button to create one.' : 'No folders.')}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            testID={`${testID}-scroll`}
            onScroll={onScroll}
            scrollEventThrottle={16}
            scrollEnabled={Platform.OS === 'web' || !dragging}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ height: len * rowHeight }}
            style={{ flex: 1 }}
          >
            {rowsToDraw.map((r) => {
              const idx = flat.idx[r];
              const node = index.nodes[idx];
              const kids = search ? hasMaskedChildren(index, idx, search.mask) : hasChildren(index, idx);
              const open = search ? kids : expanded.has(node.id);
              return (
                <FolderTreeRow
                  key={node.id}
                  id={node.id}
                  testID={`${testID}-row-${node.id}`}
                  title={node.title}
                  top={r * rowHeight}
                  height={rowHeight}
                  depth={flat.depth[r]}
                  indent={indent}
                  hasKids={kids}
                  open={open}
                  selected={selectedId === node.id}
                  doubleClick={doubleClick}
                  icon={node.icon}
                  color={node.color}
                  count={counts(idx, node.id)}
                  editing={editingId === node.id}
                  dropState={dropStateOf(node.id)}
                  dragEnabled={canDrag}
                  menuEnabled={menuEnabled}
                  level={flat.depth[r] + 1}
                  onToggle={toggle}
                  onPress={select}
                  onMenu={openMenu}
                  onCommitEdit={commitEdit}
                  onCancelEdit={cancelEdit}
                  onStartEdit={startEdit}
                  dragPayload={dragPayload}
                />
              );
            })}
          </ScrollView>
        )}
      </View>

      {menu && <PMContextMenu testID={`${testID}-context-menu`} x={menu.x} y={menu.y} caption={index.nodes[index.idToIdx.get(menu.id) ?? 0]?.title} items={menuItems(menu.id)} onClose={() => setMenu(null)} />}
      {toolsMenu && <PMContextMenu testID={`${testID}-tools-menu`} x={toolsMenu.x} y={toolsMenu.y} items={toolsMenuItems} onClose={() => setToolsMenu(null)} />}
      <AskBeforeDeletePostComponent
        testID={`${testID}-confirm-delete`}
        visible={!!pendingDelete}
        modatTopBar="Delete folder?"
        modalBody={pendingDelete ? `“${deleteName}”${pendingDelete.ids.length > 1 ? ` and ${(pendingDelete.ids.length - 1).toLocaleString()} subfolder${pendingDelete.ids.length === 2 ? '' : 's'}` : ''} will be deleted.${deleteHint ? ` ${deleteHint}` : ''}` : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) doDelete(pendingDelete.id, pendingDelete.ids); setPendingDelete(null); }}
      />
      {dragGhost && <FolderTreeDragGhost testID={`${testID}-ghost`} />}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  header: { borderBottomWidth: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 8, paddingRight: 2 },
  title: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  small: { fontSize: 11, opacity: 0.55 },
  tools: { flexDirection: 'row', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  search: { flex: 1, minWidth: 0, fontSize: 13, paddingVertical: 4 },
  empty: { padding: 20, alignItems: 'center' },
});

export default FolderTreeReusable;
export { FolderTreeReusable };
