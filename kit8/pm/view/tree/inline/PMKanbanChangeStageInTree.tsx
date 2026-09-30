// PMKanbanChangeStageInTree: inline editor for the tree "Kanban" cell.
// Shows the list of project Kanban stages with their accent colors,
// highlights the current stage, and updates the task's Kanban stage on select.
// Enter = commit, Esc = cancel.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { usePMStore } from '../../../store/store_pm';
import { usePMKanbanStore } from '../../../store/store_kanban';
import { useKanbanCommands } from '../../../crud/kanban/useKanbanCommands';
import { PMCrud } from '../../../crud/usePMCrud';
import { derivedKanbanStage, kanbanStageOfTask } from '../../kanban/kanbanModel';
import { kanbanStageColorOf, PM_KANBAN_DEFAULT_STAGES, PMProjectKanbanStageRow } from '../../../model/kanbanTypes';
import { withAlpha } from '../../theme';
import { PM_ROW_HEIGHT, PM_SCALE_HEIGHT } from '../../../model/constants';
import IconApp from '../../../../components/common/IconApp';

const POPUP_WIDTH = 180;
const ITEM_HEIGHT = 32;

export interface PMKanbanChangeStageInTreeProps {
  guid: string;
  rowIndex: number;
  x: number;
  width: number;
  scrollY: SharedValue<number>;
  crud: PMCrud;
  colors: { text: string; background: string; primary: string; error: string };
}

export default function PMKanbanChangeStageInTree({
  guid,
  rowIndex,
  x,
  width,
  scrollY,
  colors,
}: PMKanbanChangeStageInTreeProps) {
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const tasksById = usePMStore((s) => s.tasksById);
  const schedule = usePMStore((s) => s.schedule);
  const tree = usePMStore((s) => s.tree);

  const storeStages = usePMKanbanStore((s) => s.stages);
  const statesByTask = usePMKanbanStore((s) => s.statesByTask);
  const kanban = useKanbanCommands(projectGUID);

  const stages: PMProjectKanbanStageRow[] = useMemo(() => {
    if (storeStages.length > 0) return storeStages;
    return PM_KANBAN_DEFAULT_STAGES.map((s, i) => ({
      rowGUID: s.stageCode,
      rowOwnerGUID: projectGUID || '',
      rowParentGUID: 'empty',
      orderInList: (i + 1) * 1024,
      rowJSON: { stageName: s.stageName, stageColor: s.stageColor, stageCode: s.stageCode },
    }));
  }, [storeStages, projectGUID]);

  const currentStageGUID = useMemo(() => {
    const isSummary = !!schedule[guid]?.isSummary || (tree.childrenById[guid]?.length ?? 0) > 0;
    if (isSummary) {
      const derived = derivedKanbanStage(guid, tasksById, tree, stages, statesByTask);
      return derived ? derived.rowGUID : stages[0]?.rowGUID ?? null;
    }
    return kanbanStageOfTask(guid, stages, statesByTask);
  }, [guid, schedule, tree, tasksById, stages, statesByTask]);

  const currentIndex = useMemo(() => {
    const idx = stages.findIndex((s) => s.rowGUID === currentStageGUID);
    return idx >= 0 ? idx : 0;
  }, [stages, currentStageGUID]);

  const [focusedIndex, setFocusedIndex] = useState(currentIndex);
  const doneRef = useRef(false);

  const close = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    usePMStore.getState().setCellEdit(null);
  };

  const selectStage = (stageGUID: string) => {
    if (doneRef.current) return;
    doneRef.current = true;
    kanban.moveTreeRowToStage(guid, stageGUID);
    usePMStore.getState().setCellEdit(null);
  };

  // Keyboard navigation: Up / Down arrow moves focus, Enter selects, Escape cancels
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1 < stages.length ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const stage = stages[focusedIndex];
        if (stage) selectStage(stage.rowGUID);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stages, focusedIndex]);

  const style = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: PM_SCALE_HEIGHT + rowIndex * PM_ROW_HEIGHT - scrollY.value + 2 },
      ],
    };
  });

  const menuWidth = Math.max(POPUP_WIDTH, width);

  return (
    <>
      {/* Invisible backdrop to dismiss on click outside */}
      <Pressable
        testID="pm-tree-edit-kanban-backdrop"
        style={styles.backdrop}
        onPress={close}
      />

      <Animated.View
        testID={`pm-tree-edit-kanban-popup-${guid}`}
        style={[
          styles.popup,
          {
            left: x,
            width: menuWidth,
            backgroundColor: colors.background,
            borderColor: withAlpha(colors.primary, 0.4),
          },
          style,
        ]}
      >
        <View style={[styles.header, { borderBottomColor: withAlpha(colors.text, 0.1) }]}>
          <Text style={[styles.headerTitle, { color: withAlpha(colors.text, 0.7) }]}>
            Kanban Stage
          </Text>
          <Pressable
            testID="pm-tree-edit-kanban-close"
            accessibilityLabel="Close"
            onPress={close}
            hitSlop={8}
            style={styles.closeBtn}
          >
            <IconApp name="close" size={13} color={withAlpha(colors.text, 0.6)} />
          </Pressable>
        </View>

        <ScrollView style={styles.list} bounces={false}>
          {stages.map((st, i) => {
            const isCurrent = st.rowGUID === currentStageGUID;
            const isFocused = i === focusedIndex;
            const color = kanbanStageColorOf(st.rowJSON);
            const name = st.rowJSON?.stageName || '—';

            return (
              <Pressable
                key={st.rowGUID}
                testID={`pm-tree-edit-kanban-option-${st.rowGUID}`}
                accessibilityRole="menuitem"
                accessibilityLabel={name}
                onPress={() => selectStage(st.rowGUID)}
                style={({ hovered, pressed }: any) => [
                  styles.item,
                  {
                    backgroundColor:
                      isCurrent
                        ? withAlpha(color, 0.16)
                        : isFocused || hovered || pressed
                          ? withAlpha(colors.primary, 0.1)
                          : 'transparent',
                  },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text
                  style={[
                    styles.itemText,
                    {
                      color: isCurrent ? color : colors.text,
                      fontWeight: isCurrent ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                {isCurrent && (
                  <IconApp name="check" size={14} color={color} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    left: -5000,
    top: -5000,
    width: 10000,
    height: 10000,
    zIndex: 90,
  },
  popup: {
    position: 'absolute',
    top: 0,
    borderRadius: 8,
    borderWidth: 1.5,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 100,
    maxHeight: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 2,
  },
  list: {
    maxHeight: 180,
  },
  item: {
    height: ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  itemText: {
    flex: 1,
    fontSize: 12,
  },
});
