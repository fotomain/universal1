import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { CardItem } from '../../ui/components/list/web/lib/types';
import type { PMProjectRow, PMRowJSON } from '../../pm/model/types';
import { usePMStore } from '../../pm/store/store_pm';
import { formatDateShort } from '../../pm/view/project/scheduling';

export interface ProjectCardProps {
  card: CardItem;
  isSelected?: boolean;
  isDragging?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  dragHandleProps?: any;
  crudCardHeight?: number;
  testID?: string;
}

export default function ProjectCard({
  card,
  isSelected,
  isDragging,
  onEdit,
  onDelete,
  onSelect,
  dragHandleProps,
  crudCardHeight = 88,
  testID,
}: ProjectCardProps) {
  const router = useRouter();
  const { themeColors: c } = useDesignSystem();
  const raw: Partial<PMProjectRow> = card.rawItem || {};
  const j: Partial<PMRowJSON> = raw.rowJSON || {};
  const id = card.id;

  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const isCurrentGantt = selectedProjectGUID === id;

  const startStr = j.projectStartAt ? formatDateShort(Date.parse(j.projectStartAt)) : null;
  const finishStr = raw.rowDuration ? formatDateShort(Date.parse(raw.rowDuration)) : null;
  const dateRange = startStr && finishStr ? `${startStr} – ${finishStr}` : startStr || 'Dates not set';
  const progress = Math.round(raw.rowProgress ?? 0);

  const handleCardPress = () => {
    // Select this project in PM store for Gantt preview
    const s = usePMStore.getState();
    s.addRecentProject(id);
    s.selectProject(id);
    onSelect?.(id);
  };

  const handleDashboardPress = () => {
    // Select project and navigate to full PM Gantt dashboard
    const s = usePMStore.getState();
    s.addRecentProject(id);
    s.selectProject(id);
    router.push('/pm/project/dashboard' as any);
  };

  return (
    <View
      testID={testID || `project-card-${id}`}
      style={[
        styles.card,
        {
          minHeight: crudCardHeight,
          backgroundColor: isCurrentGantt || isSelected ? `${c.primary}18` : c.surface,
          borderColor: isCurrentGantt || isSelected ? c.primary : c.border,
        },
        isDragging && styles.dragging,
      ]}
    >
      {Platform.OS === 'web' && dragHandleProps ? (
        <div
          {...dragHandleProps}
          title="Drag to reorder"
          style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4 }}
        >
          <IconApp name="drag_indicator" size={20} color={c.text} />
        </div>
      ) : null}

      <Pressable
        testID={testID ? `${testID}-main` : `project-card-main-${id}`}
        style={styles.main}
        onPress={handleCardPress}
        accessibilityRole="button"
        accessibilityLabel={`Select ${j.name || 'project'}`}
      >
        <View style={[styles.avatarBadge, { backgroundColor: `${c.primary}20` }]}>
          <IconApp name="view_timeline" size={22} color={c.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {j.name || 'Unnamed Project'}
            </Text>
            {isCurrentGantt && (
              <View style={[styles.badge, { backgroundColor: `${c.primary}20`, borderColor: c.primary }]}>
                <Text style={[styles.badgeText, { color: c.primary }]}>Viewing</Text>
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: '#3b82f620', borderColor: '#3b82f6' }]}>
              <Text style={[styles.badgeText, { color: '#3b82f6' }]}>{progress}%</Text>
            </View>
          </View>

          <Text style={[styles.meta, { color: c.text }]} numberOfLines={1}>
            {dateRange} {j.skipWeekends ? ' · Mon-Fri' : ''}
          </Text>
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
        <Pressable
          testID={`project-dashboard-${id}`}
          onPress={handleDashboardPress}
          accessibilityRole="button"
          accessibilityLabel="Open project dashboard"
          style={({ pressed }) => [
            styles.dashboardBtn,
            { backgroundColor: c.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <IconApp name="timeline" size={16} color="#ffffff" />
          <Text style={styles.dashboardBtnText}>Dashboard</Text>
        </Pressable>

        {onEdit && (
          <Pressable
            testID={`project-edit-${id}`}
            onPress={() => onEdit(id)}
            accessibilityRole="button"
            accessibilityLabel="Edit project settings"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
          >
            <IconApp name="settings" size={18} color={c.text} />
          </Pressable>
        )}

        {onDelete && (
          <Pressable
            testID={`project-delete-${id}`}
            onPress={() => onDelete(id)}
            accessibilityRole="button"
            accessibilityLabel="Delete project"
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
          >
            <IconApp name="delete" size={18} color="#ef4444" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dragging: {
    elevation: 8,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  dashboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  dashboardBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
