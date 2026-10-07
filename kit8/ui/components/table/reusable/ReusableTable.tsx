// ReusableTable - ListWebCardsComponent as a TABLE (web + iOS + Android).
//   data      one reusable redux entity (SystemMetaData key) scoped by listOwnerGUID + listParentGUID:
//             read on mount, Supabase Realtime, optimistic create / update / delete (+ Undo snackbar), archive
//   columns   visualColumns: row number · catalog GUID (SelectElementFromCatalog, may depend on another
//             column) · integer / number · text · custom - every cell is edited in place and saved to rowJSON
//   panel     icon buttons: add first / add / duplicate / move up / move down / delete (selected rows)
//   headers   ▾ = sort + filter of the column (light Tasks Tree "Filter & sort"); optional column drag & resize
//   rows      like the Tasks Tree: context menu (right-click / long-press / ⋮), drag & drop by the ⠿ handle
//             (web), move up / down / first / last, add above / below, duplicate, selection + delete selected
// Example: ./example/TaskExpenseInputTable.tsx, route /demo/reusabletable.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTheme as usePaperTheme } from 'react-native-paper';
import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { buildReturnToRoute } from '../../../../lib/returnToRoute';
import TextInputApp from '../../common/TextInputApp';
import PMContextMenu from '../../../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../../../pm/inner/menu/PMMenuItem';
import { showSnackbar } from '../../../../redux/uxuiSlice';
import { useSearchHistory } from './useSearchHistory';
import { buildTableFile, exportTableFile, shareTableFile, TABLE_EXPORT_FORMATS, TableExportFormat, tableFileResultMessage } from './tableExportActions';
import { useDesignSystem } from '../../../../providers/WithDesignSystem';
import IconApp from '../../common/IconApp';
import AskBeforeDeletePostComponent from '../../common/AskBeforeDeletePostComponent';
import { defaultTitleExtractor } from '../../../../catalog/inner/select_element/SelectElementFromCatalog';
import ReusableTableCell from './ReusableTableCell';
import ReusableTableRowMenu, { RowMenuState } from './ReusableTableRowMenu';
import { useReusableTableCrud } from './useReusableTableCrud';
import type { CatalogColumn, ReusableTableProps, ReusableTableRow, VisualColumn } from './reusableTableTypes';
import ReusableTableHeaderCell from './ReusableTableHeaderCell';
import ReusableTableColumnMenu from './ReusableTableColumnMenu';
import { PMIconButton } from '../../../../pm/inner/buttons/PMIconButton';
import { ColumnFilters, ColumnSort, filterRows, isActiveFilter, isSortFilterColumn, sortRowsByColumn } from './tableFilter';
import { colorToHex, moveSelectedRows, stretchColumns, arrangeColumns, clampColumnWidth, columnDropIndex, fieldOf, moveColumn, rowSearchText, widthOf } from './tableRows';

// web only: DOM + @hello-pangea/dnd - never loaded on iOS / Android
const BodyWeb: any = Platform.OS === 'web' ? require('./ReusableTableBodyWeb').default : null;

type ServiceColumn = 'select' | 'drag';

/** header of a service column: dragged towards the other service column (direction 1 = right, -1 = left) it swaps with it */
function ServiceHeaderCell({ width, draggable, direction, onSwap, children, delimiterColor, testID }: { delimiterColor?: string; width: number; draggable: boolean; direction: 1 | -1; onSwap: () => void; children: React.ReactNode; testID: string }) {
  const x = useRef(new Animated.Value(0)).current;
  const live = useRef({ direction, onSwap });
  live.current = { direction, onSwap };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
    // the column follows the pointer only towards its neighbour, never past it
    onPanResponderMove: (_e, g) => x.setValue(Math.max(0, Math.min(40, g.dx * live.current.direction)) * live.current.direction),
    onPanResponderRelease: (_e, g) => { x.setValue(0); if (g.dx * live.current.direction > 14) live.current.onSwap(); },
    onPanResponderTerminate: () => x.setValue(0),
    onPanResponderTerminationRequest: () => false,
  }), [x]);
  return (
    <Animated.View testID={testID} {...(draggable ? pan.panHandlers : {})}
      style={[{ width, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: x }] }, delimiterColor ? { borderRightWidth: 1, borderRightColor: delimiterColor } : null, Platform.OS === 'web' && draggable ? ({ cursor: 'grab', userSelect: 'none' } as any) : null]}>
      {children}
    </Animated.View>
  );
}

