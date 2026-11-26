// The card of ONE project in the Projects list (ReusableList `renderItem`): the name, the "Viewing" and progress badges, the dates, the Dashboard button and the gear (Project settings).
// What every list card has comes from the LIST, not from here: the three dots menu at the top right, the FAB at the bottom right (commands of the card), the swipe (archive / delete),
// the ⠿ grip + the Archive mark (left edge). So this card draws no ⋮ / delete / copy of its own. A fixed height (the list recycles its cells).
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { ReusableListItemState } from '../../ui/components/list/reusable/reusableListTypes';
import type { ReusableTableRow } from '../../ui/components/table/reusable/reusableTableTypes';
import type { SwipeInset } from '../../ui/components/list/reusable/swipeModel';
import { usePMStore } from '../../pm/store/store_pm';
import { formatDateShort } from '../../pm/view/project/scheduling';

/** height of one item (the card + the gap above / below it) */
export const PROJECT_CARD_ITEM_HEIGHT = 120;
/** the card sits inside its item with this margin / corner radius: the swipe buttons and the list's ⋮ / FAB follow it */
export const PROJECT_CARD_INSET: SwipeInset = { x: 8, y: 4, radius: 12 };

/** the text under the name: "13 Oct – 20 Nov", or only the start, or "Dates not set" */
export function projectDateRange(row: ReusableTableRow): string {
  const start = row.rowJSON?.projectStartAt ? formatDateShort(Date.parse(row.rowJSON.projectStartAt)) : null;
  const finish = row.rowDuration ? formatDateShort(Date.parse(row.rowDuration)) : null;
  return start && finish ? `${start} – ${finish}` : start || 'Dates not set';
}

export interface ProjectCardForListProps {
  row: ReusableTableRow;
  /** what the list gives its card (grip, archived, actions ...) */
  state: ReusableListItemState;
  /** the card was pressed: the project is selected for the Gantt preview */
  onSelect?: (projectGUID: string) => void;
  onDashboard?: (projectGUID: string) => void;
  onSettings?: (projectGUID: string) => void;
  testID?: string;
}

export default function ProjectCardForList({ row, state, onSelect, onDashboard, onSettings, testID }: ProjectCardForListProps) {
  const { themeColors: c } = useDesignSystem();
  const id = row.rowGUID;
  const j = row.rowJSON || {};
  const isCurrent = usePMStore((s) => s.selectedProjectGUID) === id;
  const progress = Math.round(row.rowProgress ?? 0);
  const dateRange = projectDateRange(row);

  return (
    <View testID={testID || `project-card-${id}`} style={[styles.outer, { height: PROJECT_CARD_ITEM_HEIGHT, paddingHorizontal: PROJECT_CARD_INSET.x, paddingVertical: PROJECT_CARD_INSET.y }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: isCurrent ? c.primary : c.border, borderRadius: PROJECT_CARD_INSET.radius, opacity: state.archived ? 0.6 : 1 }]}>
        {isCurrent ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${c.primary}18`, borderRadius: PROJECT_CARD_INSET.radius }]} /> : null}
        {/* the grip column: the list's Archive mark sits at the bottom of the same vertical line */}
        <View style={styles.grip}>{state.grip}</View>
        <View style={styles.content}>
          <Pressable
            testID={testID ? `${testID}-main` : `project-card-main-${id}`}
            style={styles.main}
            onPress={() => { state.actions.markUsed(id); onSelect?.(id); }}
            accessibilityRole="button"
            accessibilityLabel={`Select ${j.name || 'project'}`}
          >
            <View style={[styles.avatar, { backgroundColor: `${c.primary}20` }]}>
              <IconApp name="view_timeline" size={22} color={c.primary} />
            </View>
            <View style={styles.texts}>
              <View style={styles.titleRow}>
                <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{j.name || 'Unnamed Project'}</Text>
                {isCurrent ? (
                  <View style={[styles.badge, { backgroundColor: `${c.primary}20`, borderColor: c.primary }]}>
                    <Text style={[styles.badgeText, { color: c.primary }]}>Viewing</Text>
                  </View>
                ) : null}
                <View style={[styles.badge, { backgroundColor: '#3b82f620', borderColor: '#3b82f6' }]}>
                  <Text style={[styles.badgeText, { color: '#3b82f6' }]}>{progress}%</Text>
                </View>
              </View>
              <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>{dateRange}{j.skipWeekends ? ' · Mon-Fri' : ''}</Text>
            </View>
          </Pressable>
          <View testID={`project-card-actions-${id}`} style={styles.actions}>
            {onDashboard ? (
              <Pressable
                testID={`project-dashboard-${id}`}
                onPress={() => { state.actions.markUsed(id); onDashboard(id); }}
                accessibilityRole="button"
                accessibilityLabel="Open project dashboard"
                style={({ pressed }) => [styles.dashboardBtn, { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <IconApp name="timeline" size={16} color="#ffffff" />
                <Text style={styles.dashboardBtnText}>Dashboard</Text>
              </Pressable>
            ) : null}
            {onSettings ? (
              <Pressable
                testID={`project-edit-${id}`}
                onPress={() => { state.actions.markUsed(id); onSettings(id); }}
                accessibilityRole="button"
                accessibilityLabel="Edit project settings"
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
              >
                <IconApp name="settings" size={18} color={c.text} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%' },
  card: { flex: 1, flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  grip: { width: 26, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  content: { flex: 1, minWidth: 0, paddingTop: 8, paddingBottom: 6, paddingRight: 8 },
  // the right edge is the list's: ⋮ at the top (28 px), FAB at the bottom (40 px)
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 34 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  badge: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  meta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingRight: 50 },
  dashboardBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  dashboardBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
});
