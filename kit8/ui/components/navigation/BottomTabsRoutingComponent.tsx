// The bottom tab bar moved to kit8/ui/components/app_bottom_tabs (ApplicationBottomTabsApp, adapted to the design systems).
// This file stays so the old imports keep working.
import ApplicationBottomTabsApp from '../app_bottom_tabs/ApplicationBottomTabsApp';

export type { TabItem } from '../app_bottom_tabs/appBottomTabsModel';
export type { ApplicationBottomTabsAppProps as BottomTabsRoutingComponentProps } from '../app_bottom_tabs/ApplicationBottomTabsApp';

export default ApplicationBottomTabsApp;
