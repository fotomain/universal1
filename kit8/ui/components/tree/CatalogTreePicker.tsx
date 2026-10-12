// CatalogTreePicker - pick ONE node of a catalog tree (a modal with FolderTreeReusable, read-only, with a search box). Counterpart of CatalogTreeReusableCRUD:
// the same nodes, but choosing instead of editing.
//   <CatalogTreePicker visible nodes={nodes} value={guid} isSelectable={(id) => ...} reasonWhy={(id) => '...'} onPick={(id) => ...} onClose={...} />
// `isSelectable` decides which nodes can be clicked (a catalog with the SystemMetaData flag `selectFromTree` makes every node selectable, the first level too;
// without it only the leaves). A node that cannot be chosen is greyed in the message line: its `reasonWhy` is shown instead of choosing it.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import FolderTreeReusable from './FolderTreeReusable';
import type { FolderTreeNode } from './folderTreeModel';

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
  /** a "Clear" button (the field may be empty) */
  allowClear?: boolean;
  onPick: (id: string | null) => void;
  onClose: () => void;
  testID?: string;
}

export default function CatalogTreePicker({ visible, nodes, value, title = 'Choose', isSelectable, reasonWhy, allowClear = false, onPick, onClose, testID = 'catalog-tree-picker' }: CatalogTreePickerProps) {
  const { themeColors: c } = useDesignSystem();
  const [message, setMessage] = useState('');
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
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <View style={{ height: 380 }}>
            <FolderTreeReusable
              testID={`${testID}-tree`}
              nodes={shown}
              readOnly
              showHeader={false}
              showAllNode={false}
              showNoneNode={false}
              showSearch
              selectedId={value ?? null}
              onSelect={(id) => select(id)}
              initialExpandDepth={99}
              height={380}
              uxuiFolders={{ alwaysFullHeight: false, commandsInMainFab: false }}
            />
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
  title: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  buttons: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  btn: { paddingHorizontal: 12, paddingVertical: 8 },
});
