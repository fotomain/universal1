// PMResourceLevelingBarButton - the "Level" button of the Gantt bar with the menu titled "Resource optimization" (documentation/RESOURCE_LEVELING_WBS.html 9):
// Level now · Clear leveling · Undo last run · Run history. Shown only while the project switch resourceLevelingFunctionalityEnabled is on; with it off the bar is the one it always was.
// It also mounts the windows (preview, the question about posted tasks, run history), so one mount serves the whole feature.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { usePMStore } from '../store/store_pm';
import type { PMPalette } from '../view/theme';
import { PMIconButton } from '../inner/buttons/PMIconButton';
import PMContextMenu from '../inner/menu/PMContextMenu';
import { pmT } from '../i18n/pmT';
import PMResourceLevelingPreviewWindow from './PMResourceLevelingPreviewWindow';
import PMResourceLevelingRunHistory from './PMResourceLevelingRunHistory';
import { resourceLevelingEnabledOf } from './resourceLevelingSettings';
import { useResourceLeveling } from './useResourceLeveling';
import { useResourceLevelingUiStore } from './resourceLevelingUiStore';

export default function PMResourceLevelingBarButton({ palette }: { palette: PMPalette }) {
  const projectGUID = usePMStore((s) => s.selectedProjectGUID);
  const enabled = usePMStore((s) => resourceLevelingEnabledOf(s.selectedProjectGUID ? s.projectsById[s.selectedProjectGUID]?.rowJSON : undefined));
  const busy = useResourceLevelingUiStore((s) => s.busy);
  const { levelNow, apply, clear, undoLast, undoRun } = useResourceLeveling(projectGUID);
  const ref = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  if (!enabled) return null;
  const open = () => {
    const node: any = ref.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setMenu({ x, y: y + h + 2 }));
    else setMenu({ x: 8, y: 56 });
  };
  const pick = (fn: () => void) => () => { setMenu(null); fn(); };
  return (
    <>
      <View ref={ref} collapsable={false}>
        <PMIconButton
          testID="pm-gantt-resource-leveling"
          icon="balance"
          label={pmT('Level')}
          title={pmT('Resource optimization: level the resources that are booked for more hours than their calendar allows')}
          color={palette.text}
          active={busy}
          activeColor={palette.primary}
          onPress={open}
        />
      </View>
      {!!menu && (
        <PMContextMenu
          testID="pm-gantt-resource-leveling-menu"
          x={menu.x}
          y={menu.y}
          width={230}
          caption={pmT('Resource optimization')}
          onClose={() => setMenu(null)}
          items={[
            { testID: 'pm-resource-leveling-menu-level', label: 'Level now', icon: 'balance', disabled: busy, onPress: pick(() => { void levelNow(); }) },
            { testID: 'pm-resource-leveling-menu-clear', label: 'Clear leveling', icon: 'layers_clear', disabled: busy, onPress: pick(() => { void clear(); }) },
            { testID: 'pm-resource-leveling-menu-undo', label: 'Undo last run', icon: 'undo', disabled: busy, onPress: pick(() => { void undoLast(); }) },
            { testID: 'pm-resource-leveling-menu-history', label: 'Run history', icon: 'history', onPress: pick(() => useResourceLevelingUiStore.getState().setHistory(true)) },
          ]}
        />
      )}
      <PMResourceLevelingPreviewWindow onApply={(choice) => { void apply(choice); }} />
      <PMResourceLevelingRunHistory projectGUID={projectGUID} onUndo={(run) => { void undoRun(run); }} />
    </>
  );
}
