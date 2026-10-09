// TREE.PLUGIN - FolderTree200k: the big-data demo of FolderTreeReusable (route /demo/foldertree).
//   left   200 000 folders (pick 1k ... 500k): expand / collapse, search, create / rename / delete / duplicate, drag a
//          folder to reorder it or to nest it (hover over a closed folder opens it, near the edge the list scrolls)
//   right  200 000 products in a virtualized list: drag the ⠿ grip (or several checked products) onto a folder
//          or onto "No folder"; counts per folder (with subfolders) follow at once; click a folder = filter the products
// Everything is in memory: nothing is saved.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../common/IconApp';
import FolderTreeDragGhost from './FolderTreeDragGhost';
import FolderTreeReusable, { FolderTreeHandle } from './FolderTreeReusable';
import { FolderDragPayload } from './folderTreeDnd';
import { generateFolderNodes, generateProducts } from './folderTreeDemoData';
import { buildTreeIndex, countItemsByFolder, subtreeIds, TREE_ALL_ID, TREE_NONE_ID } from './folderTreeModel';
import { useFolderDragSource } from './useFolderDragSource';
import { useLocalFolderTree } from './useLocalFolderTree';

const SIZES = [1_000, 10_000, 50_000, 200_000, 500_000];
const ROW_H = 30;
const fmt = (n: number) => n.toLocaleString('en-US');

interface ProductRowProps { id: string; title: string; folderTitle: string; checked: boolean; getPayload: (id: string) => FolderDragPayload | null; onToggle: (id: string) => void }

const ProductRow = React.memo(function ProductRow({ id, title, folderTitle, checked, getPayload, onToggle }: ProductRowProps) {
  const { themeColors: c } = useDesignSystem();
  const drag = useFolderDragSource({ mode: 'handle', getPayload: () => getPayload(id) });
  return (
    <View testID={`ft200k-product-${id}`} style={[styles.productRow, { borderBottomColor: c.border, backgroundColor: checked ? c.primary + '18' : 'transparent' }]}>
      <View ref={drag.ref} {...drag.props} testID={`ft200k-grip-${id}`} style={[styles.grip, Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any) : null]}>
        <Text style={{ color: c.text, opacity: 0.55, fontSize: 16 }}>⠿</Text>
      </View>
      <Pressable onPress={() => onToggle(id)} style={styles.productMain} accessibilityRole="checkbox" aria-checked={checked}>
        <View style={[styles.box, { borderColor: checked ? c.primary : c.text + '66', backgroundColor: checked ? c.primary : 'transparent' }]}>
          {checked ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 13 }}>{title}</Text>
        <Text numberOfLines={1} style={{ width: 150, color: c.text, opacity: 0.55, fontSize: 12 }}>{folderTitle}</Text>
      </Pressable>
    </View>
  );
});

