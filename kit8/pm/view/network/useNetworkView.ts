// Hooks shared by PMNetworkView / PMNetworkDiagram / PMNetworkSchedule:
//   useActivityNetwork()      the AON network of the selected project (memoized on the store data)
//   useNetworkViewSetters()   view switches: saved per project, or local only (read-only / no crud)
//   useNetworkInteraction()   select · link · edit (double tap / long press) · dependency menu,
//                             everything that changes data is disabled in read-only mode

import { useCallback, useMemo, useRef } from 'react';
import { GestureResponderEvent } from 'react-native';
import { usePMStore } from '../../store/store_pm';
import { PMCrud } from '../../crud/usePMCrud';
import { PMDepRef, PMGanttVsNetworkView, PMLinkLineForm, PMNetworkDiagramVariant, PMNetworkScheduleVariant, PMNetworkViewMode } from '../../model/types';
import { buildActivityNetwork, NET_FINISH, NET_START, PMActivityNetwork, relatedActivities } from './networkModel';

export function useActivityNetwork(): PMActivityNetwork {
  const tasks = usePMStore((s) => s.tasks);
  const deps = usePMStore((s) => s.deps);
  const tree = usePMStore((s) => s.tree);
  const schedule = usePMStore((s) => s.schedule);
  const projectStartMs = usePMStore((s) => s.projectStartMs);
  const projectFinishMs = usePMStore((s) => s.projectFinishMs);
  const skipWeekends = usePMStore((s) => !!(s.selectedProjectGUID && s.projectsById[s.selectedProjectGUID]?.rowJSON.skipWeekends));
  return useMemo(
    () => buildActivityNetwork({ tasks, deps, tree, schedule, projectStartMs, projectFinishMs, calendar: { skipWeekends } }),
    [tasks, deps, tree, schedule, projectStartMs, projectFinishMs, skipWeekends],
  );
}

/** true when the view may change data: not read-only and a crud object is available. */
export function canEdit(crud: PMCrud | undefined, readOnly: boolean | undefined): crud is PMCrud {
  return !!crud && !readOnly;
}

export function useNetworkViewSetters(crud: PMCrud | undefined, readOnly: boolean | undefined) {
  const persist = canEdit(crud, readOnly);
  return useMemo(() => {
    const local = usePMStore.getState().setNetworkViewSettings;
    return {
      setGanttVsNetworkView: (v: PMGanttVsNetworkView) => (persist ? crud!.setGanttVsNetworkView(v) : local({ ganttVsNetworkView: v })),
      setNetworkViewMode: (v: PMNetworkViewMode) => (persist ? crud!.setNetworkViewMode(v) : local({ networkViewMode: v })),
      setNetworkDiagramVariant: (v: PMNetworkDiagramVariant) => (persist ? crud!.setNetworkDiagramVariant(v) : local({ networkDiagramVariant: v })),
      setNetworkScheduleVariant: (v: PMNetworkScheduleVariant) => (persist ? crud!.setNetworkScheduleVariant(v) : local({ networkScheduleVariant: v })),
      setLinkLineForm: (v: PMLinkLineForm) => (persist ? crud!.setGanttArrowsForm(v) : usePMStore.getState().setLinkLineForm(v)),
      toggleCriticalPath: () => (persist ? crud!.toggleCriticalPath() : usePMStore.getState().toggleCriticalPath()),
    };
  }, [crud, persist]);
}

const DOUBLE_TAP_MS = 320;

export interface PMNetworkSelection {
  /** selected activity (task guid) - shared with the Gantt (store.selectedGUID) */
  selectedGUID: string | null;
  hoveredGUID: string | null;
  /** activities on the chain of the hovered / selected one (null = nothing highlighted) */
  highlight: Set<string> | null;
}

export function useNetworkInteraction(net: PMActivityNetwork, crud: PMCrud | undefined, readOnly: boolean | undefined) {
  const editable = canEdit(crud, readOnly);
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const hoveredGUID = usePMStore((s) => s.hoveredGUID);
  const linkSourceGUID = usePMStore((s) => (editable ? s.linkSourceGUID : null));
  const lastTap = useRef<{ guid: string; at: number } | null>(null);

  const focus = hoveredGUID && net.byGUID[hoveredGUID] ? hoveredGUID : selectedGUID && net.byGUID[selectedGUID] ? selectedGUID : null;
  const highlight = useMemo(() => (focus ? relatedActivities(net, focus) : null), [net, focus]);

  const pressActivity = useCallback(
    (guid: string) => {
      if (guid === NET_START || guid === NET_FINISH) return;
      const s = usePMStore.getState();
      if (editable && s.linkSourceGUID) {
        if (guid !== s.linkSourceGUID) crud!.link(s.linkSourceGUID, guid);
        return;
      }
      const now = Date.now();
      const dbl = lastTap.current && lastTap.current.guid === guid && now - lastTap.current.at < DOUBLE_TAP_MS;
      lastTap.current = { guid, at: now };
      s.setSelected(guid);
      if (dbl && editable) crud!.edit(guid);
    },
    [crud, editable],
  );

  const longPressActivity = useCallback(
    (guid: string) => {
      if (!editable || guid === NET_START || guid === NET_FINISH) return;
      usePMStore.getState().setSelected(guid);
      crud!.edit(guid);
    },
    [crud, editable],
  );

  const hoverActivity = useCallback((guid: string | null) => usePMStore.getState().setHovered(guid), []);

  const pressDependency = useCallback(
    (ref: PMDepRef | null | undefined, e?: GestureResponderEvent | any) => {
      if (!editable || !ref) return;
      const ne = e?.nativeEvent ?? e ?? {};
      const x = ne.pageX ?? ne.clientX ?? 0;
      const y = ne.pageY ?? ne.clientY ?? 0;
      crud!.openDependencyMenu(ref, x, y);
    },
    [crud, editable],
  );

  const clearSelection = useCallback(() => {
    const s = usePMStore.getState();
    if (s.selectedGUID) s.setSelected(null);
  }, []);

  return useMemo(
    () => ({
      editable,
      selectedGUID,
      hoveredGUID,
      linkSourceGUID,
      highlight,
      pressActivity,
      longPressActivity,
      hoverActivity,
      pressDependency,
      clearSelection,
    }),
    [editable, selectedGUID, hoveredGUID, linkSourceGUID, highlight, pressActivity, longPressActivity, hoverActivity, pressDependency, clearSelection],
  );
}

export type PMNetworkInteraction = ReturnType<typeof useNetworkInteraction>;
