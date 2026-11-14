// ReusableList - the default item, built from the columns (listRole: title / subtitle / meta / badge). Display only: no input is mounted per item
// (the edit card or onRowOpen edits). No state of its own that a recycled cell could leak: selection and "dragged" come from stores, per row.
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReusableTableRow, VisualColumn } from '../../table/reusable/reusableTableTypes';
import type { CatalogTitleFn } from '../../table/reusable/tableFilter';
import { displayText } from '../../table/reusable/tableRows';
import ReorderHandle, { GRIP_WIDTH } from './ReorderHandle';
import type { ReorderController } from './reorderController';
import { DragStore, SelectionStore, useIsDragged, useIsSelected } from './listStores';
import type { ListRoles } from './reusableListTypes';

export interface ReusableListItemColors { text: string; border: string; primary: string; background: string }

/** everything the items share (one object, so a memoized item re-renders only when its row changes) */
export interface ReusableListItemContext {
  itemHeight: number;
  columns: VisualColumn[];
  roles: ListRoles;
  catalogTitle: CatalogTitleFn;
  selection: SelectionStore;
  drag: DragStore;
  controller: ReorderController | null;
  selectionEnabled: boolean;
  menuEnabled: boolean;
  dividers: boolean;
  rounded: boolean;
  colors: ReusableListItemColors;
  onPress: (row: ReusableTableRow) => void;
  onMenu: (guid: string, x: number, y: number) => void;
  testID: string;
}

interface Props { row: ReusableTableRow; index: number; ctx: ReusableListItemContext; reorderable: boolean }

const textOf = (row: ReusableTableRow, col: VisualColumn | null, ctx: ReusableListItemContext) => (col ? displayText(row, col, ctx.catalogTitle) : '');

function ReusableListItem({ row, index, ctx, reorderable }: Props) {
  const { colors: c, roles, itemHeight } = ctx;
  const guid = row.rowGUID;
  const selected = useIsSelected(ctx.selection, guid);
  const dragged = useIsDragged(ctx.drag, guid);
  const title = textOf(row, roles.title, ctx);
  const subtitle = textOf(row, roles.subtitle, ctx);
  const meta = roles.meta.map((col) => textOf(row, col, ctx)).filter(Boolean).join(' · ');
  const badges = roles.badge.map((col) => textOf(row, col, ctx)).filter(Boolean);
  const open = (e: any, fromMenuButton = false) => ctx.onMenu(guid, e?.nativeEvent?.pageX ?? 0, e?.nativeEvent?.pageY ?? 0);
  const webMenu = Platform.OS === 'web' && ctx.menuEnabled ? ({ onContextMenu: (e: any) => { e.preventDefault?.(); ctx.onMenu(guid, e.clientX ?? e.nativeEvent?.pageX ?? 0, e.clientY ?? e.nativeEvent?.pageY ?? 0); } } as any) : null;
  return (
    <Pressable
      testID={`${ctx.testID}-item-${guid}`}
      onPress={() => ctx.onPress(row)}
      onLongPress={ctx.menuEnabled ? open : undefined}
      delayLongPress={350}
      {...webMenu}
      style={[
        styles.item,
        { height: itemHeight, borderBottomColor: c.border, borderBottomWidth: ctx.dividers ? StyleSheet.hairlineWidth : 0, backgroundColor: selected ? c.primary + '1f' : c.background, opacity: dragged ? 0.25 : 1 },
        ctx.rounded ? { borderRadius: 12, marginHorizontal: 6 } : null,
      ]}
    >
      {reorderable && ctx.controller ? <ReorderHandle testID={`${ctx.testID}-grip-${guid}`} controller={ctx.controller} guid={guid} index={index} color={c.text} height={itemHeight} /> : null}
      {ctx.selectionEnabled ? (
        <Pressable testID={`${ctx.testID}-check-${guid}`} accessibilityRole="checkbox" aria-checked={selected} hitSlop={8} onPress={() => ctx.selection.toggle(guid)}
          style={[styles.box, { borderColor: selected ? c.primary : c.text + '66', backgroundColor: selected ? c.primary : 'transparent' }]}>
          {selected ? <Text style={styles.tick}>✓</Text> : null}
        </Pressable>
      ) : null}
      <View style={styles.body}>
        <Text numberOfLines={1} testID={`${ctx.testID}-title-${guid}`} style={[styles.title, { color: c.text }]}>{title || '—'}</Text>
        {subtitle ? <Text numberOfLines={1} style={[styles.sub, { color: c.text }]}>{subtitle}</Text> : null}
        {meta ? <Text numberOfLines={1} style={[styles.meta, { color: c.text }]}>{meta}</Text> : null}
      </View>
      {badges.length > 0 ? (
        <View style={styles.badges}>{badges.slice(0, 2).map((b, i) => <Text key={i} numberOfLines={1} style={[styles.badge, { color: c.primary, borderColor: c.primary }]}>{b}</Text>)}</View>
      ) : null}
      {ctx.menuEnabled ? (
        <Pressable testID={`${ctx.testID}-itemmenu-${guid}`} accessibilityLabel="Menu" hitSlop={6} onPress={(e: any) => open(e, true)} style={styles.menuButton}>
          <Text style={{ color: c.text, fontSize: 20, opacity: 0.7 }}>⋮</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', paddingRight: 4, overflow: 'hidden' },
  box: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  body: { flex: 1, minWidth: 0, paddingHorizontal: 8, justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 13, opacity: 0.75, marginTop: 1 },
  meta: { fontSize: 12, opacity: 0.55, marginTop: 1 },
  badges: { alignItems: 'flex-end', maxWidth: 110, gap: 2, marginRight: 4 },
  badge: { fontSize: 11, fontWeight: '600', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  menuButton: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
});

export { GRIP_WIDTH };
export default React.memo(ReusableListItem);