export default function FolderTree200k() {
  const { themeColors: c } = useDesignSystem();
  const { width, height } = useWindowDimensions();
  const wide = width >= 900;
  const panelH = Math.max(380, wide ? height - 230 : (height - 260) / 2);

  const [size, setSize] = useState(200_000);
  const [busy, setBusy] = useState(false);
  const { nodes, setNodes, treeProps } = useLocalFolderTree(() => generateFolderNodes(200_000));
  const [data, setData] = useState(() => generateProducts(200_000, 200_000));
  const [selectedId, setSelectedId] = useState<string>(TREE_ALL_ID);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState('Drag a ⠿ grip onto a folder · drag a folder to move it · right-click a folder for its menu');
  const tree = useRef<FolderTreeHandle>(null);

  const timing = useRef(0);
  const index = useMemo(() => {
    const t0 = Date.now();
    const ix = buildTreeIndex(nodes);
    timing.current = Date.now() - t0;
    return ix;
  }, [nodes]);

  // products per folder id (direct) - the tree adds up the subfolders
  const direct = useMemo(() => countItemsByFolder(data.folderOf, (f) => (f && index.idToIdx.has(f) ? f : null)), [data.folderOf, index]);
  const noneCount = direct.get('empty') ?? 0;

  // products shown: the selected folder and everything below it
  const shown = useMemo(() => {
    const out: number[] = [];
    const { folderOf } = data;
    if (selectedId === TREE_ALL_ID) { for (let i = 0; i < folderOf.length; i++) out.push(i); return out; }
    if (selectedId === TREE_NONE_ID) { for (let i = 0; i < folderOf.length; i++) if (!folderOf[i] || !index.idToIdx.has(folderOf[i] as string)) out.push(i); return out; }
    const at = index.idToIdx.get(selectedId);
    if (at === undefined) return out;
    const set = new Set(subtreeIds(index, at));
    for (let i = 0; i < folderOf.length; i++) if (set.has(folderOf[i] as string)) out.push(i);
    return out;
  }, [data, selectedId, index]);

  const titleOfFolder = useCallback((id: string | null) => {
    const i = id ? index.idToIdx.get(id) : undefined;
    return i === undefined ? 'No folder' : index.nodes[i].title;
  }, [index]);

  const toggleChecked = useCallback((id: string) => setChecked((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; }), []);
  const checkedRef = useRef(checked);
  checkedRef.current = checked;
  const productsRef = useRef(data.products);
  productsRef.current = data.products;
  const getPayload = useCallback((id: string): FolderDragPayload | null => {
    const ids = checkedRef.current.has(id) ? Array.from(checkedRef.current) : [id];
    const first = productsRef.current[Number(id.slice(1))];
    return { kind: 'items', ids, label: ids.length > 1 ? `${ids.length} products` : first?.title ?? id, source: 'ft200k-products' };
  }, []);

  const onDropItems = useCallback((folderId: string | null, payload: FolderDragPayload) => {
    setData((prev) => {
      const folderOf = prev.folderOf.slice();
      for (const pid of payload.ids) folderOf[Number(pid.slice(1))] = folderId;
      return { products: prev.products, folderOf };
    });
    setMessage(`${fmt(payload.ids.length)} product${payload.ids.length === 1 ? '' : 's'} → ${folderId ? titleOfFolder(folderId) : 'No folder'}`);
    setChecked(new Set());
  }, [titleOfFolder]);

  // a deleted folder: its products have no folder any more
  const onDelete = useCallback((ids: string[], rootId: string) => {
    treeProps.onDelete(ids);
    const gone = new Set(ids);
    setData((prev) => ({ products: prev.products, folderOf: prev.folderOf.map((f) => (f && gone.has(f) ? null : f)) }));
    setMessage(`Deleted ${fmt(ids.length)} folder${ids.length === 1 ? '' : 's'} (${titleOfFolder(rootId)}…) - their products are in "No folder" now`);
  }, [treeProps, titleOfFolder]);

  const generate = (n: number) => {
    setSize(n);
    setBusy(true);
    // let the spinner paint before the (synchronous) generator runs
    setTimeout(() => {
      setNodes(generateFolderNodes(n));
      setData(generateProducts(200_000, n));
      setSelectedId(TREE_ALL_ID);
      setChecked(new Set());
      setBusy(false);
      setMessage(`${fmt(n)} folders and ${fmt(200_000)} products generated`);
    }, 30);
  };

  const renderProduct = useCallback(({ item }: { item: number }) => {
    const p = data.products[item];
    return <ProductRow id={p.id} title={p.title} folderTitle={titleOfFolder(data.folderOf[item])} checked={checked.has(p.id)} getPayload={getPayload} onToggle={toggleChecked} />;
  }, [data, titleOfFolder, checked, getPayload, toggleChecked]);

  const chip = (label: string, active: boolean, onPress: () => void, testID: string) => (
    <Pressable key={testID} testID={testID} onPress={onPress} style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + '1c' : c.surface }]}>
      <Text style={{ color: active ? c.primary : c.text, fontSize: 12, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID="folder-tree-200k" style={[styles.root, { backgroundColor: c.background }]}>
      <View style={styles.head}>
        <IconApp name="account_tree" size={22} color={c.primary} />
        <Text style={[styles.h1, { color: c.text }]}>Folder tree · {fmt(nodes.length)} folders · {fmt(data.products.length)} products</Text>
        <Text testID="ft200k-stats" style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>index built in {timing.current} ms{busy ? ' · generating…' : ''}</Text>
      </View>
      <View style={styles.controls}>
        <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>Folders:</Text>
        {SIZES.map((n) => chip(fmt(n), size === n, () => generate(n), `ft200k-size-${n}`))}
        <View style={{ width: 12 }} />
        {chip('Expand all', false, () => tree.current?.expandAll(), 'ft200k-expand-all')}
        {chip('Collapse all', false, () => tree.current?.collapseAll(), 'ft200k-collapse-all')}
        {chip('Go to a random folder', false, () => tree.current?.reveal(`f${Math.floor(Math.random() * nodes.length)}`), 'ft200k-random')}
      </View>
      <Text testID="ft200k-message" numberOfLines={2} style={{ color: c.text, opacity: 0.75, fontSize: 12, marginBottom: 8 }}>{message}</Text>

      <View style={[styles.panels, { flexDirection: wide ? 'row' : 'column' }]}>
        <View style={{ width: wide ? 380 : '100%', height: panelH }}>
          <FolderTreeReusable
            ref={tree}
            testID="ft200k-tree"
            nodes={nodes}
            index={index}
            title="Folders"
            height={panelH}
            showAllNode
            showNoneNode
            selectedId={selectedId}
            onSelect={setSelectedId}
            itemCounts={direct}
            totalCount={data.products.length}
            noneCount={noneCount}
            onCreate={treeProps.onCreate}
            onRename={treeProps.onRename}
            onMove={treeProps.onMove}
            onDelete={onDelete}
            onDropItems={onDropItems}
            deleteHint="Their products get no folder."
            onMessage={setMessage}
            dragGhost={false}
          />
        </View>
        <View style={[styles.products, { borderColor: c.border, backgroundColor: c.surface, height: panelH }]}>
          <View style={[styles.productsHead, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>Products</Text>
            <Text testID="ft200k-shown" style={{ color: c.text, opacity: 0.6, fontSize: 12 }}>{fmt(shown.length)} shown · {checked.size} checked</Text>
          </View>
          <FlatList
            testID="ft200k-products"
            data={shown}
            keyExtractor={(i) => String(i)}
            renderItem={renderProduct}
            extraData={checked}
            getItemLayout={(_d, i) => ({ length: ROW_H, offset: ROW_H * i, index: i })}
            initialNumToRender={30}
            windowSize={9}
            maxToRenderPerBatch={30}
            removeClippedSubviews
            ListEmptyComponent={<Text style={{ color: c.text, opacity: 0.6, padding: 20, textAlign: 'center' }}>No products here.</Text>}
          />
        </View>
      </View>
      <FolderTreeDragGhost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  h1: { fontSize: 18, fontWeight: '800' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  panels: { flex: 1, gap: 12, minHeight: 0 },
  products: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  productsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  productRow: { height: ROW_H, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  grip: { width: 32, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  productMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 10, height: ROW_H },
  box: { width: 16, height: 16, borderWidth: 2, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  tick: { color: '#fff', fontSize: 11, lineHeight: 13, fontWeight: '900' },
});
