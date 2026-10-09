// TREE.PLUGIN - one row of FolderTreeReusable: indent · chevron · icon · title (or the rename input) · count · ⋮.
// Memoized: every prop is a primitive or a stable callback, so scrolling only mounts the rows that come into view.
import React, { memo, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../common/IconApp';
import { FolderDragPayload } from './folderTreeDnd';
import { useFolderDragSource } from './useFolderDragSource';

export type RowDropState = 'before' | 'after' | 'inside' | 'denied' | null;

export interface FolderTreeRowProps {
  id: string;
  title: string;
  top: number;
  height: number;
  depth: number;
  indent: number;
  hasKids: boolean;
  open: boolean;
  selected: boolean;
  /** pinned rows ("All items", "No folder"): no chevron / menu / rename / drag */
  special?: boolean;
  icon?: string;
  color?: string;
  count?: number | null;
  editing: boolean;
  dropState: RowDropState;
  dragEnabled: boolean;
  /** show ⋮ (there are menu commands) */
  menuEnabled: boolean;
  /** how many rows the tree has (aria) */
  level: number;
  testID: string;
  onToggle: (id: string) => void;
  onPress: (id: string) => void;
  onMenu: (id: string, x: number, y: number) => void;
  onCommitEdit: (id: string, title: string) => void;
  onCancelEdit: () => void;
  onStartEdit: (id: string) => void;
  dragPayload: (id: string) => FolderDragPayload | null;
}

function FolderTreeRow(p: FolderTreeRowProps) {
  const { themeColors: c } = useDesignSystem();
  const { id, special } = p;
  const drag = useFolderDragSource({ enabled: p.dragEnabled && !p.editing && !special, getPayload: () => p.dragPayload(id) });
  const [draft, setDraft] = useState(p.title);
  useEffect(() => { if (p.editing) setDraft(p.title); }, [p.editing, p.title]);
  const done = useRef(false);
  useEffect(() => { done.current = false; }, [p.editing]);

  // web: right-click = the row menu
  useEffect(() => {
    if (Platform.OS !== 'web' || special) return;
    const el: HTMLElement | null = drag.ref.current;
    if (!el?.addEventListener) return;
    const h = (e: MouseEvent) => { e.preventDefault(); p.onMenu(id, e.clientX, e.clientY); };
    el.addEventListener('contextmenu', h);
    return () => el.removeEventListener('contextmenu', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, special, p.onMenu]);

  const commit = () => { if (done.current) return; done.current = true; p.onCommitEdit(id, draft); };
  const cancel = () => { if (done.current) return; done.current = true; p.onCancelEdit(); };

  const bg = p.dropState === 'inside' ? c.primary + '33' : p.dropState === 'denied' ? c.error + '22' : p.selected ? c.primary + '22' : 'transparent';
  const iconName = p.icon ?? (special ? 'folder' : p.hasKids && p.open ? 'folder_open' : 'folder');
  const line = p.dropState === 'before' || p.dropState === 'after';

  return (
    <View
      ref={drag.ref}
      {...drag.props}
      testID={p.testID}
      {...(Platform.OS === 'web' ? ({ 'aria-level': p.level, 'aria-selected': p.selected, 'aria-expanded': p.hasKids ? p.open : undefined, role: 'treeitem', 'data-folder-id': id } as any) : {})}
      style={[styles.row, { top: p.top, height: p.height }, Platform.OS === 'web' && p.dragEnabled && !special ? ({ userSelect: 'none', touchAction: 'pan-y' } as any) : null]}
    >
      <Pressable
        onPress={() => { if (drag.wasDragged()) return; p.onPress(id); }}
        onLongPress={undefined}
        accessibilityRole="button"
        accessibilityState={{ selected: p.selected, expanded: p.hasKids ? p.open : undefined }}
        style={({ hovered }: any) => [styles.fill, { paddingLeft: 4 + p.depth * p.indent, backgroundColor: hovered && !p.selected && p.dropState === null ? c.primary + '0d' : bg }]}
        {...(Platform.OS === 'web' ? ({ onDoubleClick: () => (special ? undefined : p.hasKids ? p.onToggle(id) : p.onStartEdit(id)) } as any) : {})}
      >
        {/* chevron: its own press target, so a tap on the arrow never selects */}
        <Pressable testID={`${p.testID}-toggle`} disabled={!p.hasKids || special} onPress={() => p.onToggle(id)} hitSlop={6} style={styles.chevron}>
          {p.hasKids && !special ? <IconApp name={p.open ? 'expand_more' : 'chevron_right'} size={18} color={c.text} /> : null}
        </Pressable>
        <IconApp name={iconName} size={17} color={p.color ?? (special ? c.text : c.primary)} />
        {p.editing ? (
          <TextInput
            testID={`${p.testID}-input`}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            selectTextOnFocus
            onBlur={commit}
            onSubmitEditing={commit}
            onKeyPress={(e: any) => { if (e?.nativeEvent?.key === 'Escape') cancel(); }}
            style={[styles.input, { color: c.text, borderColor: c.primary, backgroundColor: c.background }]}
          />
        ) : (
          <Text numberOfLines={1} style={[styles.title, { color: c.text, fontWeight: p.selected ? '700' : '500' }]}>{p.title}</Text>
        )}
        {p.count != null && !p.editing && <Text testID={`${p.testID}-count`} style={[styles.count, { color: c.text }]}>{p.count}</Text>}
        {p.menuEnabled && !special && !p.editing && (p.selected || Platform.OS === 'web') && (
          <Pressable testID={`${p.testID}-menu`} hitSlop={6} accessibilityLabel="Folder menu" style={[styles.more, Platform.OS === 'web' && !p.selected ? ({ opacity: 0.45 } as any) : null]}
            onPress={(e: any) => p.onMenu(id, e?.nativeEvent?.pageX ?? 0, e?.nativeEvent?.pageY ?? 0)}>
            <IconApp name="more_vert" size={16} color={c.text} />
          </Pressable>
        )}
      </Pressable>
      {/* drop indicator: a line between rows (before / after) */}
      {line && <View pointerEvents="none" testID={`${p.testID}-drop-${p.dropState}`} style={[styles.dropLine, p.dropState === 'before' ? { top: 0 } : { bottom: 0 }, { backgroundColor: c.primary, left: 4 + p.depth * p.indent }]} />}
      {p.dropState === 'inside' && <View pointerEvents="none" testID={`${p.testID}-drop-inside`} style={[StyleSheet.absoluteFill, styles.dropBox, { borderColor: c.primary }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'absolute', left: 0, right: 0 },
  fill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 },
  chevron: { width: 18, height: 22, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0, fontSize: 13 },
  count: { fontSize: 11, opacity: 0.55, paddingHorizontal: 4 },
  more: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, height: 22, paddingVertical: 0, paddingHorizontal: 4, borderWidth: 1, borderRadius: 4, fontSize: 13 },
  dropLine: { position: 'absolute', right: 4, height: 2, borderRadius: 1 },
  dropBox: { borderWidth: 1.5, borderRadius: 4 },
});

export default memo(FolderTreeRow);
