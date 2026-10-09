// TREE.PLUGIN - the picture that follows the pointer during a folder-tree drag (folder / rows).
// Mount ONE of them where it may float over everything (FolderTreeReusable and ReusableTable do it; a table with a
// tree mounts it itself and tells the tree not to). Web: position fixed at the client coordinates. Native: absolute
// inside this view, which is measured when a drag starts (page coordinates -> local).
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../common/IconApp';
import { measureViewRect, useFolderDragState } from './folderTreeDnd';

export default function FolderTreeDragGhost({ testID = 'folder-tree-ghost' }: { testID?: string }) {
  const { themeColors: c } = useDesignSystem();
  const { payload, x, y } = useFolderDragState();
  const box = useRef<any>(null);
  const [origin, setOrigin] = useState({ left: 0, top: 0 });
  const active = !!payload;
  useEffect(() => {
    if (active && Platform.OS !== 'web') measureViewRect(box.current, (r) => r && setOrigin({ left: r.left, top: r.top }));
  }, [active]);

  const web = Platform.OS === 'web';
  const pill = payload && !payload.ownGhost ? (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        styles.pill,
        { backgroundColor: c.surface, borderColor: c.primary, shadowColor: '#000' },
        web
          ? ({ position: 'fixed', left: x + 14, top: y + 10, zIndex: 100000 } as any)
          : { position: 'absolute', left: x - origin.left + 14, top: y - origin.top + 10 },
      ]}
    >
      <IconApp name={payload.kind === 'folder' ? 'folder' : 'drag_indicator'} size={16} color={c.primary} />
      <Text numberOfLines={1} style={[styles.label, { color: c.text }]}>{payload.label}</Text>
      {payload.kind !== 'folder' && payload.ids.length > 1 && (
        <View style={[styles.badge, { backgroundColor: c.primary }]}><Text style={styles.badgeText}>{payload.ids.length}</Text></View>
      )}
    </View>
  ) : null;
  // native: the measuring view always exists; web: nothing to measure
  return web ? pill : <View ref={box} pointerEvents="none" style={StyleSheet.absoluteFill}>{pill}</View>;
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 260, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, elevation: 8, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  label: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
