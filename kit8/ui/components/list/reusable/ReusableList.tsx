// ReusableList - ReusableTable's functions for rows shown as ITEMS, on iOS, Android and the web, for BIG lists.
//   engine        FlashList v2 (@shopify/flash-list): only the items on screen are mounted, cells are recycled
//   data          reusableListDataMode: 'clientDataMode' (all rows in memory, search / filter / sort on the device)
//                                       'serverDataMode' (pages from the database, search / filter / sort / count in the database)
//   columns       visualColumns = the schema: item text (listRole), search, sort, filter, validation, export, the edit card
//   reorder       the ⠿ grip of an item: hold it and drag (phone + web), the list scrolls by itself at its edges; ONE row is saved (orderInList between its new neighbours)
//   selection     a Set / "all except" store: select all of 100 000 rows is instant, one tap re-renders one item
// Plan, decisions and tests: documentation/ReusableList_WBS.html, README.md in this folder. Demo: route /demo/list/reusable.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import ActivityIndicatorCircleApp from '../../activityindicator/ActivityIndicatorCircleApp';
import AskBeforeDeletePostComponent from '../../common/AskBeforeDeletePostComponent';
import PMContextMenu from '../../../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';
import { defaultTitleExtractor } from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import ReusableTableRowMenu, { RowMenuState } from '../../table/reusable/ReusableTableRowMenu';
import ReusableTableColumnMenu from '../../table/reusable/ReusableTableColumnMenu';
import { buildTableFile, exportTableFile, shareTableFile, TABLE_EXPORT_FORMATS, TableExportFormat, tableFileResultMessage } from '../../table/reusable/tableExportActions';
import { ColumnFilters, ColumnSort, isActiveFilter, isSortFilterColumn } from '../../table/reusable/tableFilter';
import { columnFooterTotal } from '../../table/reusable/tableRows';
import type { CatalogColumn, EditRowModalCardProps, ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';
import ReusableListBar from './ReusableListBar';
import ReusableListItem, { ReusableListItemContext } from './ReusableListItem';
import ReorderHandle from './ReorderHandle';
import { buildView, isQueryActive, reorderResult, resolveListRoles, webRowLimit } from './listEngine';
import { createDragStore, createSelectionStore, useSelectionVersion } from './listStores';
import { createReorderController } from './reorderController';
import { useReusableListClient } from './useReusableListClient';
import { useReusableListServer } from './useReusableListServer';
import type { ReusableListProps, ReusableListQuery, ReusableListSource } from './reusableListTypes';

const DEFAULT_ITEM_HEIGHT = 72;

// ---- the query state (search, sort, filters) lives in the host, so the server hook can read it ----
function useQueryState() {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filters, setFilters] = useState<ColumnFilters>({});
  const query = useMemo<ReusableListQuery>(() => ({ search, sort, filters }), [search, sort, filters]);
  return { search, setSearch, sort, setSort, filters, setFilters, query };
}
type QueryState = ReturnType<typeof useQueryState>;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function ClientHost(props: ReusableListProps) {
  const q = useQueryState();
  const direction = props.orderDirection ?? 'asc';
  const source = useReusableListClient(props, direction);
  return <ReusableListView props={props} source={source} q={q} direction={direction} />;
}

function ServerHost(props: ReusableListProps) {
  const q = useQueryState();
  const direction = props.orderDirection ?? 'asc';
  // the database is asked 300 ms after the last keystroke; the typed text shows at once
  const search = useDebounced(q.search, 300);
  const dataQuery = useMemo<ReusableListQuery>(() => ({ search, sort: q.sort, filters: q.filters }), [search, q.sort, q.filters]);
  const source = useReusableListServer(props, dataQuery, direction, true);
  return <ReusableListView props={props} source={source} q={q} direction={direction} />;
}

/** The list. `reusableListDataMode` picks where the rows live; everything else is the same in both modes. */
export default function ReusableList(props: ReusableListProps) {
  return props.reusableListDataMode === 'serverDataMode' ? <ServerHost {...props} /> : <ClientHost {...props} />;
}

