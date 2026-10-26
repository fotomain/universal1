// The items of the project "Actions" menu that belong to the Gantt Extended functions (kit8/pm/extended); [] while none of them is on:
//   Calculate project (A2, only in Manual calculation) · Set baseline ▸ Baseline 0..10, for the whole project or for the checked rows (C1)
//   Update project ▸ Mark work complete through the status date · Reschedule uncompleted work (C5)
import { useMemo } from 'react';
import { usePMStore } from '../../../store/store_pm';
import type { PMCrud } from '../../../crud/usePMCrud';
import type { PMMenuItemProps } from '../../../inner/menu/PMMenuItem';

/** the commands the items call; set by PMExtendedActionsHost, which exists only while one of these functions is on (so the Actions button needs no providers otherwise) */
export const extendedCrudRef: { current: PMCrud | null } = { current: null };

/** is one of the functions that add an item to the Actions menu on? */
export const extendedActionsNeeded = (flags: Record<string, boolean>): boolean => flags.ganttBaselinesEnabled === true || flags.ganttStatusDateEnabled === true;

export function useExtendedActions(projectGUID: string | null | undefined, pick: (fn: () => void) => () => void): PMMenuItemProps[] {
  const flags = usePMStore((s) => s.extFlags);
  const manual = usePMStore((s) => s.calculationMode === 'manual');
  const checked = usePMStore((s) => Object.keys(s.checkedGUIDs).length);
  const crud = { setBaseline: (n: number, checkedOnly: boolean) => extendedCrudRef.current?.setBaseline(n, checkedOnly), markCompleteThroughStatus: () => extendedCrudRef.current?.markCompleteThroughStatus(), rescheduleUncompleted: () => extendedCrudRef.current?.rescheduleUncompleted() };
  return useMemo(() => {
    const items: PMMenuItemProps[] = [];
    if (flags.ganttCalculationModeEnabled && manual) items.push({ testID: 'pm-project-actions-calculate', label: 'Calculate project', icon: 'calculate', onPress: pick(() => usePMStore.getState().calculateProject()) });
    if (flags.ganttBaselinesEnabled) {
      const numbers = Array.from({ length: 11 }, (_, i) => i);
      items.push({
        testID: 'pm-project-actions-baseline', label: 'Set baseline', icon: 'flag', onPress: () => {},
        submenu: [
          ...numbers.map((n) => ({ testID: `pm-project-actions-baseline-${n}`, label: n === 0 ? 'Baseline (all rows)' : `Baseline ${n} (all rows)`, icon: 'bookmark', onPress: pick(() => crud.setBaseline(n, false)) })),
          ...numbers.map((n) => ({ testID: `pm-project-actions-baseline-checked-${n}`, label: n === 0 ? 'Baseline (checked rows)' : `Baseline ${n} (checked rows)`, icon: 'bookmark_border', disabled: checked === 0, onPress: pick(() => crud.setBaseline(n, true)) })),
        ],
      });
    }
    if (flags.ganttStatusDateEnabled) {
      items.push({
        testID: 'pm-project-actions-update', label: 'Update project', icon: 'update', onPress: () => {},
        submenu: [
          { testID: 'pm-project-actions-mark-complete', label: 'Mark work complete through the status date', icon: 'task_alt', onPress: pick(() => crud.markCompleteThroughStatus()) },
          { testID: 'pm-project-actions-reschedule', label: 'Reschedule uncompleted work', icon: 'event_repeat', onPress: pick(() => crud.rescheduleUncompleted()) },
        ],
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flags, manual, checked]);
}
