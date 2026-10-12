// CatalogTreePicker - pick ONE node of a catalog tree (a modal with FolderTreeReusable, read-only, with a search box). Counterpart of CatalogTreeReusableCRUD:
// the same nodes, but choosing instead of editing.
// The window has a RadioSetApp at its right corner: Tree (default) | List. The list = every item once, as its path, sorted, with the same search and rules.
// The header has the title, expand / collapse and a SEARCH box: a substring of a title (case-insensitive) shows the matches with their ancestors.
//   <CatalogTreePicker visible nodes={nodes} value={guid} isSelectable={(id) => ...} reasonWhy={(id) => '...'} onPick={(id) => ...} onClose={...} />
// `isSelectable` decides which nodes can be clicked (a catalog with the SystemMetaData flag `selectFromTree` makes every node selectable, the first level too;
// without it only the leaves). A node that cannot be chosen is greyed in the message line: its `reasonWhy` is shown instead of choosing it.
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import RadioSetApp from '../RadioSetApp';
import IconApp from '../common/IconApp';
import FolderTreeReusable from './FolderTreeReusable';
import { treePathText, type FolderTreeNode } from './folderTreeModel';

export type CatalogTreePickerView = 'tree' | 'list';
const VIEW_OPTIONS = [{ id: 'tree' as const, label: 'Tree' }, { id: 'list' as const, label: 'List' }];

export interface CatalogTreePickerProps {
  visible: boolean;
  nodes: FolderTreeNode[];
  /** the unit chosen now */
  value?: string | null;
  title?: string;
  /** can this node be chosen? (default: every node) */
  isSelectable?: (id: string) => boolean;
  /** why a node cannot be chosen (shown when it is pressed) */
  reasonWhy?: (id: string) => string;
  /** the nodes' counts (e.g. the sub-nodes of each; the tree adds up the sub-nodes), as in the catalog tree */
  itemCounts?: ReadonlyMap<string, number> | Record<string, number>;
  /** hint of the search box (a substring of a title; the ancestors of every match stay visible) */
  searchPlaceholder?: string;
  /** how the window opens (default 'tree') */
  defaultView?: CatalogTreePickerView;
  /** a "Clear" button (the field may be empty) */
  allowClear?: boolean;
  onPick: (id: string | null) => void;
  onClose: () => void;
  testID?: string;
}

export default function CatalogTreePicker({ visible, nodes, value, title = 'Choose', isSelectable, reasonWhy, allowClear = false, defaultView = 'tree', itemCounts, searchPlaceholder = 'Search…', onPick, onClose, testID = 'catalog-tree-picker' }: CatalogTreePickerProps) {
  const { themeColors: c } = useDesignSystem();
  const [message, setMessage] = useState('');
  const [view, setView] = useState<CatalogTreePickerView>(defaultView);
  const [listQuery, setListQuery] = useState('');
  // List: every item once, as its path, sorted by it; the search is a substring of the path
  const listItems = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return nodes.map((n) => ({ id: n.id, path: treePathText(nodes, n.id) })).filter((x) => !q || x.path.toLowerCase().includes(q)).sort((a, b) => a.path.localeCompare(b.path));
  }, [nodes, listQuery]);
  // the nodes the user cannot choose are shown in grey (a dash in front)
  const shown = useMemo(() => nodes.map((n) => (isSelectable && !isSelectable(n.id) ? { ...n, title: `${n.title}  (not for this choice)` } : n)), [nodes, isSelectable]);
  const select = (id: string) => {
    if (isSelectable && !isSelectable(id)) { setMessage(reasonWhy?.(id) || 'This cannot be chosen here'); return; }
    setMessage('');
    onPick(id);
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID={`${testID}-backdrop`}>
        <Pressable style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => {}} testID={testID}>
          <RadioSetApp<CatalogTreePickerView> testID={`${testID}-view`} options={VIEW_OPTIONS} value={view} onChange={(v) => { setView(v); setMessage(''); }} horizontal style={styles.viewSwitch} />
          <View style={{ height: 420 }}>
            {view === 'tree' ? (
              <FolderTreeReusable
                testID={`${testID}-tree`}
                nodes={shown}
                readOnly
                title={title}
                showHeader
                showToolbar
                searchPlaceholder={searchPlaceholder}
                itemCounts={itemCounts}
                showAllNode={false}
                showNoneNode={false}
                showSearch
                selectedId={value ?? null}
                onSelect={(id) => select(id)}
                initialExpandDepth={99}
                height={420}
                uxuiFolders={{ alwaysFullHeight: false, commandsInMainFab: false }}
              />
            ) : (
              <View style={{ flex: 1 }} testID={`${testID}-list`}>
                <Text numberOfLines={1} style={{ color: c.text, fontWeight: '700', fontSize: 14, marginBottom: 6 }}>{title}  <Text style={{ fontWeight: '400', opacity: 0.6 }}>{listItems.length.toLocaleString()}</Text></Text>
                <View style={[styles.searchRow, { borderColor: c.border }]}>
                  <IconApp name="search" size={15} color={c.text} />
                  <TextInput testID={`${testID}-list-search`} value={listQuery} onChangeText={setListQuery} placeholder={searchPlaceholder} placeholderTextColor={c.text + '88'}
                    style={[styles.search, { color: c.text }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]} autoCorrect={false} autoCapitalize="none" />
                  {listQuery.length > 0 && <Pressable testID={`${testID}-list-search-clear`} hitSlop={8} onPress={() => setListQuery('')}><IconApp name="close" size={15} color={c.text} /></Pressable>}
                </View>
                <FlatList
                  data={listItems}
                  keyExtractor={(x) => x.id}
                  initialNumToRender={40}
                  style={{ flex: 1 }}
                  ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', padding: 16 }}>No items match.</Text>}
                  renderItem={({ item }) => {
                    const chosen = item.id === value;
                    const ok = !isSelectable || isSelectable(item.id);
                    return (
                      <Pressable testID={`${testID}-list-row-${item.id}`} accessibilityRole="button" onPress={() => select(item.id)}
                        style={[styles.listRow, { borderColor: chosen ? c.primary : 'transparent', backgroundColor: chosen ? `${c.primary}15` : 'transparent', opacity: ok ? 1 : 0.45 }]}>
                        <Text numberOfLines={1} style={{ flex: 1, color: chosen ? c.primary : c.text, fontWeight: chosen ? '700' : '400', fontSize: 14 }}>{item.path}</Text>
                        {chosen && <IconApp name="check_circle" size={16} color={c.primary} />}
                      </Pressable>
                    );
                  }}
                />
              </View>
            )}
          </View>
          {!!message && <Text testID={`${testID}-message`} style={{ color: c.error, marginTop: 8, fontSize: 12 }}>{message}</Text>}
          <View style={styles.buttons}>
            {allowClear && (
              <Pressable testID={`${testID}-clear`} onPress={() => onPick(null)} style={styles.btn}>
                <Text style={{ color: c.text }}>Clear</Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable testID={`${testID}-cancel`} onPress={onClose} style={styles.btn}>
              <Text style={{ color: c.primary, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 520, borderRadius: 12, borderWidth: 1, padding: 14 },
  // the Tree | List switch at the right corner
  viewSwitch: { alignSelf: 'flex-end', marginBottom: 0 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, height: 36, marginBottom: 6 },
  search: { flex: 1, minWidth: 0, fontSize: 13, paddingVertical: 0 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 7 },
  buttons: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 8 },
});
