// The two commands of the component menus (3D view right click, Task menu): Share and Go to the component screen.
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { safeReturnToRoute } from '../../../lib/returnToRoute';
import { dashboardProjectPath } from '../../view/project/dashboardDeepLink';
import type { BimElementRow } from '../model/bimModel';
import { BIM_COMPONENT_ROUTE, bimComponentParams } from './bimComponentModel';
import type { BimViewRegistration } from './bimComponentRegistry';
import { shareBimComponent } from './shareBimComponent';

/** the place Back returns to: the page the user looks at now (web: its address), else the dashboard of the project - the dashboard remembers its BIM view and the last task */
export function currentPlaceForBack(projectGUID: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const here = safeReturnToRoute(`${window.location.pathname}${window.location.search || ''}`);
    if (here && !here.startsWith(BIM_COMPONENT_ROUTE)) return here;
  }
  return dashboardProjectPath(projectGUID);
}

export function useBimComponentActions() {
  const router = useRouter();
  /** Go to component: the screen of ONE component, in this window; `returnTo` makes Back (the app bar's and the screen's own) return exactly to where the user was */
  const goTo = useCallback(
    (projectGUID: string, element: Pick<BimElementRow, 'ifcGuid' | 'taskGUID'>) => {
      router.push({ pathname: BIM_COMPONENT_ROUTE, params: bimComponentParams({ projectGUID, elementGUID: element.ifcGuid, taskGUID: element.taskGUID, returnTo: currentPlaceForBack(projectGUID) }) } as any);
    },
    [router]
  );
  const share = useCallback((view: BimViewRegistration, element: BimElementRow) => shareBimComponent(view, element), []);
  return { goTo, share };
}
