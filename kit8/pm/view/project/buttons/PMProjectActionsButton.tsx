// PMProjectActionsButton - the "Actions" icon button of the project bar (right before the Project settings button). It opens a menu:
//   1. Post unposted tasks   - post every task that is not posted now (never posted, or changed after posting)
//   2. Repost all tasks      - post EVERY task with a budget item again (asks first)
//   3. Update project cost   - only while a cost budget is on: the database applies the queued tasks and rebuilds costTotalForBudget of every task and stage (update_project_cost_total, kit8/pm/cost)
//   4. Refresh the project   - re-read the project, its tasks, lines, Kanban, settings and versions (the last place)
// The posting itself is useProjectPostActions (kit8/pm/view/task/plan); refresh bumps the redux counter uxui.refreshProjectData that the dashboard watches.
import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { useDispatch } from 'react-redux';
import { refreshProjectData, showSnackbar } from '../../../../redux/uxuiSlice';
import { useSupabase } from '../../../../providers/WithSupabase';
import { showErrorModal } from '../../../../ui/components/common/ErrorModalWindow';
import { updateProjectCostTotal } from '../../../cost/costTotalApi';
import { emitCostTotalsStale } from '../../../cost/costTotalModel';
import { cancelProjectCostRefresh } from '../../../cost/costRefreshScheduler';
import { PMIconButton } from '../../../inner/buttons/PMIconButton';
import PMContextMenu from '../../../inner/menu/PMContextMenu';
import { pmT } from '../../../i18n/pmT';
import { useProjectPostActions } from '../../task/plan/useProjectPostActions';

export default function PMProjectActionsButton({ projectGUID, color, disabled, width, size, costBudgetOn }: { projectGUID: string | null | undefined; color: string; disabled?: boolean; width?: number; size?: number; costBudgetOn?: boolean }) {
  const dispatch = useDispatch();
  const { supabase } = useSupabase();
  const [costBusy, setCostBusy] = useState(false);
  const { postUnposted, repostAll, busy } = useProjectPostActions(projectGUID);
  const ref = useRef<View>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const open = () => {
    const node: any = ref.current;
    if (node?.measureInWindow) node.measureInWindow((x: number, y: number, _w: number, h: number) => setMenu({ x, y: y + h + 2 }));
    else setMenu({ x: 8, y: 56 });
  };
  const pick = (fn: () => void) => () => { setMenu(null); fn(); };

  // Update project cost: flush the queued tasks of the project, rebuild its cost totals (heals any drift), tell the open tree to read them again
  const updateCost = async () => {
    if (!projectGUID || costBusy) return;
    setCostBusy(true);
    cancelProjectCostRefresh(projectGUID);                  // this command does the same work at once: a pending call after a Post is not needed
    try {
      const a = await updateProjectCostTotal(supabase, projectGUID);
      emitCostTotalsStale(projectGUID);
      const healed = a.changedRows > 0 ? ` · ${pmT('{{count}} total(s) updated', { count: a.changedRows })}` : '';
      dispatch(showSnackbar({ message: `${pmT('Project cost {{total}} · {{tasks}} task(s) · {{ms}} ms', { total: a.projectTotal.toFixed(2), tasks: a.tasks, ms: a.ms })}${healed}`, isError: false }));
    } catch (e: any) {
      showErrorModal(e?.message || String(e), pmT('Update project cost'));
    } finally {
      setCostBusy(false);
    }
  };

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
          active={busy || costBusy}
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
            ...(costBudgetOn ? [{ testID: 'pm-project-actions-update-cost', label: 'Update project cost', icon: 'calculate', disabled: busy || costBusy, onPress: pick(() => { void updateCost(); }) }] : []),
            { testID: 'pm-project-actions-refresh', label: 'Refresh the project', icon: 'refresh', onPress: pick(() => dispatch(refreshProjectData())) },
          ]}
        />
      )}
    </>
  );
}