interface ViewProps { props: ReusableListProps; source: ReusableListSource; q: QueryState; direction: 'asc' | 'desc' }

function ReusableListView({ props, source, q, direction }: ViewProps) {
  const {
    visualColumns: columns, itemHeight = DEFAULT_ITEM_HEIGHT, itemLabel = 'Row', crudListTitle, testID = 'reusable-list', selectionEnabled = true, searchEnabled = true,
    contextMenuEnabled = true, reorderEnabled = true, addEnabled = true, readOnly = false, deleteEnabled = true, onAdd, onRowOpen, openLabel, EditRowModalCard, extraMenuItems,
    emptyText, focusRowGUID, onSelectionChange, toolbarExtra, uxuiList, endReachedThreshold = 1.5, entityName,
  } = props;
  const server = source.mode === 'serverDataMode';
  const dispatch = useDispatch();
  const { themeColors } = useDesignSystem();
  const colors = useMemo(() => ({ text: themeColors.text, border: themeColors.border, primary: themeColors.primary, background: themeColors.background }), [themeColors]);
  const win = useWindowDimensions();
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);

  // ---- catalog titles for the text of catalog columns (as the table does) ----
  const catalogCols = useMemo(() => columns.filter((x): x is CatalogColumn => x.type === 'catalog'), [columns]);
  const catalogEntities = useMemo(() => Array.from(new Set(catalogCols.flatMap((col) => col.catalogEntityNames ?? [col.catalogEntityName]))), [catalogCols]);
  const catalogRowsByEntity: any[][] = useSelector((s: any) => catalogEntities.map((e) => s?.[e]?.entityDataFromServer), shallowEqual);
  const catalogTitle = useCallback((col: VisualColumn, guid: string) => {
    const c = col as CatalogColumn;
    for (const entity of c.catalogEntityNames ?? [c.catalogEntityName]) {
      const found = (catalogRowsByEntity[catalogEntities.indexOf(entity)] || []).find((r: any) => r?.rowGUID === guid);
      if (found) return (c.titleExtractor || defaultTitleExtractor)(found);
    }
    return '';
  }, [catalogEntities, catalogRowsByEntity]);

  // ---- the shown list ----
  const roles = useMemo(() => resolveListRoles(columns), [columns]);
  const view = useMemo<ReusableTableRow[]>(
    () => (server ? source.rows : buildView(source.rows, { columns, query: q.query, catalogTitle, direction })),
    [server, source.rows, columns, q.query, catalogTitle, direction],
  );
  const queryActive = isQueryActive(q.query, columns);
  const viewRef = useRef(view); viewRef.current = view;
  const sourceRef = useRef(source); sourceRef.current = source;

  // ---- stores: selection and the dragged row (per row, outside the recycled items) ----
  const selection = useMemo(createSelectionStore, []);
  const dragStore = useMemo(createDragStore, []);
  const selectionVersion = useSelectionVersion(selection);
  const selectedCount = selection.count(view.length);
  useEffect(() => { if (onSelectionChange) onSelectionChange(selection.count(viewRef.current.length) === 0 ? [] : selection.idsOf(viewRef.current)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionVersion]);

  // ---- permissions of the user's actions ----
  const canEdit = !readOnly;
  const canAdd = canEdit && addEnabled;
  const canDelete = canEdit && deleteEnabled;
  /** the ⠿ grip + drag: the list is in the stored order (no search / filter / column sort) and the user may change rows */
  const canReorder = canEdit && reorderEnabled && !queryActive && !source.loading;

  // ---- reorder: the controller works on fixed item heights ----
  const listRef = useRef<any>(null);
  const containerRef = useRef<View>(null);
  const [dragging, setDragging] = useState<{ from: number; target: number; guid: string } | null>(null);
  const ghostY = useRef(new Animated.Value(0)).current;
  const lineY = useRef(new Animated.Value(0)).current;
  const optsRef = useRef({ itemHeight, count: view.length, enabled: canReorder, lastDropIndex: view.length - 1 });
  optsRef.current = { itemHeight, count: view.length, enabled: canReorder, lastDropIndex: server && source.hasMore ? view.length - 2 : view.length - 1 };
  const boxRef = useRef<{ top: number; height: number } | null>(null);
  const measureBox = useCallback((cb?: (top: number, height: number) => void) => {
    const node: any = containerRef.current;
    if (node?.measure) node.measure((_x: number, _y: number, _w: number, h: number, _px: number, py: number) => { if (h > 0) boxRef.current = { top: py, height: h }; cb?.(py, h); });
    else cb?.(0, 0);
  }, []);
  const controller = useMemo(() => createReorderController({
    opts: () => optsRef.current,
    measure: (cb) => measureBox(cb),
    cached: () => boxRef.current,
    scrollTo: (offset) => {
      // web: setting scrollTop of the scroll element is a plain browser scroll that FlashList follows; devices: the native scrollTo of FlashList
      const node = Platform.OS === 'web' ? listRef.current?.getScrollableNode?.() : null;
      if (node && typeof node.scrollTop === 'number') node.scrollTop = offset; else listRef.current?.scrollToOffset?.({ offset, animated: false });
    },
    onDrop: (from, to) => { const r = reorderResult(viewRef.current, from, to); if (r) sourceRef.current.setOrder(r.guid, r.orderInList); },
    onChange: (state) => { setDragging(state); dragStore.set(state ? state.guid : null); },
    ghostY, lineY,
  }), [dragStore, ghostY, lineY, measureBox]);

  // ---- menus, edit, delete ----
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [editGUID, setEditGUID] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);
  const [barMenu, setBarMenu] = useState<'more' | 'columns' | null>(null);
  const [columnMenu, setColumnMenu] = useState<{ key: string; x: number; y: number } | null>(null);

  const openEdit = EditRowModalCard ? (guid: string) => setEditGUID(guid) : onRowOpen ? (guid: string) => { const r = viewRef.current.find((x) => x.rowGUID === guid); if (r) onRowOpen(r); } : undefined;
  const doDelete = (ids: string[]) => { source.remove(ids); selection.clear(); };
  const askDelete = (ids: string[]) => { if (ids.length === 0 || !canDelete) return; if (askBeforeDelete) setPendingDelete(ids); else doDelete(ids); };

  const onItemPress = useCallback((row: ReusableTableRow) => {
    if (selection.count(viewRef.current.length) > 0) { selection.toggle(row.rowGUID); return; }
    if (EditRowModalCard) setEditGUID(row.rowGUID); else if (onRowOpen) onRowOpen(row);
  }, [selection, EditRowModalCard, onRowOpen]);
  const onItemMenu = useCallback((guid: string, x: number, y: number) => setRowMenu({ guid, x, y }), []);

  const moveToIndex = (guid: string, to: number) => {
    const v = viewRef.current;
    const from = v.findIndex((r) => r.rowGUID === guid);
    if (from < 0 || to < 0 || to >= v.length || (server && source.hasMore && to > v.length - 2)) return;
    const r = reorderResult(v, from, to);
    if (r) source.setOrder(r.guid, r.orderInList);
  };
  const menuCrud = useMemo<any>(() => {
    const at = (g: string) => viewRef.current.findIndex((r) => r.rowGUID === g);
    return {
      canArchive: source.canArchive, archive: source.archive, duplicate: (g: string) => source.duplicate(g),
      createBefore: (g: string) => source.createAt(Math.max(0, at(g))), createAfter: (g: string) => source.createAt(at(g) + 1),
      moveUp: (g: string) => moveToIndex(g, at(g) - 1), moveDown: (g: string) => moveToIndex(g, at(g) + 1),
      makeFirst: (g: string) => moveToIndex(g, 0), makeLast: (g: string) => moveToIndex(g, viewRef.current.length - 1),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  // ---- items ----
  const ctx = useMemo<ReusableListItemContext>(() => ({
    itemHeight, columns, roles, catalogTitle, selection, drag: dragStore, controller: canReorder ? controller : null, selectionEnabled: selectionEnabled && canEdit,
    menuEnabled: contextMenuEnabled, dividers: uxuiList?.dividers !== false, rounded: !!uxuiList?.roundedCards, colors, onPress: onItemPress, onMenu: onItemMenu, testID,
  }), [itemHeight, columns, roles, catalogTitle, selection, dragStore, canReorder, controller, selectionEnabled, canEdit, contextMenuEnabled, uxuiList, colors, onItemPress, onItemMenu, testID]);
  const ghostCtx = useMemo<ReusableListItemContext>(() => ({ ...ctx, controller: null, selectionEnabled: false, menuEnabled: false, dividers: false }), [ctx]);

  const renderItem = useCallback(({ item, index }: { item: ReusableTableRow; index: number }) => {
    if (props.renderItem) {
      const grip = canReorder ? <ReorderHandle testID={`${testID}-grip-${item.rowGUID}`} controller={controller} guid={item.rowGUID} index={index} color={colors.text} height={itemHeight} /> : null;
      return <>{props.renderItem(item, { index, reorderable: canReorder, dragging: false, grip })}</>;
    }
    return <ReusableListItem row={item} index={index} ctx={ctx} reorderable={canReorder} />;
  }, [props.renderItem, ctx, canReorder, controller, colors, itemHeight, testID]);
  const keyExtractor = useCallback((r: ReusableTableRow) => r.rowGUID, []);
  const onScroll = useCallback((e: any) => controller.onScroll(e?.nativeEvent?.contentOffset?.y ?? 0), [controller]);

  // scroll the marked row into view
  useEffect(() => {
    if (!focusRowGUID) return;
    const i = view.findIndex((r) => r.rowGUID === focusRowGUID);
    if (i >= 0) listRef.current?.scrollToIndex?.({ index: i, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRowGUID, view.length > 0]);

  // ---- export ----
  const runExport = async (format: TableExportFormat, share: boolean) => {
    try {
      const file = buildTableFile(format, { title: crudListTitle || itemLabel, rows: viewRef.current, columns, catalogTitle });
      const result = share ? await shareTableFile(file, crudListTitle || itemLabel) : await exportTableFile(file);
      const message = tableFileResultMessage(result, file.fileName);
      if (message) dispatch(showSnackbar({ message }));
    } catch (e: any) {
      dispatch(showSnackbar({ message: `${share ? 'Share' : 'Export'} failed: ${e?.message || e}` }));
    }
  };
  const moreItems: PMMenuItemProps[] = [
    { testID: `${testID}-more-export`, label: server ? 'Export loaded rows' : 'Export', icon: 'download', onPress: () => {}, submenu: TABLE_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-more-export-${f.format}`, label: f.label, icon: f.icon, onPress: () => { setBarMenu(null); runExport(f.format, false); } })) },
    { testID: `${testID}-more-share`, label: 'Share', icon: 'share', onPress: () => {}, submenu: TABLE_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-more-share-${f.format}`, label: f.label, icon: f.icon, onPress: () => { setBarMenu(null); runExport(f.format, true); } })) },
  ];
  const sortFilterColumns = columns.filter(isSortFilterColumn);
  const columnItems: PMMenuItemProps[] = sortFilterColumns.map((col) => ({
    testID: `${testID}-columns-${col.key}`,
    label: `${col.title}${q.sort?.key === col.key ? (q.sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}${isActiveFilter(q.filters[col.key]) ? ' (filter)' : ''}`,
    icon: 'sort',
    onPress: () => { setBarMenu(null); setColumnMenu({ key: col.key, x: Math.max(8, win.width - 260), y: 90 }); },
  }));
  const sortCol = q.sort ? columns.find((c) => c.key === q.sort!.key) : null;
  const filterCount = columns.filter((c) => isActiveFilter(q.filters[c.key])).length;

  const totals = useMemo(() => (server || view.length > 200000 ? [] : columns.filter((c) => c.type === 'integer' || c.type === 'number').map((c) => ({ col: c, t: columnFooterTotal(view, c, columns) })).filter((x) => x.t.kind === 'sum')), [server, view, columns]);

  /** web: more rows than a browser can scroll through (see webRowLimit) */
  const overWebLimit = Platform.OS === 'web' && view.length > webRowLimit(itemHeight);
  const showEmpty = !source.loading && view.length === 0;
  const shownCount = server && source.total !== null && source.total !== view.length ? `${view.length} of ${source.total}` : String(view.length);

  return (
    <View testID={testID} style={styles.root}>
      <ReusableListBar
        testID={testID} colors={colors} title={crudListTitle} mode={source.mode} search={q.search} onSearch={q.setSearch} searchEnabled={searchEnabled}
        sortLabel={sortCol ? `${sortCol.title} ${q.sort!.direction === 'asc' ? '▲' : '▼'}` : ''} filterCount={filterCount}
        onSortFilter={() => setBarMenu('columns')} onClearQuery={() => { q.setSearch(''); q.setSort(null); q.setFilters({}); }}
        onAdd={canAdd ? (onAdd ?? (() => { source.createAt(direction === 'desc' || server ? 0 : viewRef.current.length); })) : undefined}
        onRefresh={source.refresh} onMore={() => setBarMenu('more')} refreshing={source.loadingMore}
        selectedCount={selectedCount} onClearSelection={selection.clear} onDeleteSelected={canDelete ? () => askDelete(selection.idsOf(viewRef.current)) : undefined}
        onSelectAll={() => { if (server) selection.set(viewRef.current.map((r) => r.rowGUID)); else selection.selectAll(); }}
        selectionEnabled={selectionEnabled && canEdit} toolbarExtra={toolbarExtra}
      />

      <View ref={containerRef} collapsable={false} style={styles.listBox} onLayout={() => measureBox()}>
        {source.loading ? (
          <View style={styles.state}><ActivityIndicatorCircleApp testID={`${testID}-loading`} /></View>
        ) : showEmpty ? (
          <View style={styles.state}>
            <Text testID={`${testID}-empty`} style={{ color: colors.text, opacity: 0.6 }}>
              {source.error ? `Could not read the list: ${String(source.error?.message ?? source.error)}` : queryActive ? 'No matches found.' : emptyText ?? `No ${itemLabel.toLowerCase()}s yet.`}
            </Text>
          </View>
        ) : (
          <FlashList
            ref={listRef}
            testID={`${testID}-flashlist`}
            data={view}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            extraData={ctx}
            // devices: no finger scrolling while an item is held (the list still scrolls by itself at its edges). Web: react-native-web drops the scroll events of a list with scrollEnabled false,
            // so FlashList would not draw the rows the auto scroll passes - the grip holds the pointer, the wheel is not used during a drag
            scrollEnabled={!(dragging && Platform.OS !== 'web')}
            // the viewport stays where it is when a dropped item changes places (FlashList would follow the first visible item and scroll the list under the finger)
            maintainVisibleContentPosition={{ disabled: true }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onEndReached={server ? source.loadMore : undefined}
            onEndReachedThreshold={endReachedThreshold}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={source.loadingMore ? <View style={styles.footerLoading}><ActivityIndicatorCircleApp size="small" /></View> : null}
          />
        )}
        {dragging ? (
          <>
            <Animated.View pointerEvents="none" testID={`${testID}-drop-line`} style={[styles.dropLine, { backgroundColor: colors.primary, transform: [{ translateY: lineY }] }]} />
            <Animated.View pointerEvents="none" testID={`${testID}-ghost`} style={[styles.ghost, { height: itemHeight, transform: [{ translateY: ghostY }], backgroundColor: colors.background }]}>
              {(() => { const row = viewRef.current[dragging.from]; return row ? (props.renderItem ? <>{props.renderItem(row, { index: dragging.from, reorderable: false, dragging: true, grip: null })}</> : <ReusableListItem row={row} index={dragging.from} ctx={ghostCtx} reorderable={false} />) : null; })()}
            </Animated.View>
          </>
        ) : null}
      </View>

      <View testID={`${testID}-footer`} style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Text testID={`${testID}-count`} style={{ color: colors.text, opacity: 0.7, fontSize: 13 }}>
          {shownCount} {view.length === 1 && !server ? itemLabel.toLowerCase() : `${itemLabel.toLowerCase()}s`}{server ? ' · server' : ''}
        </Text>
        {overWebLimit ? <Text testID={`${testID}-web-limit`} style={{ color: '#b45309', fontSize: 12, fontWeight: '600' }}>A browser cannot scroll to the last rows of this list - use serverDataMode or filter it.</Text> : null}
        {totals.map(({ col, t }) => (t.kind === 'sum' ? <Text key={col.key} testID={`${testID}-total-${col.key}`} style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>{col.title}: {t.value}{t.suffix ? ` ${t.suffix}` : ''}</Text> : null))}
      </View>

      <ReusableTableRowMenu menu={rowMenu} rows={view} crud={menuCrud} itemLabel={itemLabel} reorderEnabled={canEdit && reorderEnabled} addEnabled={canAdd && !onAdd} deleteEnabled={canDelete}
        filtered={queryActive} openLabel={openLabel} onDelete={(g) => askDelete([g])} onEdit={openEdit} onClose={() => setRowMenu(null)} extraMenuItems={extraMenuItems} testID={testID} />
      {barMenu === 'more' ? <PMContextMenu testID={`${testID}-more-menu`} x={Math.max(8, win.width - 220)} y={90} caption={itemLabel} items={moreItems} onClose={() => setBarMenu(null)} /> : null}
      {barMenu === 'columns' ? <PMContextMenu testID={`${testID}-columns-menu`} x={Math.max(8, win.width - 220)} y={90} caption="Sort and filter by" items={columnItems} onClose={() => setBarMenu(null)} /> : null}
      {columnMenu && columns.some((c) => c.key === columnMenu.key) ? (
        <ReusableTableColumnMenu testID={testID} col={columns.find((c) => c.key === columnMenu.key)!} x={columnMenu.x} y={columnMenu.y} sort={q.sort} filter={q.filters[columnMenu.key]} onSort={q.setSort}
          onFilter={(f) => q.setFilters((all) => { const next = { ...all }; if (f) next[columnMenu.key] = f; else delete next[columnMenu.key]; return next; })} onClose={() => setColumnMenu(null)} />
      ) : null}
      {EditRowModalCard && editGUID ? (() => {
        const editRow = source.rows.find((x) => x.rowGUID === editGUID);
        if (!editRow) return null;
        const cardProps: EditRowModalCardProps = {
          row: editRow, itemLabel, visualColumns: columns, testID: `${testID}-edit`,
          setCell: (key, value) => { source.setCell(editGUID, key, value); },
          patchRow: (patch) => source.patchRow(editGUID, patch),
          onClose: () => setEditGUID(null),
        };
        return <EditRowModalCard {...cardProps} />;
      })() : null}
      <AskBeforeDeletePostComponent visible={!!pendingDelete} testID={`${testID}-ask-delete`} modalBody={pendingDelete && pendingDelete.length > 1 ? `${pendingDelete.length} ${itemLabel.toLowerCase()}s will be deleted` : undefined}
        onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) doDelete(pendingDelete); setPendingDelete(null); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  listBox: { flex: 1, minHeight: 0 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  footerLoading: { padding: 12, alignItems: 'center' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  dropLine: { position: 'absolute', left: 0, right: 0, top: -1, height: 3, zIndex: 40 },
  ghost: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 50, elevation: 10, opacity: 0.95, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
