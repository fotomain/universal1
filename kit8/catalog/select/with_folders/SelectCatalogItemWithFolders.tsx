// SelectCatalogItemWithFolders - choose ONE item of a catalog of FOLDERS and ITEMS (budget items, management genus, products ...): a field (SelectFieldBox) that opens a
// window with a RadioSetApp at its top right corner: Tree | List, and a search box (a substring of any cell).
// The views (prop `views`, the radio offers them in this order; default ['tree', 'list']):
//   'tree'  = Tree: ONE tree-table, folders open / close, items are the leaf rows, columns Description + Code (WithFoldersTreeTable)
//   'split' = Tree + items: the folders tree on the full left side, the table of the items of the picked branch on the right (WithFoldersSplit)
//   'list'  = List: every item once, flat cards with the folder path (WithFoldersList)
// The window opens as the LIST on a small width (< WITH_FOLDERS_SMALL_WIDTH, a phone) and as the first view otherwise; `defaultView` forces one.
//   <SelectCatalogItemWithFolders rows={budgetItemRows} isFolder={isBudgetItemFolder} filterItem={(r) => r.rowJSON.managementGenusItem === genus} value={guid} onChange={(guid, row) => ...} />
// Only an item can be chosen; `filterItem` leaves out the items that do not fit (and the folders that hold none of them). `columns`: the cells of the tables (default Description + Code).
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View, Platform } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import RadioSetApp from '../../../ui/components/RadioSetApp';
import type { DefRow } from '../../product/productModel';
import SelectFieldBox from '../SelectFieldBox';
import WithFoldersList from './WithFoldersList';
import WithFoldersSplit from './WithFoldersSplit';
import WithFoldersTreeTable from './WithFoldersTreeTable';
import { DEFAULT_WITH_FOLDERS_COLUMNS, defaultIsFolder, rowTitleText, visibleRows, WITH_FOLDERS_SMALL_WIDTH, type WithFoldersColumn } from './withFoldersModel';

export type WithFoldersView = 'tree' | 'split' | 'list';
const VIEW_LABEL: Record<WithFoldersView, string> = { tree: 'Tree', split: 'Tree + items', list: 'List' };
const DEFAULT_VIEWS: WithFoldersView[] = ['tree', 'list'];

export interface SelectCatalogItemWithFoldersProps {
  /** every row of the catalog (folders and items) */
  rows: DefRow<any>[];
  /** the rowGUID of the item chosen now */
  value?: string | null;
  onChange: (guid: string | null, row?: DefRow<any> | null) => void;
  /** is this row a folder? (default: a top level row, or a row that has sub-rows) */
  isFolder?: (row: DefRow<any>) => boolean;
  /** which items are offered (default: all); the folders without any of them are hidden */
  filterItem?: (row: DefRow<any>) => boolean;
  /** the text of a row (default rowJSON.title) and the details line of the List (default: the folder path) */
  titleOf?: (row: DefRow<any>) => string;
  subtitleOf?: (row: DefRow<any>) => string | undefined;
  /** the cells of the tables: the first one carries the tree (default Description + Code) */
  columns?: WithFoldersColumn[];
  /** the views the RadioSetApp offers, in this order (default ['tree', 'list']; a product adds 'split': the folders on the left, the items of the branch on the right) */
  views?: WithFoldersView[];
  /** force the view the window opens with (default: List on a small width, the first view otherwise) */
  defaultView?: WithFoldersView;
  /** label above the field (not in a table cell) and the title of the window (default: the label) */
  label?: string;
  title?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  error?: string;
  icon?: string;
  compact?: boolean;
  triggerStyle?: any;
  testID?: string;
}

