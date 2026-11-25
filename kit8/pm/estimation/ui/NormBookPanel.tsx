// NormBookPanel - the norm books as a ReusableTable with a FOLDERS TREE (like the catalogs): the tree is World Norms (v2) -> continent -> country -> book -> the sections of the book; the table shows
// the sections and norms inside the picked folder with EVERY field of the row as a column (kind, code, title, original title, unit, base type, content, resources, NR / SP codes, language ...).
// A book has tens of thousands of rows: the tree of books is small (read whole), a book is NEVER read whole: the rows of the table are read a folder at a time (or by the search of the book) and the sections that come with them become the
// folders of the tree (picking a section, in the tree or by the Open section button of its row brings its subsections in), the translations only for the rows on the screen. "Add to the estimate" turns a norm into a position (unit costs from the priced resources of the
// same book + the labour rate typed here). The table is read only: the norm books change by the import.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import SwitchApp from '../../../ui/components/common/SwitchApp';
import SelectItemFromListApp from '../../../ui/components/common/SelectItemFromListApp';
import ReusableTable from '../../../ui/components/table/reusable/ReusableTable';
import { useEstimationTableColumns } from '../settings/useEstimationUserSettings';
import type { ReusableTableRow, VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { TREE_ALL_ID, type FolderTreeNode } from '../../../ui/components/tree/folderTreeModel';
import { pmT, usePMLanguage } from '../../i18n/pmT';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import IconLinkAction, { LINK_FONT_SIZE } from './IconLinkAction';
import { textWidthPx } from './textWidth';
import HistoryTextInput, { type HistoryTextInputHandle } from './HistoryTextInput';
import PMContextMenu from '../../inner/menu/PMContextMenu';
import { useSearchHistory } from '../../../ui/components/table/reusable/useSearchHistory';
import { normToUnitCosts, type PricedResource } from '../model/normCosting';
import { buildNormTree, nodePath, type NormTreeNode } from '../model/normBookModel';
import { DEFAULT_NORM_SEARCH_MODE, NormSearchTimeoutError, NORM_SEARCH_MIN_CHARS, readNormBookTree, readNormChildren, readNormLocation, readNormTitles, readPricedResources, searchNorms, type NormRow, type NormSearchMode } from './normBookApi';

/** the money fields of a norm (per unit of work) the two borders can filter; Direct cost is the default */
export type NormFilterField = 'unitDirect' | 'unitLabour' | 'unitMachines' | 'unitOperators' | 'unitMaterials' | 'unitEquipment';
export const NORM_FILTER_FIELDS: { key: NormFilterField; title: string }[] = [
  { key: 'unitDirect', title: 'Direct cost / unit' }, { key: 'unitLabour', title: 'Labour / unit' }, { key: 'unitMachines', title: 'Machines / unit' },
  { key: 'unitOperators', title: 'of which operators' }, { key: 'unitMaterials', title: 'Materials / unit' }, { key: 'unitEquipment', title: 'Equipment / unit' },
];
export const DEFAULT_NORM_FILTER_FIELD: NormFilterField = 'unitDirect';

/** one entry of the history of pairs: the field and the two borders (kept as a text in the history list of the device) */
export interface NormFilterPair { field: NormFilterField; from: string; to: string }
export const encodeNormPair = (p: NormFilterPair): string => JSON.stringify({ f: p.field, a: p.from.trim(), b: p.to.trim() });
export function decodeNormPair(text: string): NormFilterPair | null {
  try {
    const j = JSON.parse(text);
    if (!NORM_FILTER_FIELDS.some((f) => f.key === j?.f)) return null;
    return { field: j.f, from: String(j.a ?? ''), to: String(j.b ?? '') };
  } catch { return null; }
}
/** "Direct cost / unit: 100 … 500" (an open border stays empty) */
export const normPairLabel = (p: NormFilterPair, t: (s: string) => string): string => `${t(NORM_FILTER_FIELDS.find((f) => f.key === p.field)!.title)}: ${p.from} … ${p.to}`.trim();

/** the World Norms panel (the folders tree) beside the table: its width and the gap to the table. The bar above starts its search where the TABLE starts (a left block as wide as the panel) */
export const NORM_TREE_WIDTH = 300;
/** a container narrower than this puts the tree ABOVE the table (ReusableTable foldersTreeStackBelowWidth default): no left block then */
export const NORM_TREE_STACK_BELOW = 720;

export interface NormBookPanelProps {
  client: any;
  canManage: boolean;
  /** a norm was chosen to be a position of the open estimate (null = no open estimate) */
  onAddNorm: ((norm: NormRow, costs: ReturnType<typeof normToUnitCosts>, title: string, bookTitle: string) => void) | null;
  onImport: () => void;
  onExport: (bookGUID: string) => void;
  /** the picker of a position (SelectNormWindow): no import / export buttons and the row button reads "Select" */
  pickMode?: boolean;
  /** the picker of a position that already has a norm: the window STARTS at that norm (its book, its section opened, its row marked); a norm that cannot be found = the usual start */
  startAt?: { normGUID?: string | null; code?: string | null } | null;
  /** bump to read the tree again (after an import) */
  version?: number;
  testID?: string;
}

/** the folder nodes of the tree of books (world .. book) */
function treeNodes(tree: NormTreeNode | null): FolderTreeNode[] {
  const out: FolderTreeNode[] = [];
  const walk = (n: NormTreeNode, parent: string | null) => {
    const j = n.row.rowJSON;
    const icon = j.nodeKind === 'book' ? 'menu_book' : j.nodeKind === 'country' ? 'flag' : j.nodeKind === 'continent' ? 'public' : 'language';
    out.push({ id: n.row.rowGUID, parentId: parent, title: String(j.title ?? n.row.rowGUID), order: Number(n.row.orderInList) || 0, icon });
    n.children.forEach((k) => walk(k, n.row.rowGUID));
  };
  if (tree) walk(tree, null);
  return out;
}

// a norm book has no labour rate and the search bar has no field for it (removed 2026-11-25): the labour money of a norm is 0 here, the labour is priced in the estimate
const LABOUR_RATE = 0;
const resourcesText = (resources: any): string => (Array.isArray(resources) ? resources.map((r: any) => `${r.code}${r.qty !== undefined ? ` × ${r.qty}` : ''}`).join('; ') : '');

export default function NormBookPanel({ client, canManage, onAddNorm, onImport, onExport, pickMode = false, startAt = null, version = 0, testID = 'estimation-norm-books' }: NormBookPanelProps) {
  const normColumns = useEstimationTableColumns(null, pickMode ? 'normBooksPicker' : 'normBooks');
  const { themeColors: c } = useDesignSystem();
  const language = usePMLanguage();
  const [tree, setTree] = useState<NormTreeNode | null>(null);
  const [rowsAll, setRowsAll] = useState<any[]>([]);
  // the sections met so far (the folders of the tree): a book is NEVER read whole - a section brings its own subsections in when it is picked
  const [sections, setSections] = useState<NormRow[]>([]);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string>(TREE_ALL_ID);
  const [items, setItems] = useState<NormRow[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  // the last search substrings (newest first, on the device): the clock icon inside the search field opens them; a typed text goes there when the user leaves the field, presses Enter or selects a norm
  const searchRef = useRef<HistoryTextInputHandle>(null);
  // the history of PAIRS (field + from + to): the clock inside "Filter by" opens it; a pick sets the field and both borders. A pair is kept when the user leaves From or To
  const pairHistory = useSearchHistory('estimationNormFilterPairs');
  const rememberPair = pairHistory.remember; // stable
  const pairRef = useRef({ field: DEFAULT_NORM_FILTER_FIELD as NormFilterField, from: '', to: '' });
  const [pairMenu, setPairMenu] = useState<{ x: number; y: number } | null>(null);
  const pairPress = useRef({ x: 0, y: 0 });
  // the table + the tree are as high as the window (ReusableTable alwaysFullHeight) - but this panel sits in a WINDOW with the Close button under it: the room kept free below the table is measured
  // (the distance from the bottom edge of the table space to the bottom of the screen), so the table ends where its space ends
  const win = useWindowDimensions();
  // the width of this panel: wide = the tree stands LEFT of the table and the bar keeps a left block as wide as the tree
  const [panelW, setPanelW] = useState(0);
  const treeBeside = panelW >= NORM_TREE_STACK_BELOW;
  const spaceRef = useRef<View>(null);
  const [bottomOffset, setBottomOffset] = useState(16);
  const measureSpace = useCallback(() => {
    spaceRef.current?.measureInWindow?.((_x, y, _w, h) => {
      if (Number.isFinite(y) && Number.isFinite(h) && h > 0) setBottomOffset(Math.max(0, Math.round(win.height - (y + h))));
    });
  }, [win.height]);
  useEffect(() => { measureSpace(); }, [measureSpace, win.width]);
  // where the text must stand in the code / title: Start (default) | Contains | Finished
  const [searchMode, setSearchMode] = useState<NormSearchMode>(DEFAULT_NORM_SEARCH_MODE);
  // a search runs in the picked book; with the switch on (and always while no book is picked) it runs in ALL the norm books
  const [searchAll, setSearchAll] = useState(false);
  // the filter by the labour cost of a unit of work (hours x the labour rate above): empty = no border; norms only, sections stay so the folders can still be opened
  const [labourFrom, setLabourFrom] = useState('');
  const [labourTo, setLabourTo] = useState('');
  // WHICH numeric field the two borders filter (before them in the bar): Direct cost per unit by default
  const [filterField, setFilterField] = useState<NormFilterField>(DEFAULT_NORM_FILTER_FIELD);
  pairRef.current = { field: filterField, from: labourFrom, to: labourTo };
  const keepPair = useCallback(() => { const p = pairRef.current; if (p.from.trim() || p.to.trim()) rememberPair(encodeNormPair(p)); }, [rememberPair]);
  // the priced resources of the norms on the screen (what a norm costs per unit of work = its resources x the prices of the same book)
  const [priced, setPriced] = useState<Map<string, Map<string, PricedResource>>>(new Map());

  useEffect(() => {
    let alive = true;
    readNormBookTree(client).then((rows) => { if (alive) { setRowsAll(rows); setTree(buildNormTree(rows)); } }).catch((e) => alive && setError(String(e?.message ?? e)));
    return () => { alive = false; };
  }, [client, version]);

  const bookGUIDs = useMemo(() => new Set(rowsAll.filter((r) => r.rowJSON?.nodeKind === 'book').map((r) => r.rowGUID as string)), [rowsAll]);
  // the book of the picked folder: the book itself, or the book whose sections were read last
  const [bookGUID, setBookGUID] = useState<string | null>(null);
  const sectionIds = useMemo(() => new Set(sections.map((s) => s.rowGUID)), [sections]);

  useEffect(() => {
    if (bookGUIDs.has(picked)) { if (picked !== bookGUID) { setBookGUID(picked); setQuery(''); } }
    else if (!sectionIds.has(picked)) { if (picked === TREE_ALL_ID || !bookGUID || !bookGUIDs.has(bookGUID)) { /* a folder above the books: no book */ } }
  }, [picked, bookGUIDs, sectionIds, bookGUID]);

  // a folder above the books (world, continent, country) shows no rows
  const pickedIsBookFolder = bookGUIDs.has(picked) || sectionIds.has(picked);
  // the sections of the book the picker was told to start in are waiting here for the change of the book (which empties the list of sections)
  const pendingSections = useRef<NormRow[] | null>(null);
  useEffect(() => { setSections(pendingSections.current ?? []); pendingSections.current = null; }, [bookGUID]);
  // the norm the window started at: its row is marked and scrolled into view
  const [startNorm, setStartNorm] = useState<NormRow | null>(null);
  const startKey = startAt ? `${startAt.normGUID ?? ''}|${startAt.code ?? ''}` : '';
  useEffect(() => {
    if (!startAt || (!startAt.normGUID && !startAt.code)) return;
    let alive = true;
    readNormLocation(client, startAt).then((loc) => {
      if (!alive || !loc) return;
      const { norm, sections: above } = loc;
      const inBook = norm.rowOwnerGUID;
      setQuery('');
      setStartNorm(norm);
      if (inBook === bookGUID) setSections((prev) => { const have = new Set(prev.map((x) => x.rowGUID)); return [...prev, ...above.filter((x) => !have.has(x.rowGUID))]; });
      else { pendingSections.current = above; setBookGUID(inBook); }
      setPicked(above.length ? above[above.length - 1].rowGUID : inBook);
    }).catch(() => undefined); // not found / not readable: the window simply starts as usual
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, startKey]);

  const book = useMemo(() => rowsAll.find((r) => r.rowGUID === bookGUID) ?? null, [rowsAll, bookGUID]);
  const parentGUID = bookGUID && picked === bookGUID ? 'empty' : picked;
  const searching = query.trim().length >= NORM_SEARCH_MIN_CHARS;
  const globalSearch = searching && (!bookGUID || searchAll);

  const load = useCallback(async () => {
    if (!searching && (!bookGUID || !pickedIsBookFolder)) { setItems([]); return; }
    setLoading(true);
    setError('');
    try {
      let rows = searching ? await searchNorms(client, globalSearch ? null : bookGUID, query, 60, searchMode) : await readNormChildren(client, bookGUID!, parentGUID);
      // the norm the window started at must be among the rows of its own folder, also when the folder has more rows than one page
      if (!searching && startNorm && startNorm.rowOwnerGUID === bookGUID && (startNorm.rowParentGUID === 'empty' ? 'empty' : startNorm.rowParentGUID) === parentGUID && !rows.some((r) => r.rowGUID === startNorm.rowGUID)) rows = [...rows, startNorm];
      setItems(rows);
      if (!searching) {
        const found = rows.filter((r) => r.rowJSON.nodeKind === 'section');
        if (found.length) setSections((prev) => { const have = new Set(prev.map((x) => x.rowGUID)); const add = found.filter((x) => !have.has(x.rowGUID)); return add.length ? [...prev, ...add] : prev; });
      }
      setTitles(await readNormTitles(client, rows.map((r) => r.rowGUID), language));
    } catch (e: any) { setError(e instanceof NormSearchTimeoutError ? pmT(e.message) : String(e?.message ?? e)); setItems([]); }
    setLoading(false);
  }, [client, bookGUID, parentGUID, query, searchMode, searching, globalSearch, language, pickedIsBookFolder, startNorm]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, query ? 350 : 0); return () => clearTimeout(t); }, [load, query]);

  useEffect(() => {
    // the priced resources per BOOK (a search over all books brings norms of several books: each is priced by its own book)
    let alive = true;
    const codesOf = new Map<string, string[]>();
    for (const r of items) if (r.rowJSON.nodeKind === 'norm' && Array.isArray(r.rowJSON.resources)) { const l = codesOf.get(r.rowOwnerGUID) ?? []; for (const x of r.rowJSON.resources) l.push(String(x.code)); codesOf.set(r.rowOwnerGUID, l); }
    if (!codesOf.size) { setPriced(new Map()); return () => { alive = false; }; }
    Promise.all([...codesOf].map(async ([book, codes]) => [book, await readPricedResources(client, book, codes)] as const))
      .then((list) => { if (alive) setPriced(new Map(list)); }).catch(() => { if (alive) setPriced(new Map()); });
    return () => { alive = false; };
  }, [client, items]);

  const titleOf = useCallback((r: NormRow) => titles.get(r.rowGUID) || String(r.rowJSON.title ?? r.rowGUID), [titles]);

  const add = useCallback(async (n: NormRow) => {
    if (!onAddNorm) return;
    searchRef.current?.remember();
    try {
      const resources = (n.rowJSON.resources ?? []) as { code: string; qty: number }[];
      const priced = await readPricedResources(client, n.rowOwnerGUID, resources.map((r) => r.code));
      const ownBook = rowsAll.find((r) => r.rowGUID === n.rowOwnerGUID);
      onAddNorm(n, normToUnitCosts(resources, priced, { labourRate: LABOUR_RATE }), titleOf(n), String(ownBook?.rowJSON.title ?? ''));
    } catch (e: any) { setError(String(e?.message ?? e)); }
  }, [client, rowsAll, onAddNorm, titleOf]);

  const nodes = useMemo<FolderTreeNode[]>(() => {
    const base = treeNodes(tree);
    if (!bookGUID) return base;
    const sec: FolderTreeNode[] = sections.map((s) => ({ id: s.rowGUID, parentId: s.rowParentGUID === 'empty' ? bookGUID : s.rowParentGUID, title: `${s.rowJSON.code ? `${s.rowJSON.code}  ` : ''}${s.rowJSON.title ?? s.rowGUID}`, order: Number(s.orderInList) || 0 }));
    return [...base, ...sec];
  }, [tree, sections, bookGUID]);

  // every field of the row is a key of rowJSON (the ones made from lists are added here)
  const rate = LABOUR_RATE;
  const borderOf = (t: string): number | null => { const n = Number(t.replace(',', '.')); return t.trim() !== '' && Number.isFinite(n) ? n : null; };
  const from = borderOf(labourFrom);
  const to = borderOf(labourTo);
  const rows = useMemo<ReusableTableRow[]>(() => items.map((r) => {
    // the money of a norm per unit of work; empty for a section and until the prices of the book are read
    const bookPriced = priced.get(r.rowOwnerGUID);
    const k = r.rowJSON.nodeKind === 'norm' && bookPriced?.size ? normToUnitCosts((r.rowJSON.resources ?? []) as any[], bookPriced, { labourRate: rate }) : null;
    const money = k ? { unitLabour: k.unitLabour, unitMachines: k.unitMachines, unitOperators: k.unitOperators, unitMaterials: k.unitMaterials, unitEquipment: k.unitEquipment, unitDirect: Math.round((k.unitLabour + k.unitMachines + k.unitMaterials + k.unitEquipment) * 1e4) / 1e4, missingPrices: k.missing.length } : {};
    return {
    rowGUID: r.rowGUID, rowOwnerGUID: r.rowOwnerGUID, rowParentGUID: r.rowParentGUID, orderInList: r.orderInList,
    rowJSON: { ...r.rowJSON, ...money, bookTitle: String(rowsAll.find((b) => b.rowGUID === r.rowOwnerGUID)?.rowJSON?.title ?? ''), titleShown: titleOf(r), titleOriginal: r.rowJSON.title ?? '', resourcesCount: Array.isArray(r.rowJSON.resources) ? r.rowJSON.resources.length : 0, resourcesText: resourcesText(r.rowJSON.resources), kindShown: pmT(String(r.rowJSON.nodeKind ?? '')) },
  }; }).filter((r) => r.rowJSON.nodeKind !== 'norm' || ((from === null || (r.rowJSON[filterField] !== undefined && r.rowJSON[filterField] >= from)) && (to === null || (r.rowJSON[filterField] !== undefined && r.rowJSON[filterField] <= to)))), [items, titleOf, priced, filterField, rate, rowsAll, from, to]);

  // the money columns are in the currency of the book; a search over several books mixes them: no currency in the titles then
  const currency = globalSearch ? '' : String(book?.rowJSON.currency ?? '');
  const columns = useMemo<VisualColumn[]>(() => {
    // money per unit of work, in the currency of the book (a norm book has no labour rate: the one typed above is used)
    const money = (key: string, title: string, width: number): VisualColumn => ({ key, title: `${pmT(title)}${currency ? `, ${currency}` : ''}`, type: 'number', width, align: 'right', editable: false, total: false } as VisualColumn);
    const moneyCols: VisualColumn[] = [
      money('unitLabour', 'Labour / unit', 130), money('unitMachines', 'Machines / unit', 140), money('unitOperators', 'of which operators', 150), money('unitMaterials', 'Materials / unit', 140), money('unitEquipment', 'Equipment / unit', 140),
      // the picker: 40 % narrower (the header wraps / is cut)
      { ...money('unitDirect', 'Direct cost / unit', pickMode ? 90 : 150) },
      { key: 'missingPrices', title: pmT('Resources without a price'), type: 'number', width: 170, align: 'right', editable: false, total: false } as VisualColumn,
    ];
    const cols: VisualColumn[] = [
      { key: 'kindShown', title: pmT('Kind'), type: 'text', width: 90, editable: false },
      { key: 'code', title: pmT('Code'), type: 'text', width: 150, editable: false },
      { key: 'titleShown', title: pmT('Title'), type: 'text', width: 380, editable: false },
      ...(globalSearch ? [{ key: 'bookTitle', title: pmT('Norm book'), type: 'text', width: 200, editable: false } as VisualColumn] : []),
      { key: 'unit', title: pmT('Unit'), type: 'text', width: 90, editable: false },
      ...moneyCols,
      { key: 'titleOriginal', title: pmT('Original title'), type: 'text', width: 380, editable: false },
      { key: 'baseType', title: pmT('Base type'), type: 'text', width: 110, editable: false },
      { key: 'sectionType', title: pmT('Section type'), type: 'text', width: 130, editable: false },
      { key: 'content', title: pmT('Content'), type: 'text', width: 320, editable: false },
      { key: 'resourcesCount', title: pmT('Resources'), type: 'number', width: 100, align: 'right', editable: false } as VisualColumn,
      { key: 'resourcesText', title: pmT('Resource composition'), type: 'text', width: 380, editable: false },
      { key: 'nrCode', title: pmT('Overhead norm (NR)'), type: 'text', width: 140, editable: false },
      { key: 'spCode', title: pmT('Profit norm (SP)'), type: 'text', width: 140, editable: false },
      { key: 'language', title: pmT('Language'), type: 'text', width: 90, editable: false },
    ];
    // the norm books (the screen AND the window that selects a norm) lead with what decides the choice: Direct cost, Unit, Title, Code, Kind (the rest keeps its order)
    {
      const lead = ['unitDirect', 'unit', 'titleShown', 'code', 'kindShown'];
      cols.sort((a, b) => { const ia = lead.indexOf(a.key as string); const ib = lead.indexOf(b.key as string); return (ia < 0 ? lead.length : ia) - (ib < 0 ? lead.length : ib); });
    }
    // the action column is a LINK column (hypertext, no buttons): the picker says Select, the norm books screen says "+ Add" (to the estimate), a section says Open.
    // It is as wide as its longest word (the "+ Add" has its icon: 14 px + 6 px gap) + 8 px at the left and the right (+ the 1 px delimiter), the word centred
    const actionWord = pickMode ? pmT('Select') : pmT('Add');
    const actionW = Math.max(textWidthPx(actionWord, LINK_FONT_SIZE) + (pickMode ? 0 : 14 + 6), textWidthPx(pmT('Open'), LINK_FONT_SIZE)) + 16 + 1;
    cols.unshift({
      key: 'rowAction', title: '', type: 'custom', width: actionW, cellPaddingX: 8, align: 'center', editable: false, pinFirst: true, searchText: () => '',
      renderCell: (row: any) => (row.rowJSON?.nodeKind === 'section'
        ? <IconLinkAction testID={`${testID}-open-${row.rowGUID}`} title={pmT('Open')} label={pmT('Open section')} onPress={() => setPicked(row.rowGUID)} />
        : row.rowJSON?.nodeKind === 'norm' && onAddNorm
          ? <IconLinkAction testID={`${testID}-add-${row.rowGUID}`} icon={pickMode ? undefined : 'add'} title={actionWord} label={pickMode ? undefined : pmT('Add to the estimate')}
            onPress={() => { const n = items.find((i) => i.rowGUID === row.rowGUID); if (n) void add(n); }} />
          : null),
    } as VisualColumn);
    return cols;
  }, [onAddNorm, items, add, testID, currency, pickMode, globalSearch, c.primary]);

  const folderOfRow = useCallback((r: ReusableTableRow) => (searching ? picked : (r.rowParentGUID === 'empty' ? (bookGUID ?? 'empty') : (r.rowParentGUID ?? 'empty'))), [searching, picked, bookGUID]);

  return (
    <View testID={testID} style={styles.root} onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); setPanelW((p) => (p === w ? p : w)); }}>
      {pairMenu && (
        <PMContextMenu testID={`${testID}-filter-pairs-menu`} x={pairMenu.x} y={pairMenu.y} caption={pmT('Search history')} onClose={() => setPairMenu(null)}
          items={[
            ...pairHistory.history.map((h, i) => {
              const p = decodeNormPair(h);
              return { testID: `${testID}-filter-pairs-${i}`, label: p ? normPairLabel(p, pmT) : h, icon: 'history', onPress: () => { setPairMenu(null); if (p) { setFilterField(p.field); setLabourFrom(p.from); setLabourTo(p.to); rememberPair(h); } } };
            }),
            ...(pairHistory.history.length === 0
              ? [{ testID: `${testID}-filter-pairs-empty`, label: pmT('No searches yet'), icon: 'history', disabled: true, onPress: () => {} }]
              : [{ testID: `${testID}-filter-pairs-clear`, label: pmT('Clear history'), icon: 'delete', danger: true, onPress: () => { setPairMenu(null); pairHistory.clear(); } }]),
          ]} />
      )}
      <View style={styles.bar}>
        {/* the left block is as wide as the World Norms panel below: the Import / Export buttons share it (the picker has none: it stays empty), so the search starts where the table starts */}
        {(treeBeside || !pickMode) && (
          <View testID={`${testID}-bar-left`} style={[styles.barLeft, treeBeside ? { width: NORM_TREE_WIDTH } : null]}>
            {!pickMode && <View style={{ flex: 3 }}><PMDialogButton testID={`${testID}-import`} kind="primary" icon="upload" title={pmT('Import norm books')} disabled={!canManage} onPress={onImport} /></View>}
            {!pickMode && <View style={{ flex: 2 }}><PMDialogButton testID={`${testID}-export`} kind="secondary" icon="download" title={pmT('Export')} disabled={!bookGUID} onPress={() => bookGUID && onExport(bookGUID)} /></View>}
          </View>
        )}
        <View style={{ flex: 1, minWidth: 220, flexDirection: 'row' }}>
          <HistoryTextInput ref={searchRef} historyKey="estimationNormSearch" testID={`${testID}-search`} label={pmT('Search by code or title')} value={query} onChangeText={setQuery} />
        </View>
        <View style={{ width: 150 }}>
          <SelectItemFromListApp<NormSearchMode> trigger="textInput" testID={`${testID}-search-mode`} label={pmT('Search mode')} value={searchMode} onSelect={setSearchMode}
            items={[{ value: 'start', label: pmT('Start') }, { value: 'contains', label: pmT('Contains') }, { value: 'finished', label: pmT('Finished') }]} />
        </View>
        {!!bookGUID && <View style={{ minWidth: 200 }}><SwitchApp testID={`${testID}-search-all`} label={pmT('Search in all norm books')} value={searchAll} onValueChange={setSearchAll} /></View>}
        <View style={{ width: 230 }} onStartShouldSetResponderCapture={(e: any) => { pairPress.current = { x: e?.nativeEvent?.pageX ?? 0, y: (e?.nativeEvent?.pageY ?? 0) + 14 }; return false; }}>
          <SelectItemFromListApp<NormFilterField> trigger="textInput" testID={`${testID}-filter-field`} label={pmT('Filter by')} value={filterField} onSelect={setFilterField}
            inputLeftIcons={[{ icon: 'history', testID: `${testID}-filter-pairs`, accessibilityLabel: 'Search history', onPress: () => setPairMenu({ x: pairPress.current.x, y: pairPress.current.y }) }]}
            items={NORM_FILTER_FIELDS.map((f) => ({ value: f.key, label: pmT(f.title) }))} />
        </View>
        <View style={{ width: 190, flexDirection: 'row' }}><HistoryTextInput historyKey={`estimationNormFilter.${filterField}.from`} testID={`${testID}-labour-from`} label={pmT('From')} value={labourFrom} keyboardType="numeric" onChangeText={setLabourFrom} onBlur={keepPair} onSubmitEditing={keepPair} /></View>
        <View style={{ width: 190, flexDirection: 'row' }}><HistoryTextInput historyKey={`estimationNormFilter.${filterField}.to`} testID={`${testID}-labour-to`} label={pmT('To')} value={labourTo} keyboardType="numeric" onChangeText={setLabourTo} onBlur={keepPair} onSubmitEditing={keepPair} /></View>
      </View>
      {!!bookGUID && !globalSearch && <Text style={[styles.h, { color: c.text }]}>{nodePath(rowsAll, bookGUID).join(' / ')}</Text>}
      {globalSearch && <Text testID={`${testID}-scope`} style={[styles.h, { color: c.text }]}>{pmT('Search in all norm books')}</Text>}
      {!tree && !error && <Text style={{ color: c.text, padding: 10, opacity: 0.7 }}>{pmT('No norm books yet. Run the SQL of PART 58 and import a norm book.')}</Text>}
      {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, padding: 6 }}>{error}</Text>}
      {!!tree && !pickedIsBookFolder && !searching && <Text style={{ color: c.text, opacity: 0.7, paddingHorizontal: 10, paddingBottom: 6 }}>{pmT('Pick a norm book on the left.')}</Text>}
      {/* the table space (measured: the table ends where it ends); the spinner is the table's own `busy` overlay */}
      <View ref={spaceRef} collapsable={false} onLayout={measureSpace} style={styles.tableSpace}>
      <ReusableTable
        dashboard="estimationDashboard" // the fonts and the cell background of the Estimation dashboard (userSettingsTable)
        testID={`${testID}-table`}
        entityName="estimationNormBrowser"
        crudListTitle={pmT('Norms')}
        itemLabel={pmT('Norm')}
        localRows={rows}
        onLocalRowsChange={() => undefined}
        visualColumns={columns}
        selectionEnabled={false}
        crudPanelEnabled={false}
        // the search of the book is the field above the table (it asks the database: a book is never read whole); the box of the table would filter only the rows of the open folder
        searchEnabled={false}
        addEnabled={false}
        deleteEnabled={false}
        reorderEnabled={false}
        readOnly
        busy={loading}
        // the norm the picker started at (the position already has it): marked and scrolled into view
        focusRowGUID={startNorm?.rowGUID ?? null}
        // the picker: a double click on a row = Select (a section = open it)
        onRowDoubleClick={pickMode ? (row) => {
          if (row.rowJSON?.nodeKind === 'section') { setPicked(row.rowGUID); return; }
          const n = items.find((i) => i.rowGUID === row.rowGUID);
          if (n && onAddNorm && row.rowJSON?.nodeKind === 'norm') void add(n);
        } : undefined}
        contextMenuEnabled={false}
        resizeColumnWidth
        // the widths of the columns are the last state of the dashboard (per user and work place; the picker window has its own set)
        {...normColumns}
        // (uxuiFolders: the bottom offset above)
        uxuiTable={{ showFoldersTree: true, foldersTreeWidth: NORM_TREE_WIDTH, foldersTreeResizable: false, foldersTreeCollapsible: true }}
        foldersTree={{
          nodes, folderOfRow, includeSubfolders: false, rowsDraggable: !pickMode, selectedFolderId: picked, onSelectedFolderChange: setPicked,
          tree: { readOnly: true, title: pmT('World Norms'), allLabel: pmT('All norm books'), revealSelected: true }, // the picker starts at a section: the tree opens the way to it
          uxuiFolders: { fullHeightBottomOffset: bottomOffset },
        }}
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 360 },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingBottom: 8 },
  barLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableSpace: { flex: 1, minHeight: 0 },
  h: { fontSize: 14, fontWeight: '700', paddingVertical: 4 },
});
