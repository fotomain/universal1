// PMNetworkView - the project as a network (shown instead of the Gantt when
// uxuiSettings.ganttVsNetworkView = 'showNetworkView').
//
//   [ Gantt | Network ]  ( ) Network diagram  ( ) Network schedule  ..........  Critical path
//   ├─ PMNetworkDiagram   activity-on-node  (variants: CPM boxes / compact blocks)
//   └─ PMNetworkSchedule  activity-on-arrow (variants: 4-sector event circles / time-scaled)
//
// readOnly: no CRUD panel, no linking, no editing, no dependency menu - selecting a task
// only shows the read-only info card; view switches then stay local (nothing is saved).
// Without `crud` the view is read-only as well.
//
// Rendering is plain React Native + react-native-svg (no Skia / CanvasKit needed).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import { usePMStore } from '../store';
import { makePMPalette, PMPalette, withAlpha } from '../theme';
import { PMNetworkViewMode } from '../types';
import { PMCrud } from '../usePMCrud';
import { PM_WIDE_ACTION_WIDTH } from '../constants';
import { PMIconButton } from '../buttons/PMIconButton';
import { PMToolbar, PMToolbarDivider, PMToolbarSpacer } from '../toolbars/PMToolbarPrimitives';
import GanttToNetworkViewToggleButtons from '../toolbars/gantt/GanttToNetworkViewToggleButtons';
import PMGanttLinkModeHint from '../toolbars/gantt/PMGanttLinkModeHint';
import PMNetworkRadioGroup, { PMRadioOption } from './PMNetworkRadioGroup';
import PMNetworkDiagram from './PMNetworkDiagram';
import PMNetworkSchedule from './PMNetworkSchedule';
import { canEdit, useActivityNetwork, useNetworkViewSetters } from './useNetworkView';

export const PM_NETWORK_VIEW_MODES: PMRadioOption<PMNetworkViewMode>[] = [
  {
    value: 'networkDiagram',
    label: 'Network diagram',
    tip: 'Activity-on-node: tasks are boxes, dependencies are arrows',
  },
  {
    value: 'networkSchedule',
    label: 'Network schedule',
    tip: 'Activity-on-arrow: events are circles, tasks are arrows',
  },
];

export interface PMNetworkViewProps {
  /** Gantt commands (dashboard). Omit for a read-only view. */
  crud?: PMCrud;
  /** true = no CRUD operations for tasks (no panel, linking, editing, dependency menu). */
  readOnly?: boolean;
  /** show the Gantt | Network buttons (default true) */
  showGanttToggle?: boolean;
  /** palette override (default: from the design system, like the Gantt) */
  palette?: PMPalette;
}

export default function PMNetworkView({ crud, readOnly, showGanttToggle = true, palette: paletteProp }: PMNetworkViewProps) {
  const { themeColors, isDark } = useDesignSystem();
  const palette = useMemo(() => paletteProp ?? makePMPalette(themeColors, isDark), [paletteProp, themeColors, isDark]);
  const editable = canEdit(crud, readOnly);
  const mode = usePMStore((s) => s.networkViewMode);
  const showCritical = usePMStore((s) => s.showCriticalPath);
  const linkSourceName = usePMStore((s) => (editable && s.linkSourceGUID ? (s.tasksById[s.linkSourceGUID]?.rowJSON.name ?? '') : null));
  const setters = useNetworkViewSetters(crud, readOnly);
  const net = useActivityNetwork();

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]} testID={readOnly || !crud ? 'pm-net-view-readonly' : 'pm-net-view'}>
      <PMToolbar background={palette.surface} border={palette.border}>
        {linkSourceName !== null ? (
          <PMGanttLinkModeHint sourceName={linkSourceName} palette={palette} onCancel={crud!.cancelLink} />
        ) : (
          <>
            {showGanttToggle && (
              <>
                <GanttToNetworkViewToggleButtons palette={palette} onChange={setters.setGanttVsNetworkView} />
                <PMToolbarDivider color={palette.border} />
              </>
            )}
            <PMNetworkRadioGroup
              testID="pm-net-mode"
              options={PM_NETWORK_VIEW_MODES}
              value={mode}
              onChange={setters.setNetworkViewMode}
              color={palette.text}
              activeColor={palette.primary}
            />
            <PMToolbarSpacer />
            {!editable && (
              <Text
                testID="pm-net-readonly-badge"
                style={[
                  styles.badge,
                  {
                    color: palette.textMuted,
                    backgroundColor: withAlpha(palette.textMuted, 0.12),
                  },
                ]}
              >
                Read-only
              </Text>
            )}
            <PMIconButton
              testID="pm-net-critical"
              icon="route"
              label="Critical path"
              width={PM_WIDE_ACTION_WIDTH}
              active={showCritical}
              activeColor={palette.critical}
              color={palette.text}
              onPress={setters.toggleCriticalPath}
            />
          </>
        )}
      </PMToolbar>
      {mode === 'networkSchedule' ? (
        <PMNetworkSchedule net={net} palette={palette} crud={crud} readOnly={!editable} />
      ) : (
        <PMNetworkDiagram net={net} palette={palette} crud={crud} readOnly={!editable} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 6,
    overflow: 'hidden',
  },
});