export default function SelectCatalogItemWithFolders({
  rows, value, onChange, isFolder, filterItem, titleOf = rowTitleText, subtitleOf, columns = DEFAULT_WITH_FOLDERS_COLUMNS, views = DEFAULT_VIEWS, defaultView, label, title,
  placeholder = 'Select…', searchPlaceholder = 'Find…', allowClear = true, disabled = false, error, icon = 'folder_open', compact = false, triggerStyle, testID = 'select-catalog-item-with-folders',
}: SelectCatalogItemWithFoldersProps) {
  const [open, setOpen] = useState(false);
  // only the chosen row is looked up while the window is closed: a table has one field per line, the folders / items are worked out when the window opens
  const chosen = value ? rows.find((r) => r.rowGUID === value) : undefined;
  const text = chosen ? titleOf(chosen) : '';
  return (
    <SelectFieldBox
      text={text} placeholder={placeholder} label={label} accessibilityLabel={title} icon={icon} allowClear={allowClear} disabled={disabled} error={error} compact={compact} triggerStyle={triggerStyle}
      onOpen={() => setOpen(true)} onClear={() => onChange(null, null)} testID={testID}
    >
      {open && (
        <WithFoldersWindow
          rows={rows} value={value} isFolder={isFolder} filterItem={filterItem} titleOf={titleOf} subtitleOf={subtitleOf} columns={columns} views={views} defaultView={defaultView}
          title={title ?? label ?? 'Select'} searchPlaceholder={searchPlaceholder} testID={testID}
          onPick={(row) => { setOpen(false); onChange(row.rowGUID, row); }} onClose={() => setOpen(false)}
        />
      )}
    </SelectFieldBox>
  );
}

/** the window (mounted while it is open): Tree | List, the search box, the view */
function WithFoldersWindow({ rows, value, isFolder: isFolderProp, filterItem, titleOf, subtitleOf, columns, views, defaultView, title, searchPlaceholder, testID, onPick, onClose }: {
  rows: DefRow<any>[]; value?: string | null; isFolder?: (row: DefRow<any>) => boolean; filterItem?: (row: DefRow<any>) => boolean; titleOf: (row: DefRow<any>) => string;
  subtitleOf?: (row: DefRow<any>) => string | undefined; columns: WithFoldersColumn[]; views: WithFoldersView[]; defaultView?: WithFoldersView; title: string; searchPlaceholder: string;
  testID: string; onPick: (row: DefRow<any>) => void; onClose: () => void;
}) {
  const { themeColors: c } = useDesignSystem();
  const { width } = useWindowDimensions();
  const [view, setView] = useState<WithFoldersView>(() => defaultView ?? (width < WITH_FOLDERS_SMALL_WIDTH && views.includes('list') ? 'list' : views[0] ?? 'tree'));
  const options = useMemo(() => views.map((v) => ({ id: v, label: VIEW_LABEL[v] })), [views]);
  const [query, setQuery] = useState('');
  const isFolder = useMemo(() => isFolderProp ?? defaultIsFolder(rows), [isFolderProp, rows]);
  const shown = useMemo(() => visibleRows(rows, isFolder, filterItem), [rows, isFolder, filterItem]);
  const viewProps = { rows: shown, isFolder, titleOf, subtitleOf, columns, value, query, onPick };
  const wide = width >= WITH_FOLDERS_SMALL_WIDTH;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`}>
        <Pressable style={[styles.card, wide ? styles.cardWide : styles.cardNarrow, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}} testID={`${testID}-window`}>
          <View style={styles.top}>
            <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>{title}</Text>
            <RadioSetApp<WithFoldersView> testID={`${testID}-view`} options={options} value={view} onChange={setView} horizontal style={styles.viewSwitch} />
          </View>
          <View style={[styles.searchRow, { borderColor: c.border }]}>
            <IconApp name="search" size={16} color={c.text} />
            <TextInput testID={`${testID}-search`} value={query} onChangeText={setQuery} placeholder={searchPlaceholder} placeholderTextColor={c.text + '88'}
              style={[styles.search, { color: c.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} autoCorrect={false} autoCapitalize="none" />
            {query.length > 0 && <Pressable testID={`${testID}-search-clear`} hitSlop={8} onPress={() => setQuery('')}><IconApp name="close" size={16} color={c.text} /></Pressable>}
          </View>
          <View style={styles.body}>
            {view === 'list' ? <WithFoldersList {...viewProps} testID={`${testID}-list`} />
              : view === 'split' ? <WithFoldersSplit {...viewProps} testID={`${testID}-split`} />
                : <WithFoldersTreeTable {...viewProps} testID={`${testID}-tree`} />}
          </View>
          <View style={styles.buttons}>
            <View style={{ flex: 1 }} />
            <Pressable testID={`${testID}-cancel`} onPress={onClose} style={styles.btn}><Text style={{ color: c.primary, fontWeight: '700' }}>Cancel</Text></Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, height: 540, maxHeight: '96%' },
  cardWide: { width: '100%', maxWidth: 760 },
  cardNarrow: { width: '100%' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '800' },
  // the Tree | List switch at the right corner
  viewSwitch: { marginBottom: -8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 40, marginBottom: 8 },
  search: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 0 },
  body: { flex: 1, minHeight: 0 },
  buttons: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 8 },
});