const HANDLE_W = 28;
const CHECK_W = 40;
const MENU_W = 36;

export default function ReusableTable(props: ReusableTableProps) {
  const {
    entityName, crudListTitle = 'Table', listOwnerGUID, itemLabel = 'Row', reorderEnabled = true, visualColumns: columnsProp,
    selectRowCheckBoxForm = 'formRound', dragAndDropColumns = false, resizeColumnWidth = false, onColumnsOrderChange, onColumnsWidthsChange, columnSortAndFilter = true, crudPanelEnabled = true, uxuiTable,
    selectionEnabled = true, searchEnabled = true, contextMenuEnabled = true, extraMenuItems, rowHeight: rowHeightProp, tableMaxWidth,
    emptyText, testID = 'reusable-table',
  } = props;
  const { themeColors: c, isDark } = useDesignSystem();
  const crud = useReusableTableCrud(props);
  const { rows } = crud;
  const askBeforeDelete = useSelector((s: any) => s?.uxuiState?.askBeforeDeletePost ?? true);

  // ---- columns: the user's order (drag a header) and widths (drag a header separator) ----
  const [columnsOrder, setColumnsOrder] = useState<string[]>(props.columnsOrder ?? []);
  const [columnsWidths, setColumnsWidths] = useState<Record<string, number>>(props.columnsWidths ?? {});
  // ---- look: uxuiTable ----
  const delimiters = uxuiTable?.verticalDelimitersForCells !== false;
  const headerDelimiters = uxuiTable?.verticalDelimitersForColumnNames !== false;
  const roundedCells = !!uxuiTable?.roundedCells;
  const borderedCells = !!uxuiTable?.borderedCells;
  /** the bar above the table is as low as its content (default) or has the roomy padding */
  const minimumRows = uxuiTable?.minimumTableRowHeight !== false;
  const rowHeight = rowHeightProp ?? (minimumRows ? 32 : 52);
  const footerAsRow = (uxuiTable?.useTableFooterHeightAsLineHeight ?? uxuiTable?.useTableFooterHeightAlLineHeight) !== false;
  const minimumBar = uxuiTable?.minimumTableToolBarHeight !== false;
  // default: the table header color of the react-native-paper theme (MD3 surfaceVariant), as hex
  const paperTheme = usePaperTheme();
  const headersBackground = uxuiTable?.colorForColumnHeadersBackground
    ?? colorToHex((paperTheme?.colors as any)?.surfaceVariant || (isDark ? '#49454f' : '#e7e0ec'));
  const fixedWidth = uxuiTable?.fixedWidth ?? '100%';
  /** px of the table body (measured): the columns are stretched to fill it */
  const [bodyWidth, setBodyWidth] = useState(0);
  const fixedColsWidth = (Platform.OS === 'web' && reorderEnabled ? HANDLE_W : 0) + (selectionEnabled ? CHECK_W : 0) + (contextMenuEnabled ? MENU_W : 0);
  const visualColumns = useMemo(
    () => stretchColumns(arrangeColumns(columnsProp, columnsOrder, columnsWidths), bodyWidth - fixedColsWidth, columnsWidths),
    [columnsProp, columnsOrder, columnsWidths, bodyWidth, fixedColsWidth],
  );
  const delimiterStyle = delimiters ? { borderRightWidth: 1, borderRightColor: c.border } : null;
  const onColumnDragEnd = (key: string, dx: number) => {
    const keys = visualColumns.map((col) => col.key);
    const from = keys.indexOf(key);
    const next = moveColumn(keys, from, columnDropIndex(visualColumns.map(widthOf), from, dx));
    if (next === keys) return;
    setColumnsOrder(next);
    onColumnsOrderChange?.(next);
  };
  const onColumnResize = (key: string, width: number) => setColumnsWidths((w) => ({ ...w, [key]: clampColumnWidth(width) }));
  const onColumnResizeEnd = (key: string, width: number) => onColumnsWidthsChange?.({ ...columnsWidths, [key]: clampColumnWidth(width) });

  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const routeParams = useGlobalSearchParams<Record<string, string>>();
  /**
   * "…" of a catalog cell: the details route of the selected element. The route also gets `returnTo` = this screen
   * with its parameters + focusRowGUID (the row the user left from), so the app's Back button returns to this place.
   */
  const openDetails = (col: VisualColumn, guid: string, row: ReusableTableRow) => {
    if (col.type !== 'catalog' || !col.detailsRoute) return;
    const target = typeof col.detailsRoute === 'function' ? col.detailsRoute(guid, row) : { pathname: col.detailsRoute, params: { rowGUID: guid } };
    if (!target) return;
    const returnTo = buildReturnToRoute(pathname, routeParams, { focusRowGUID: row.rowGUID });
    if (typeof target === 'string') router.push(`${target}${target.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}` as any);
    else router.push({ pathname: target.pathname, params: { ...(target.params || {}), returnTo } } as any);
  };
  /** the row the user returned to (route parameter focusRowGUID): marked, and scrolled into view on web */
  const focusRowGUID = typeof routeParams.focusRowGUID === 'string' ? routeParams.focusRowGUID : null;
  const focusRowShown = !!focusRowGUID && crud.rows.some((r) => r.rowGUID === focusRowGUID);
  useEffect(() => {
    if (!focusRowShown || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el: any = document.getElementById(`${testID}-row-${focusRowGUID}`);
    el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [focusRowShown, focusRowGUID, testID]);

  // ---- service columns: "select row" (1st) and "drag row" (2nd); the user can swap these two with each other only ----
  const [serviceOrder, setServiceOrder] = useState<ServiceColumn[]>(['select', 'drag']);
  const swapServiceColumns = () => setServiceOrder((o) => [o[1], o[0]]);
  const [search, setSearch] = useState('');
  /** the last search substrings of this table (kept on the device) */
  const searchHistory = useSearchHistory(entityName);
  /** popup next to the search field: 'history' | 'more' (⋮) */
  const lastPress = useRef({ x: 0, y: 0 });
  const [barMenu, setBarMenu] = useState<{ kind: 'history' | 'more'; x: number; y: number } | null>(null);
  // ---- column sort + filters (▾ of a header) ----
  const [columnSort, setColumnSort] = useState<ColumnSort | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [columnMenu, setColumnMenu] = useState<{ key: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<RowMenuState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  // ---- search: typed values + the TITLES of the selected catalog elements ----
  const catalogCols = useMemo(() => visualColumns.filter((x): x is CatalogColumn => x.type === 'catalog'), [visualColumns]);
  const catalogRows: any[][] = useSelector((s: any) => catalogCols.map((col) => s?.[col.catalogEntityName]?.entityDataFromServer), shallowEqual);
  const catalogTitle = useCallback((col: VisualColumn, guid: string) => {
    const i = catalogCols.indexOf(col as CatalogColumn);
    const found = (catalogRows[i] || []).find((r: any) => r?.rowGUID === guid);
    return found ? ((col as CatalogColumn).titleExtractor || defaultTitleExtractor)(found) : '';
  }, [catalogCols, catalogRows]);
  const q = search.trim().toLowerCase();
  const hasColumnFilter = visualColumns.some((col) => isActiveFilter(columnFilters[col.key]));
  const visible = useMemo(() => {
    const found = q ? rows.filter((r) => rowSearchText(r, visualColumns, catalogTitle).includes(q)) : rows;
    return sortRowsByColumn(filterRows(found, visualColumns, columnFilters, catalogTitle), visualColumns, columnSort, catalogTitle);
  }, [rows, q, visualColumns, catalogTitle, columnFilters, columnSort]);
  /** the view is not the stored list (search / filter / sort): rows cannot be reordered by position */
  const filtered = q !== '' || hasColumnFilter || !!columnSort;
  const clearSortAndFilters = () => { setColumnSort(null); setColumnFilters({}); setSearch(''); };
  /** "Default settings": columns back to their order and widths, no sort, no filters, no search */
  const resetToDefaultSettings = () => {
    clearSortAndFilters();
    setColumnsOrder([]);
    setColumnsWidths({});
    onColumnsOrderChange?.([]);
    onColumnsWidthsChange?.({});
  };
  /** the rows and columns as they are shown now (search / filters / sort / column order applied) */
  const runExport = async (format: TableExportFormat, share: boolean) => {
    try {
      const file = buildTableFile(format, { title: crudListTitle, rows: visible, columns: visualColumns, catalogTitle });
      const result = share ? await shareTableFile(file, crudListTitle) : await exportTableFile(file);
      const message = tableFileResultMessage(result, file.fileName);
      if (message) dispatch(showSnackbar({ message }));
    } catch (e: any) {
      dispatch(showSnackbar({ message: `${share ? 'Share' : 'Export'} failed: ${e?.message || e}` }));
    }
  };
  const canDrag = reorderEnabled && !filtered;

  // ---- selection ----
  const selectedHere = selected.filter((id) => rows.some((r) => r.rowGUID === id));
  const allSelected = visible.length > 0 && visible.every((r) => selectedHere.includes(r.rowGUID));
  /** some rows of the view are selected, not all: the header check box is marked with − */
  const someSelected = !allSelected && visible.some((r) => selectedHere.includes(r.rowGUID));
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setSelected(allSelected ? [] : visible.map((r) => r.rowGUID));

  // ---- delete (asks first when uxuiState.askBeforeDeletePost) ----
  const doDelete = (ids: string[]) => { crud.remove(ids); setSelected((p) => p.filter((x) => !ids.includes(x))); };
  const askDelete = (ids: string[]) => { if (ids.length === 0) return; if (askBeforeDelete) setPendingDelete(ids); else doDelete(ids); };

  /** the ONE selected row: target of the panel's duplicate button */
  const one = selectedHere.length === 1 ? selectedHere[0] : null;
  /** the arrows move ALL selected rows together (not while the view is searched / filtered / sorted) */
  const canMoveSelected = (direction: 1 | -1) => selectedHere.length > 0 && !filtered && moveSelectedRows(rows, selectedHere, direction).moved.length > 0;

  const openMenu = contextMenuEnabled ? (guid: string, x: number, y: number) => setMenu({ guid, x, y }) : undefined;

  const columnsWidth = visualColumns.reduce((w, col) => w + widthOf(col), 0);
  const totalWidth = columnsWidth + fixedColsWidth;
  const justify = (col: VisualColumn) => (col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start');
  const showHandle = Platform.OS === 'web' && reorderEnabled;
  const serviceColumns = serviceOrder.filter((kind) => (kind === 'select' ? selectionEnabled : showHandle));

  const checkbox = (checked: boolean, onPress: () => void, id: string, partial = false) => (
    <Pressable testID={id} onPress={onPress} hitSlop={6} accessibilityRole="checkbox" aria-checked={partial ? 'mixed' : checked} style={[styles.fixedCell, styles.checkCell]}>
      <View style={[styles.box, selectRowCheckBoxForm === 'formSquare' ? styles.boxSquare : styles.boxRound, { borderColor: checked || partial ? c.primary : c.text + '80', backgroundColor: checked || partial ? c.primary : 'transparent' }]}>
        {/* header: ✓ = all rows selected, − = some of them */}
        {checked ? <Text style={styles.boxTick}>✓</Text> : partial ? <View testID={`${id}-partial`} style={styles.boxDash} /> : null}
      </View>
    </Pressable>
  );

  const renderRow = (row: ReusableTableRow, index: number, opts: { dragHandle: React.ReactNode; isDragging: boolean; ghost: boolean }) => {
    const isSelected = selectedHere.includes(row.rowGUID);
    const isFocus = row.rowGUID === focusRowGUID;
    const bg = opts.isDragging ? c.surface : isSelected ? c.primary + '18' : isFocus ? c.primary + '10' : index % 2 === 1 ? c.background : c.surface;
    return (
      <View testID={opts.ghost ? undefined : `${testID}-row-${row.rowGUID}`} aria-current={isFocus ? 'true' : undefined}
        style={[styles.row, { minHeight: rowHeight, backgroundColor: bg, borderBottomColor: c.border, minWidth: totalWidth }]}>
        {/* the row the user returned to: a marker laid OVER the row (a border would shift its cells and delimiter lines) */}
        {isFocus && <View pointerEvents="none" testID={`${testID}-focus-marker`} style={[styles.focusMarker, { backgroundColor: c.primary }]} />}
        {serviceColumns.map((kind) => (kind === 'select'
          ? <View key={kind} style={[styles.serviceCell, delimiterStyle, { width: CHECK_W }]}>{checkbox(isSelected, () => toggle(row.rowGUID), `${testID}-select-${row.rowGUID}`)}</View>
          : <View key={kind} style={[styles.serviceCell, delimiterStyle, { width: HANDLE_W }]}>{opts.dragHandle}</View>))}
        {visualColumns.map((col) => (
          <View key={col.key} style={[styles.cell, minimumRows ? styles.cellMinimum : null, delimiterStyle, { width: widthOf(col), justifyContent: justify(col) }]}>
            <ReusableTableCell dense={minimumRows} col={col} columns={visualColumns} row={row} rowIndex={index} readOnly={opts.ghost} rounded={roundedCells} bordered={borderedCells} onOpenDetails={openDetails} testID={testID}
              onChange={(key, value) => crud.setCell(row.rowGUID, key, value)} onPatch={(patch) => crud.patchRow(row.rowGUID, patch)} />
          </View>
        ))}
        {contextMenuEnabled && (
          <Pressable testID={`${testID}-menu-button-${row.rowGUID}`} accessibilityLabel="Row menu" hitSlop={6} style={[styles.fixedCell, { width: MENU_W }]}
            onPress={(e: any) => openMenu?.(row.rowGUID, e?.nativeEvent?.pageX ?? 0, e?.nativeEvent?.pageY ?? 0)}>
            {/* the same icon as the ⋮ of the bar; a text glyph sits above the middle of its line */}
            <IconApp name="more_vert" size={18} color={c.text} />
          </Pressable>
        )}
      </View>
    );
  };

  if (!listOwnerGUID) {
    return (
      <View style={[styles.root, styles.state, { backgroundColor: c.surface, borderColor: c.border }]} testID={`${testID}-no-owner`}>
        <Text style={{ color: c.text, opacity: 0.7 }}>Awaiting listOwnerGUID… select the owner to see its {crudListTitle.toLowerCase()}.</Text>
      </View>
    );
  }

  const numericCols = visualColumns.filter((col) => col.type === 'integer' || col.type === 'number');
  const total = (col: VisualColumn) => visible.reduce((sum, r) => sum + (Number(r.rowJSON?.[fieldOf(col)]) || 0), 0);

  // ---- the parts of the bar above the table (placed by uxuiTable.tableBarLayoutVariant) ----
  const barLayout = uxuiTable?.tableBarLayoutVariant ?? 'leftCrudPanel_rightSearch';
  const titleEl = <Text testID={`${testID}-title`} numberOfLines={1} style={[styles.title, { color: c.text }]}>{crudListTitle}</Text>;
  const pressPoint = (e: any) => ({ x: e?.nativeEvent?.pageX ?? 0, y: (e?.nativeEvent?.pageY ?? 0) + 14 });
  const searchEl = (
    <>
      {searchEnabled && (
        <View style={styles.searchBox}>
          <TextInputApp
            testID={`${testID}-search`}
            value={search}
            onChangeText={setSearch}
            // a typed substring goes to the history when the user leaves the field or presses Enter
            onBlur={() => searchHistory.remember(search)}
            onSubmitEditing={() => searchHistory.remember(search)}
            placeholder="Search…"
            heightVariant={uxuiTable?.searchInputHeight ?? 'smallestHeight'}
            // all inside the input - left: search (reads the table again) · ▾ search history; right: ✕ clear (TextInputApp's own)
            leftIcons={[
              { icon: 'search', testID: `${testID}-search-refresh`, accessibilityLabel: 'Search: refresh the table', onPress: () => { searchHistory.remember(search); crud.refresh(); } },
              { icon: 'expand_more', testID: `${testID}-search-history`, accessibilityLabel: 'Search history', onPress: () => setBarMenu({ kind: 'history', x: lastPress.current.x, y: lastPress.current.y }) },
            ]}
            style={styles.search}
          />
        </View>
      )}
    </>
  );
  // ⋮ of the bar: always the LAST element, in a box as wide as the ⋮ column of the rows -> all ⋮ are on one vertical line
  const moreEl = (
    <View style={styles.barMore} testID={`${testID}-bar-more`}>
      <PMIconButton tipScope="app" testID={`${testID}-more`} icon="more_vert" title="Default settings, export, share" color={c.text}
        onPress={() => setBarMenu({ kind: 'more', x: lastPress.current.x, y: lastPress.current.y })} />
    </View>
  );
  const panelEl = crudPanelEnabled && (
          <View style={styles.panel} testID={`${testID}-crud-panel`}>
            <PMIconButton tipScope="app" testID={`${testID}-add`} icon="add" title={`Add ${itemLabel.toLowerCase()} last`} color={c.primary} onPress={() => crud.createLast()} />
            <PMIconButton tipScope="app" testID={`${testID}-add-first`} icon="add_row_above" title={`Add ${itemLabel.toLowerCase()} first`} color={c.text} onPress={() => crud.createFirst()} />
            <PMIconButton tipScope="app" testID={`${testID}-duplicate-selected`} icon="control_point_duplicate" title="Duplicate the selected row" color={c.text} disabled={!one} onPress={() => one && crud.duplicate(one)} />
            {reorderEnabled && (
              <>
                <PMIconButton tipScope="app" testID={`${testID}-move-up-selected`} icon="arrow_upward" title="Move the selected rows up" color={c.text} disabled={!canMoveSelected(-1)} onPress={() => crud.moveSelected(selectedHere, -1)} />
                <PMIconButton tipScope="app" testID={`${testID}-move-down-selected`} icon="arrow_downward" title="Move the selected rows down" color={c.text} disabled={!canMoveSelected(1)} onPress={() => crud.moveSelected(selectedHere, 1)} />
              </>
            )}
            {filtered && <PMIconButton tipScope="app" testID={`${testID}-clear-filters`} icon="filter_alt_off" title="Clear search, filters and sort" color={c.primary} onPress={clearSortAndFilters} />}
            <PMIconButton tipScope="app" testID={`${testID}-delete-selected`} icon="delete" title="Delete the selected rows" color={c.error} disabled={selectedHere.length === 0} badge={selectedHere.length || undefined} onPress={() => askDelete(selectedHere)} />
          </View>
        );

  const table = (
    <View style={[styles.root, { backgroundColor: c.surface, borderColor: c.border, width: fixedWidth as any, maxWidth: tableMaxWidth }]} testID={testID}>
      {/* ---- top bar ---- */}
      <View style={[styles.toolbar, minimumBar ? styles.toolbarMinimum : null, { borderBottomColor: c.border }]} testID={`${testID}-bar-${barLayout}`}>
        <View style={styles.barSide} testID={`${testID}-bar-left`}>{barLayout === 'leftTitle_rightSearchCrudPanel' ? titleEl : panelEl}</View>
        <View style={[styles.barSide, styles.barRight]} testID={`${testID}-bar-right`}
          onStartShouldSetResponderCapture={(e: any) => { lastPress.current = pressPoint(e); return false; }}>
          {searchEl}
          {barLayout === 'leftTitle_rightSearchCrudPanel' ? panelEl : barLayout === 'leftCrudPanel_rightSearchTitle' ? titleEl : null}
          {moreEl}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }} keyboardShouldPersistTaps="handled"
        onLayout={(e) => { const w = Math.floor(e.nativeEvent.layout.width); if (w !== bodyWidth) setBodyWidth(w); }}>
        <View style={{ minWidth: totalWidth, flex: 1 }}>
          {/* ---- header ---- */}
          <View testID={`${testID}-headers`} style={[styles.row, styles.headerRow, { backgroundColor: headersBackground, borderBottomColor: c.border }]}>
            {serviceColumns.map((kind, i) => (
              <ServiceHeaderCell key={kind} testID={`${testID}-service-header-${kind}`} width={kind === 'select' ? CHECK_W : HANDLE_W}
                // only these two columns can be exchanged, and only with each other
                draggable={dragAndDropColumns && serviceColumns.length === 2} direction={i === 0 ? 1 : -1} onSwap={swapServiceColumns}
                delimiterColor={headerDelimiters ? c.border : undefined}>
                {kind === 'select'
                  ? checkbox(allSelected, toggleAll, `${testID}-select-all`, someSelected)
                  : <Text style={{ color: c.text, opacity: 0.45, fontSize: 14 }}>⠿</Text>}
              </ServiceHeaderCell>
            ))}
            {visualColumns.map((col) => (
              <ReusableTableHeaderCell key={col.key} testID={testID} columnKey={col.key} title={col.title} width={widthOf(col)}
                justify={col.type === 'rowNumber' ? 'center' : justify(col)} colors={c}
                draggable={dragAndDropColumns} resizable={resizeColumnWidth} delimiter={headerDelimiters}
                onDragEnd={onColumnDragEnd} onResize={onColumnResize} onResizeEnd={onColumnResizeEnd}
                onMenu={columnSortAndFilter && isSortFilterColumn(col) ? (key, x, y) => setColumnMenu({ key, x, y }) : undefined}
                sortDirection={columnSort?.key === col.key ? columnSort.direction : null} filtered={isActiveFilter(columnFilters[col.key])} />
            ))}
            {contextMenuEnabled && <View style={{ width: MENU_W }} />}
          </View>

          {/* ---- body ---- */}
          {crud.loading ? (
            <View style={styles.state}><ActivityIndicator color={c.primary} /></View>
          ) : visible.length === 0 ? (
            <View style={styles.state}>
              <Text testID={`${testID}-empty`} style={{ color: c.text, opacity: 0.6 }}>
                {crud.error ? `Could not read the table: ${String(crud.error?.message ?? crud.error)}` : filtered ? 'No matches found.' : emptyText ?? `No ${itemLabel.toLowerCase()}s yet. Press "+ Add".`}
              </Text>
            </View>
          ) : BodyWeb ? (
            <BodyWeb rows={visible} canDrag={canDrag} onMove={crud.moveTo} onRowMenu={openMenu} renderRow={renderRow} handleColor={c.text} testID={testID} />
          ) : (
            visible.map((row, index) => (
              <Pressable key={row.rowGUID} delayLongPress={350} onLongPress={openMenu ? (e: any) => openMenu(row.rowGUID, e?.nativeEvent?.pageX ?? 0, e?.nativeEvent?.pageY ?? 0) : undefined}>
                {renderRow(row, index, { dragHandle: null, isDragging: false, ghost: false })}
              </Pressable>
            ))
          )}

          {/* ---- footer: count + totals of the number columns ---- */}
          <View testID={`${testID}-footer`} style={[styles.row, styles.headerRow, footerAsRow ? { minHeight: rowHeight } : null, { backgroundColor: c.background, borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: c.border }]}>
            {serviceColumns.map((kind) => <View key={kind} style={[styles.serviceCell, delimiterStyle, { width: kind === 'select' ? CHECK_W : HANDLE_W }]} />)}
            {visualColumns.map((col, i) => (
              <View key={col.key} style={[styles.cell, footerAsRow && minimumRows ? styles.cellMinimum : null, delimiterStyle, { width: widthOf(col), justifyContent: numericCols.includes(col) ? (uxuiTable?.justifyTotalsOfFieldsMode === 'justifyTextRight' ? 'flex-end' : 'center') : 'flex-start' }]}>
                {numericCols.includes(col) ? (
                  <Text testID={`${testID}-total-${col.key}`} style={[styles.headerText, { color: c.text }, uxuiTable?.justifyTotalsOfFieldsMode === 'justifyTextRight' ? { paddingRight: 10 } : null]}>{total(col)}</Text>
                ) : i === (visualColumns[0]?.type === 'rowNumber' ? 1 : 0) ? (
                  <Text testID={`${testID}-count`} numberOfLines={1} style={{ color: c.text, opacity: 0.7, fontSize: 13 }}>
                    {filtered ? `${visible.length} of ${rows.length}` : `${rows.length}`} {rows.length === 1 ? itemLabel.toLowerCase() : `${itemLabel.toLowerCase()}s`}
                  </Text>
                ) : null}
              </View>
            ))}
            {contextMenuEnabled && <View style={{ width: MENU_W }} />}
          </View>
        </View>
      </ScrollView>

      <ReusableTableRowMenu menu={menu} rows={rows} crud={crud} itemLabel={itemLabel} reorderEnabled={reorderEnabled} filtered={filtered}
        onDelete={(guid) => askDelete([guid])} onClose={() => setMenu(null)} extraMenuItems={extraMenuItems} testID={testID} />
      {columnMenu && visualColumns.some((col) => col.key === columnMenu.key) && (
        <ReusableTableColumnMenu testID={testID} col={visualColumns.find((col) => col.key === columnMenu.key)!} x={columnMenu.x} y={columnMenu.y}
          sort={columnSort} filter={columnFilters[columnMenu.key]} onSort={setColumnSort}
          onFilter={(f) => setColumnFilters((all) => { const next = { ...all }; if (f) next[columnMenu.key] = f; else delete next[columnMenu.key]; return next; })}
          onClose={() => setColumnMenu(null)} />
      )}
      {barMenu?.kind === 'history' && (
        <PMContextMenu testID={`${testID}-search-history-menu`} x={barMenu.x} y={barMenu.y} caption="Search history" onClose={() => setBarMenu(null)}
          items={[
            ...searchHistory.history.map((h, i): PMMenuItemProps => ({ testID: `${testID}-search-history-${i}`, label: h, icon: 'history', onPress: () => { setBarMenu(null); setSearch(h); searchHistory.remember(h); } })),
            ...(searchHistory.history.length === 0
              ? [{ testID: `${testID}-search-history-empty`, label: 'No searches yet', icon: 'history', disabled: true, onPress: () => {} }]
              : [{ testID: `${testID}-search-history-clear`, label: 'Clear history', icon: 'delete', danger: true, onPress: () => { setBarMenu(null); searchHistory.clear(); } }]),
          ]} />
      )}
      {barMenu?.kind === 'more' && (
        <PMContextMenu testID={`${testID}-more-menu`} x={barMenu.x} y={barMenu.y} onClose={() => setBarMenu(null)}
          items={[
            { testID: `${testID}-more-default-settings`, label: 'Default settings', icon: 'restart_alt', onPress: () => { setBarMenu(null); resetToDefaultSettings(); } },
            { testID: `${testID}-more-export`, label: 'Export', icon: 'download', onPress: () => {},
              submenu: TABLE_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-more-export-${f.format}`, label: f.label, icon: f.icon, onPress: () => { setBarMenu(null); runExport(f.format, false); } })) },
            { testID: `${testID}-more-share`, label: 'Share', icon: 'share', onPress: () => {},
              submenu: TABLE_EXPORT_FORMATS.map((f) => ({ testID: `${testID}-more-share-${f.format}`, label: f.label, icon: f.icon, onPress: () => { setBarMenu(null); runExport(f.format, true); } })) },
          ]} />
      )}
      <AskBeforeDeletePostComponent visible={!!pendingDelete} onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) doDelete(pendingDelete); setPendingDelete(null); }} />
    </View>
  );
  // a fixed px width may be wider than the screen: the whole table scrolls horizontally
  return typeof fixedWidth === 'number' ? (
    <ScrollView horizontal showsHorizontalScrollIndicator testID={`${testID}-fixed-width-scroll`} style={{ flexGrow: 0, width: '100%' }}
      // centered while the screen is wider than the table; scrolls from the left edge when it is narrower
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
      {table}
    </ScrollView>
  ) : table;
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: 10, overflow: 'hidden', alignSelf: 'center' },
  // no padding at the right: the ⋮ box ends exactly where the ⋮ column of the rows ends
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 10, paddingRight: 0, borderBottomWidth: 1 },
  toolbarMinimum: { paddingVertical: 2, paddingLeft: 6 },
  barMore: { width: MENU_W, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { fontSize: 17, fontWeight: '700' },
  barSide: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  barRight: { marginLeft: 'auto', justifyContent: 'flex-end' },
  searchBox: { width: 220 },
  search: { marginBottom: 0, width: '100%' },
  panel: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  btn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { minHeight: 38, borderBottomWidth: 1 },
  cell: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: 6, paddingVertical: 6 },
  serviceCell: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  checkCell: { flex: 1, minWidth: 0 },
  focusMarker: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 1 },
  cellMinimum: { paddingVertical: 1 },
  fixedCell: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerText: { fontSize: 13, fontWeight: '700' },
  box: { width: 18, height: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  boxDash: { width: 9, height: 2, borderRadius: 1, backgroundColor: '#fff' },
  boxRound: { borderRadius: 9 },
  boxSquare: { borderRadius: 4 },
  boxTick: { color: '#fff', fontSize: 12, lineHeight: 14, fontWeight: '900' },
  state: { padding: 28, alignItems: 'center' },
});
