// PMProjectActionsButton - the "Actions" icon button of the project bar (right before the Project settings button). It opens a menu:
//   1. Post unposted tasks   - post every task that is not posted now (never posted, or changed after posting)
//   2. Repost all tasks      - post EVERY task with a budget item again (asks first)
//   3. Refresh the project   - re-read the project, its tasks, lines, Kanban, settings and versions (the last place)
// The posting itself is useProjectPostActions (kit8/pm/view/task/plan); refresh bumps the redux counter uxui.refreshProjectData that the dashboard watches.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useDispatch } from 'react-redux';
import { refreshProjectData } from '../../../../redux/uxuiSlice';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { pmT } from '../../../i18n/pmT';
import { useProjectPostActions } from '../../task/plan/useProjectPostActions';

export default function PMProjectActionsButton({ projectGUID, color, disabled, width, size }: { projectGUID: string | null | undefined; color: string; disabled?: boolean; width?: number; size?: number }) {
  const dispatch = useDispatch();
  const { postUnposted, repostAll, busy } = useProjectPostActions(projectGUID);
  const ref = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

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
          testID="pm-project-actions"
          icon="bolt"
          title={pmT('Actions: post unposted tasks, repost all tasks, refresh the project')}
          color={color}
          disabled={disabled}
          width={width}
          size={size}
          active={busy}
          activeColor={color}
          onPress={open}
        />
      </View>
      {!!menu && (
        <PMContextMenu
          testID="pm-project-actions-menu"
          x={menu.x}
          y={menu.y}
          width={230}
          caption={pmT('Actions')}
          onClose={() => setMenu(null)}
          items={[
            { testID: 'pm-project-actions-post-unposted', label: 'Post unposted tasks', icon: 'cloud_upload', disabled: busy, onPress: pick(postUnposted) },
            { testID: 'pm-project-actions-repost-all', label: 'Repost all tasks', icon: 'sync', disabled: busy, onPress: pick(repostAll) },
            { testID: 'pm-project-actions-refresh', label: 'Refresh the project', icon: 'refresh', onPress: pick(() => dispatch(refreshProjectData())) },
          ]}
        />
      )}
    </>
  );
}
