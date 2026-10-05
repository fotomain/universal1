// Floating label that follows a tree row dragged over the Kanban board (kanbanTreeBridge.ts).
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { usePMKanbanStore } from '../../store/store_kanban';
import { usePMStore } from '../../store/store_pm';
import { PMPalette } from '../theme';
import { kanbanLeavesForRow } from '../../crud/kanban/useKanbanCommands';
import { PMKanbanTreeBridge } from './kanbanTreeBridge';

export default function PMKanbanTreeDragGhost({ bridge, palette }: { bridge: PMKanbanTreeBridge; palette: PMPalette }) {
  const drag = usePMKanbanStore((s) => s.treeDrag);
  const target = usePMKanbanStore((s) => (s.treeDrag?.overStageGUID ? s.stages.find((x) => x.rowGUID === s.treeDrag!.overStageGUID)?.rowJSON.stageName : null));
  // re-counted when the tree / multi selection changes
  const count = usePMStore((s) => (drag && s.tasksById[drag.guid] ? kanbanLeavesForRow(drag.guid).length : 0));
  const style = useAnimatedStyle(() => ({
    opacity: bridge.active.value,
    transform: [{ translateX: bridge.x.value + 12 }, { translateY: bridge.y.value - 14 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.ghost, { backgroundColor: palette.surface, borderColor: palette.primary }, style]}>
      <Text style={{ color: palette.text, fontWeight: '600', fontSize: 12 }} numberOfLines={1}>
        {drag?.name || ''}
        {count > 1 ? `  (${count} tasks)` : ''}
      </Text>
      <Text style={{ color: target ? palette.primary : palette.textMuted, fontSize: 11 }} numberOfLines={1}>
        {target ? `→ ${target}` : count ? 'drop on a column' : 'no tasks inside'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', left: 0, top: 0, maxWidth: 240, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, zIndex: 50, elevation: 50 },
});
