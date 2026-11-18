import React, { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import IconApp from '../../ui/components/common/IconApp';
import type { CardItem } from '../../ui/components/list/web/lib/types';
import type { PMProjectRow, PMRowJSON } from '../../pm/model/types';
import { usePMStore } from '../../pm/store/store_pm';
import { formatDateShort } from '../../pm/view/project/scheduling';
import PMContextMenu from '../../pm/inner/menu/PMContextMenu';
import type { PMMenuItemProps } from '../../pm/inner/menu/PMMenuItem';
import { useProjectCardActions } from './copy/ProjectCardActionsContext';

/** a card narrower than this puts its buttons on a second row, so the title keeps the whole first row */
export const PROJECT_CARD_COMPACT_WIDTH = 460;
export const isCompactProjectCard = (width: number | null | undefined): boolean => !!width && width < PROJECT_CARD_COMPACT_WIDTH;

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

  // the menu of the card: right click (web), long press (phone), the three dots at the right corner
  const { onCopy, onCopyWithTasks } = useProjectCardActions();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const dotsRef = useRef<View>(null);
  const [cardWidth, setCardWidth] = useState<number | null>(null);
  const compact = isCompactProjectCard(cardWidth);
  const hasMenu = !!(onCopy || onCopyWithTasks || onDelete);
  const openMenuAt = (x: number, y: number) => hasMenu && setMenu({ x, y });
  const openMenuFromDots = () => {
    // opens at once (a first guess), then moves under the dots as soon as the window position is measured
    openMenuAt(8, 56);
    const node: any = dotsRef.current;
    node?.measureInWindow?.((x: number, y: number, _w: number, h: number) => setMenu({ x: x - 150, y: y + h + 2 }));
  };
  const pick = (fn: () => void) => () => {
    setMenu(null);
    fn();
  };
  const menuItems: PMMenuItemProps[] = [
    ...(onCopy ? [{ testID: `project-menu-copy-${id}`, label: 'Copy', icon: 'content_copy', onPress: pick(() => onCopy(id)) }] : []),
    ...(onCopyWithTasks ? [{ testID: `project-menu-copy-tasks-${id}`, label: 'Copy with Tasks', icon: 'control_point_duplicate', onPress: pick(() => onCopyWithTasks(id)) }] : []),
    ...(onDelete ? [{ testID: `project-menu-delete-${id}`, label: 'Delete', icon: 'delete', danger: true, onPress: pick(() => onDelete(id)) }] : []),
  ];

  const dotsButton = hasMenu ? (
    <Pressable
      ref={dotsRef as any}
      testID={`project-menu-${id}`}
      onPress={openMenuFromDots}
      accessibilityRole="button"
      accessibilityLabel="Project menu"
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, padding: 6 }]}
    >
      <IconApp name="more_vert" size={20} color={c.text} />
    </Pressable>
  ) : null;

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
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
      {...(Platform.OS === 'web'
        ? ({
            onContextMenu: (e: any) => {
              if (!hasMenu) return;
              e.preventDefault?.();
              const ev = e.nativeEvent || e;
              openMenuAt(ev.clientX ?? ev.pageX ?? 8, ev.clientY ?? ev.pageY ?? 56);
            },
          } as any)
        : {})}
      style={[
        styles.card,
        {
          minHeight: crudCardHeight,
          // opaque: the swipe underlay (its sql_for_delete icon) of the web list must not show through the card
          backgroundColor: c.surface,
          borderColor: isCurrentGantt || isSelected ? c.primary : c.border,
        },
        isDragging && styles.dragging,
      ]}
    >
      {(isCurrentGantt || isSelected) && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `${c.primary}18`, borderRadius: 9 }]} />
      )}
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
        onLongPress={Platform.OS === 'web' ? undefined : (e: any) => openMenuAt(e?.nativeEvent?.pageX ?? 8, e?.nativeEvent?.pageY ?? 56)}
        accessibilityRole="button"
        accessibilityLabel={`Select ${j.name || 'project'}`}
      >
        <View style={[styles.avatarBadge, { backgroundColor: `${c.primary}20` }]}>
          <IconApp name="view_timeline" size={22} color={c.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
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

      {compact && dotsButton}

      <View
        testID={`project-card-actions-${id}`}
        style={compact ? styles.actionsCompact : { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}
      >
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

        {!compact && dotsButton}
      </View>

      {menu && <PMContextMenu x={menu.x} y={menu.y} caption={j.name || 'Project'} items={menuItems} onClose={() => setMenu(null)} testID={`project-menu-popup-${id}`} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  // narrow card: the buttons go to their own row under the title
  actionsCompact: {
    flexBasis: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 6,
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
