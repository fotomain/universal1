// WithFoldersTreeTable - variant 1 of the Tree view: ONE tree-table. Folders (⊞ / ⊟ + folder icon) open and close, the items are leaf rows (a dash icon); the first
// column carries the tree (Description), the other columns are plain text (Code ...). A press on an item chooses it, on a folder opens / closes it.
// The search keeps the matches with every ancestor, opened.
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { buildTreeIndex, flattenTree } from '../../../ui/components/tree/folderTreeModel';
import { allNodes, searchIds } from './withFoldersModel';
import type { WithFoldersViewProps } from './withFoldersViewTypes';

const INDENT = 20;

export default function WithFoldersTreeTable({ rows, isFolder, titleOf, columns, value, query, onPick, testID }: WithFoldersViewProps) {
  const { themeColors: c } = useDesignSystem();
  const nodes = useMemo(() => allNodes(rows, isFolder, titleOf), [rows, isFolder, titleOf]);
  const index = useMemo(() => buildTreeIndex(nodes), [nodes]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.rowGUID, r])), [rows]);
  // every folder is open at the start (a catalog of folders and items is small); a closed one is a press away
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(rows.filter(isFolder).map((r) => r.rowGUID)));
  useEffect(() => { setExpanded((old) => { const next = new Set(old); for (const r of rows) if (isFolder(r) && !old.has(r.rowGUID) && !next.has(r.rowGUID)) next.add(r.rowGUID); return next; }); }, [rows, isFolder]);
  const found = useMemo(() => searchIds(rows, columns, query), [rows, columns, query]);
  const list = useMemo(() => {
    const mask = found ? Uint8Array.from(nodes, (n) => (found.has(n.id) ? 1 : 0)) : null;
    const flat = flattenTree(index, { expanded, mask });
    return Array.from({ length: flat.length }, (_, k) => ({ row: byId.get(nodes[flat.idx[k]].id)!, depth: flat.depth[k], hasKids: index.childStart[flat.idx[k] + 1] > index.childStart[flat.idx[k]] }));
  }, [index, nodes, expanded, found, byId]);
  const toggle = (id: string) => setExpanded((old) => { const next = new Set(old); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const [first, ...rest] = columns;

  return (
    <View style={{ flex: 1 }} testID={testID}>
      <View style={[styles.head, { borderColor: c.border, backgroundColor: c.border + '30' }]}>
        <Text numberOfLines={1} style={[styles.headCell, { flex: 1, color: c.text }]}>{first?.title}</Text>
        {rest.map((col) => <Text key={col.key} numberOfLines={1} style={[styles.headCell, { width: col.width ?? 120, color: c.text, borderLeftColor: c.border }]}>{col.title}</Text>)}
      </View>
      <FlatList
        data={list}
        keyExtractor={(x) => x.row.rowGUID}
        initialNumToRender={60}
        style={{ flex: 1 }}
        ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', padding: 16 }}>{found ? 'No items match.' : 'Nothing to choose.'}</Text>}
        renderItem={({ item }) => {
          const { row, depth, hasKids } = item;
          const folder = isFolder(row);
          const open = expanded.has(row.rowGUID) || !!found;
          const chosen = row.rowGUID === value;
          return (
            <Pressable
              testID={`${testID}-row-${row.rowGUID}`}
              accessibilityRole="button"
              onPress={() => (folder ? toggle(row.rowGUID) : onPick(row))}
              style={[styles.row, { borderColor: c.border + '55', backgroundColor: chosen ? c.primary + '22' : folder ? c.border + '14' : 'transparent' }]}
            >
              <View style={[styles.cell, { flex: 1, paddingLeft: 6 + depth * INDENT }]}>
                <Pressable testID={`${testID}-toggle-${row.rowGUID}`} disabled={!folder || !hasKids} onPress={() => toggle(row.rowGUID)} hitSlop={6} style={styles.box}>
                  {folder && hasKids ? <IconApp name={open ? 'indeterminate_check_box' : 'add_box'} size={16} color={c.text} /> : null}
                </Pressable>
                <IconApp name={folder ? (open && hasKids ? 'folder_open' : 'folder') : 'remove'} size={folder ? 18 : 16} color={folder ? '#e0a526' : c.primary} />
                <Text numberOfLines={1} style={{ flex: 1, color: chosen ? c.primary : c.text, fontWeight: chosen || folder ? '700' : '400', fontSize: 14 }}>{first?.text(row)}</Text>
              </View>
              {rest.map((col) => <Text key={col.key} numberOfLines={1} style={[styles.cell, { width: col.width ?? 120, color: c.text, opacity: 0.8, fontSize: 13, borderLeftColor: c.border + '55' }]}>{folder ? '' : col.text(row)}</Text>)}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', borderWidth: 1 },
  headCell: { fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 7, borderLeftWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 34 },
  cell: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8, borderLeftWidth: StyleSheet.hairlineWidth },
  box: { width: 18, height: 22, alignItems: 'center', justifyContent: 'center' },
});
