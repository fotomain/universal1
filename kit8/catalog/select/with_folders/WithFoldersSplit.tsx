// WithFoldersSplit - variant 2 of the Tree view: the FOLDERS tree on the left, the TABLE of the items of the picked folder (sub-folders included) on the right.
// "All" = every item, "No folder" = the items at the top level. A press on an item chooses it. On a narrow window the two stack (tree above, table below).
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import FolderTreeReusable from '../../../ui/components/tree/FolderTreeReusable';
import { TREE_ALL_ID, TREE_NONE_ID } from '../../../ui/components/tree/folderTreeModel';
import { folderNodes, itemsInFolder, rowMatches, shownColumns, WITH_FOLDERS_NONE, WITH_FOLDERS_SMALL_WIDTH } from './withFoldersModel';
import type { WithFoldersViewProps } from './withFoldersViewTypes';

export default function WithFoldersSplit({ rows, isFolder, titleOf, columns, value, query, onPick, testID }: WithFoldersViewProps) {
  const { themeColors: c } = useDesignSystem();
  const { width } = useWindowDimensions();
  const narrow = width < WITH_FOLDERS_SMALL_WIDTH;
  const shown = useMemo(() => shownColumns(columns), [columns]);
  const [folder, setFolder] = useState<string | null>(null);
  const nodes = useMemo(() => folderNodes(rows, isFolder, titleOf), [rows, isFolder, titleOf]);
  // the items of each folder (direct) for the counts beside the folders
  const counts = useMemo(() => { const m = new Map<string, number>(); for (const r of rows) if (!isFolder(r)) m.set(r.rowParentGUID, (m.get(r.rowParentGUID) ?? 0) + 1); return m; }, [rows, isFolder]);
  // "No folder": the items at the top level (a product without a folder); the row is there only while there are such items
  const loose = useMemo(() => itemsInFolder(rows, isFolder, WITH_FOLDERS_NONE).length, [rows, isFolder]);
  const items = useMemo(() => itemsInFolder(rows, isFolder, folder).filter((r) => rowMatches(r, columns, query)), [rows, isFolder, folder, columns, query]);

  return (
    <View style={{ flex: 1, flexDirection: narrow ? 'column' : 'row', gap: 8 }} testID={testID}>
      <View style={[styles.left, narrow ? { height: 170 } : { width: '38%' }, { borderColor: c.border }]}>
        <FolderTreeReusable
          testID={`${testID}-folders`}
          nodes={nodes}
          readOnly
          title="Group"
          showToolbar={false}
          showSearch={false}
          showAllNode
          allLabel="All"
          totalCount={rows.filter((r) => !isFolder(r)).length}
          itemCounts={counts}
          showNoneNode={loose > 0}
          noneLabel="No folder"
          noneCount={loose}
          selectedId={folder === WITH_FOLDERS_NONE ? TREE_NONE_ID : folder ?? TREE_ALL_ID}
          onSelect={(id) => setFolder(id === TREE_ALL_ID ? null : id === TREE_NONE_ID ? WITH_FOLDERS_NONE : id)}
          initialExpandDepth={99}
          uxuiFolders={{ alwaysFullHeight: false, commandsInMainFab: false }}
        />
      </View>
      <View style={[styles.right, { borderColor: c.border }]} testID={`${testID}-table`}>
        <View style={[styles.head, { backgroundColor: c.border + '30', borderBottomColor: c.border }]}>
          {shown.map((col, i) => <Text key={col.key} numberOfLines={1} style={[styles.headCell, i === 0 ? { flex: 1 } : { width: col.width ?? 120 }, { color: c.text, borderLeftColor: c.border }]}>{col.title}</Text>)}
        </View>
        <FlatList
          data={items}
          keyExtractor={(r) => r.rowGUID}
          initialNumToRender={60}
          style={{ flex: 1 }}
          ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', padding: 16 }}>No items.</Text>}
          renderItem={({ item: r }) => {
            const chosen = r.rowGUID === value;
            return (
              <Pressable testID={`${testID}-item-${r.rowGUID}`} accessibilityRole="button" onPress={() => onPick(r)} style={[styles.row, { borderBottomColor: c.border + '55', backgroundColor: chosen ? c.primary + '22' : 'transparent' }]}>
                {shown.map((col, i) => (
                  <Text key={col.key} numberOfLines={1} style={[styles.cellText, i === 0 ? { flex: 1, fontWeight: chosen ? '700' : '500', color: chosen ? c.primary : c.text } : { width: col.width ?? 120, color: c.text, opacity: 0.8 }]}>{col.text(r)}</Text>
                ))}
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  left: { borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  right: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 6, overflow: 'hidden' },
  head: { flexDirection: 'row', borderBottomWidth: 1 },
  headCell: { fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 7, borderLeftWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 34 },
  cellText: { fontSize: 13.5, paddingHorizontal: 8, paddingVertical: 7 },
});
