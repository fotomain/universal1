// The ONLY place where the 3D view and the task tree meet (documentation/BIM_WBS.html section 5).
//   task (or stage) pressed / checked in the tree -> its elements (and the elements of every task below a stage) are HIGHLIGHTED, the camera moves to them
//   element pressed in 3D                        -> the tree scrolls to its task (parents expanded, row selected), or to its stage when the element has no task: setSelected + requestFocus
//   empty space pressed                          -> the highlight is cleared (the task stays selected)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePMStore } from '../../store/store_pm';
import type { PMTaskRow } from '../../model/types';
import type { BimElementRow, BimManifest } from '../model/bimModel';
import { unionBoxes } from './bimCamera';

/** the task and every task below it (a stage = all its tasks); by tree path, no recursion over the store */
export function taskWithDescendants(tasksById: Record<string, Pick<PMTaskRow, 'treePath'>>, rootGUID: string): string[] {
  const root = tasksById[rootGUID];
  if (!root) return [];
  const prefix = root.treePath + '.';
  const out = [rootGUID];
  for (const g in tasksById) if (g !== rootGUID && tasksById[g].treePath.startsWith(prefix)) out.push(g);
  return out;
}

/** taskGUID -> the IFC ids of its elements */
export function elementsByTask(elements: BimElementRow[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const e of elements) if (e.taskGUID) (m.get(e.taskGUID) ?? m.set(e.taskGUID, []).get(e.taskGUID)!).push(e.ifcGuid);
  return m;
}

/** the IFC ids to highlight for a set of selected tasks */
export function highlightedFor(selected: string[], tasksById: Record<string, Pick<PMTaskRow, 'treePath'>>, byTask: Map<string, string[]>): Set<string> {
  const out = new Set<string>();
  for (const root of selected) for (const t of taskWithDescendants(tasksById, root)) for (const g of byTask.get(t) ?? []) out.add(g);
  return out;
}

/** what to select in the tree when an element is pressed: its task, else the stage of its storey; null = nothing to select */
export function treeTargetOfElement(el: Pick<BimElementRow, 'taskGUID' | 'storeyGUID'> | undefined, manifest: BimManifest): string | null {
  if (!el) return null;
  if (el.taskGUID) return el.taskGUID;
  return manifest.storeys.find((s) => s.storeyGUID === el.storeyGUID)?.stageGUID ?? null;
}

export function useBimTaskBridge(manifest: BimManifest | null, elements: BimElementRow[], zoomToSelection: boolean) {
  const selectedGUID = usePMStore((s) => s.selectedGUID);
  const checkedGUIDs = usePMStore((s) => s.checkedGUIDs);
  const tasksById = usePMStore((s) => s.tasksById);
  const byTask = useMemo(() => elementsByTask(elements), [elements]);
  const byGuid = useMemo(() => new Map(elements.map((e) => [e.ifcGuid, e])), [elements]);
  const [cleared, setCleared] = useState<string | null>(null);

  const selectionKey = useMemo(() => [selectedGUID ?? '', ...Object.keys(checkedGUIDs).sort()].join('|'), [selectedGUID, checkedGUIDs]);
  // an empty press clears the highlight until the selection changes
  useEffect(() => setCleared(null), [selectionKey]);

  const highlighted = useMemo(() => {
    if (cleared === selectionKey) return new Set<string>();
    const roots = [...(selectedGUID ? [selectedGUID] : []), ...Object.keys(checkedGUIDs).filter((g) => g !== selectedGUID)];
    return highlightedFor(roots, tasksById, byTask);
  }, [cleared, selectionKey, selectedGUID, checkedGUIDs, tasksById, byTask]);

  const zoomBox = useMemo(() => (zoomToSelection && highlighted.size ? unionBoxes([...highlighted].map((g) => byGuid.get(g)?.bbox).filter(Boolean) as number[][]) : null), [zoomToSelection, highlighted, byGuid]);
  const zoomNonce = useRef(0);
  const lastKey = useRef('');
  // a press ON the 3D view does not move the camera (the user is looking at it); a press in the tree does
  const fromViewer = useRef(false);
  if (zoomBox && lastKey.current !== selectionKey) {
    lastKey.current = selectionKey;
    if (fromViewer.current) fromViewer.current = false;
    else zoomNonce.current += 1;
  }

  const onElementPress = useCallback(
    (ifcGuid: string) => {
      if (!manifest) return;
      const target = treeTargetOfElement(byGuid.get(ifcGuid), manifest);
      if (!target) return;
      const s = usePMStore.getState();
      fromViewer.current = true;
      s.setSelected(target);
      s.requestFocus(target);
    },
    [manifest, byGuid]
  );
  const onEmptyPress = useCallback(() => setCleared(selectionKey), [selectionKey]);

  return { highlighted, zoomBox, zoomNonce: zoomNonce.current, onElementPress, onEmptyPress, elementOf: (g: string) => byGuid.get(g) };
}
