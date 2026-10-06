// Kanban bar (same height as the tree toolbar, so both panes line up):
//   [▦ scope: Project | Stage X · earliest: Plan] [All] · N tasks ........ [Gantt | Kanban | Network] [Kanban Stages]

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PMPalette } from '../theme';
import { PMCrud } from '../../crud/usePMCrud';
import { PMIconButton } from '../../inner/buttons/PMIconButton';
import { PMTipIcon } from '../../inner/buttons';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../../inner/toolbars/PMToolbarPrimitives';
import GanttToNetworkViewToggleButtons from '../gantt/toolbars/GanttToNetworkViewToggleButtons';
import type { PMProjectKanbanStageRow } from '../../model/kanbanTypes';
import { kanbanStageColorOf } from '../../model/kanbanTypes';
import { pmT } from '../../i18n/pmT';

export default function PMKanbanToolbar({
  crud,
  palette,
  scopeName,
  scopeStage,
  cardCount,
  onClearScope,
  onOpenStages,
  noStateCount = 0,
  noStateFilterOn = false,
  onToggleNoStateFilter,
}: {
  /** tasks of the scope in no column (kanbanNoState) */
  noStateCount?: number;
  /** the tree is filtered to them (Kanban = Is empty) */
  noStateFilterOn?: boolean;
  onToggleNoStateFilter?: () => void;
  crud: PMCrud;
  palette: PMPalette;
  /** null = whole project */
  scopeName: string | null;
  /** earliest stage of the tasks in the scope (scope = a stage row) */
  scopeStage: PMProjectKanbanStageRow | null;
  cardCount: number;
  onClearScope: () => void;
  onOpenStages: () => void;
}) {
  return (
    <PMToolbar background={palette.surface} border={palette.border}>
      <PMTipIcon
        tip={pmT('Board scope: select a stage in the tree to see only its tasks')}
        testID="pm-kanban-scope-icon"
        name="account_tree"
        size={18}
        color={scopeName ? palette.primary : palette.textMuted}
        style={{ marginHorizontal: 4 }}
      />
      <View style={styles.scope}>
        <Text style={[styles.scopeText, { color: palette.text }]} numberOfLines={1} testID="pm-kanban-scope">
          {scopeName ?? 'Whole project'}
        </Text>
        {!!scopeStage && (
          <View style={[styles.chip, { borderColor: kanbanStageColorOf(scopeStage.rowJSON) }]}>
            <Text style={[styles.chipText, { color: palette.textMuted }]} numberOfLines={1}>
              earliest: {scopeStage.rowJSON.stageName}
            </Text>
          </View>
        )}
      </View>
      {!!scopeName && <PMIconButton testID="pm-kanban-scope-all" icon="select_all" label={pmT('All')} title={pmT('Show the whole project')} color={palette.text} onPress={onClearScope} />}
      <Text style={[styles.count, { color: palette.textMuted }]} testID="pm-kanban-count">
        {cardCount} {cardCount === 1 ? 'task' : 'tasks'}
      </Text>
      {!!onToggleNoStateFilter && (noStateCount > 0 || noStateFilterOn) && (
        <PMIconButton
          testID="pm-kanban-no-state"
          icon={noStateFilterOn ? 'filter_alt_off' : 'filter_alt'}
          label={pmT('No state')}
          title={noStateFilterOn ? 'Show all tasks in the tree again' : `Filter the tree: ${noStateCount} task(s) in no column ("No state") - drag them from the tree onto a column`}
          color={palette.text}
          active={noStateFilterOn}
          activeColor={palette.primary}
          badge={noStateCount || undefined}
          onPress={onToggleNoStateFilter}
        />
      )}
      <PMToolbarSpacer />
      <GanttToNetworkViewToggleButtons palette={palette} onChange={crud.setGanttVsNetworkView} />
      <PMToolbarDivider color={palette.border} />
      <PMIconButton testID="pm-kanban-stages" icon="view_column" label={pmT('Kanban Stages')} title={pmT('Kanban Stages of this project (columns)')} color={palette.text} onPress={onOpenStages} />
    </PMToolbar>
  );
}

const styles = StyleSheet.create({
  scope: { flexDirection: 'row', alignItems: 'center', maxWidth: 320, flexShrink: 1 },
  scopeText: { fontWeight: '600', fontSize: 13, flexShrink: 1 },
  chip: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 },
  chipText: { fontSize: 11 },
  count: { fontSize: 12, marginHorizontal: 8 },
});
