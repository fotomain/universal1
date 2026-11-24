// The mounted BIM view (PMProjectBimView) registers what the OTHER menus need: the task context menu (PMTaskRowMenu) asks "has this task exactly one component?", and "Share"
// asks for the picture of a component. The elements live in the React state of the view, not in the PM store, so this small store is the bridge (read: the menus, write: the view).
import { create } from 'zustand';
import type { BimElementRow } from '../model/bimModel';
import { elementsOfTasks, singleElementOfTask } from './bimComponentModel';

export interface BimViewRegistration {
  projectGUID: string;
  modelGUID: string;
  byGuid: Map<string, BimElementRow>;
  byTask: Map<string, BimElementRow[]>;
  /** storeyGUID -> the name of the storey */
  storeyNames: Map<string, string>;
  /** the PNG (base64, no "data:" prefix) of ONE component: the camera looks at it, the rest of the model is dimmed; null = it cannot be taken now */
  capture: (ifcGuid: string) => Promise<string | null>;
  /** the IFC property sets of a component (read when asked), null = none / not readable */
  properties: (ifcGuid: string) => Promise<Record<string, any> | null>;
}

interface RegistryState {
  view: BimViewRegistration | null;
  set: (v: BimViewRegistration | null) => void;
}

export const useBimViewRegistry = create<RegistryState>((set) => ({ view: null, set: (view) => set({ view }) }));

export function makeBimViewRegistration(p: Omit<BimViewRegistration, 'byGuid' | 'byTask' | 'storeyNames'> & { elements: BimElementRow[]; storeys: Array<{ storeyGUID: string; name: string }> }): BimViewRegistration {
  return {
    projectGUID: p.projectGUID,
    modelGUID: p.modelGUID,
    capture: p.capture,
    properties: p.properties,
    byGuid: new Map(p.elements.map((e) => [e.ifcGuid, e])),
    byTask: elementsOfTasks(p.elements),
    storeyNames: new Map((p.storeys ?? []).map((x) => [x.storeyGUID, x.name])),
  };
}

/** the view of this project, or null while no BIM view of it is mounted */
export const bimViewOf = (projectGUID: string | null | undefined): BimViewRegistration | null => {
  const v = useBimViewRegistry.getState().view;
  return v && projectGUID && v.projectGUID === projectGUID ? v : null;
};

/** the ONE component of a task (hook: the menu re-renders when a view comes or goes); undefined = no BIM view, or the task has none / many components */
export function useBimSingleComponentOfTask(projectGUID: string | null | undefined, taskGUID: string | null | undefined): { view: BimViewRegistration; element: BimElementRow } | undefined {
  const view = useBimViewRegistry((s) => s.view);
  if (!view || !projectGUID || view.projectGUID !== projectGUID) return undefined;
  const element = singleElementOfTask(view.byTask, taskGUID);
  return element ? { view, element } : undefined;
}
