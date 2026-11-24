// "Share" of a BIM component: the PICTURE of the component (the camera looks at it, the rest of the model is dimmed) + the DETAILS text (project, place in the plan, class, type,
// IFC properties, link to its screen). The picture comes from the mounted BIM view (registry); on a phone, where a WebGL canvas cannot be read back, it is a screenshot of the screen.
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { captureAppScreenshot, shareImageWithText, type ShareScreenshotResult } from '../../../lib/shareScreenshot';
import { usePMStore } from '../../store/store_pm';
import type { BimElementRow } from '../model/bimModel';
import { BIM_COMPONENT_ROUTE, bimComponentFileBase, bimComponentParams, buildBimComponentInfoText } from './bimComponentModel';
import type { BimViewRegistration } from './bimComponentRegistry';

/** the absolute link of the component screen (web: https://host/pm/bim/component?..., phone: the app scheme) */
export function bimComponentShareURL(projectGUID: string, elementGUID: string, taskGUID?: string | null): string {
  const queryParams = bimComponentParams({ projectGUID, elementGUID, taskGUID });
  try {
    return Linking.createURL(BIM_COMPONENT_ROUTE, { queryParams });
  } catch {
    const qs = new URLSearchParams(queryParams).toString();
    const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${BIM_COMPONENT_ROUTE}?${qs}`;
  }
}

/** the names above a task, outermost first */
export function taskPathOf(taskGUID: string | null | undefined, s = usePMStore.getState()): string[] {
  const out: string[] = [];
  if (!taskGUID) return out;
  for (let p = s.tree.parentById[taskGUID]; p; p = s.tree.parentById[p]) out.unshift(s.tasksById[p]?.rowJSON.taskDescription ?? p);
  return out;
}

/** the details text of one component of the view (reads the PM store for the project and the task) */
export function componentInfoText(view: BimViewRegistration, element: BimElementRow, properties: Record<string, any> | null): string {
  const s = usePMStore.getState();
  const task = element.taskGUID ? s.tasksById[element.taskGUID] : undefined;
  return buildBimComponentInfoText({
    projectName: s.projectsById[view.projectGUID]?.rowJSON.name ?? null,
    taskPath: taskPathOf(element.taskGUID, s),
    taskName: task?.rowJSON.taskDescription ?? null,
    element,
    storeyName: element.storeyGUID ? view.storeyNames.get(element.storeyGUID) ?? null : null,
    properties,
    link: bimComponentShareURL(view.projectGUID, element.ifcGuid, element.taskGUID),
  });
}

export async function shareBimComponent(view: BimViewRegistration, element: BimElementRow): Promise<ShareScreenshotResult> {
  const [props, shot] = await Promise.all([view.properties(element.ifcGuid).catch(() => null), view.capture(element.ifcGuid).catch(() => null)]);
  // the canvas could not be read (a phone): a screenshot of the screen, where the component is lit
  const b64 = shot ?? (await captureAppScreenshot());
  return shareImageWithText({ b64, text: componentInfoText(view, element, props), title: element.name || element.ifcGuid, fileBase: bimComponentFileBase(element) });
}
