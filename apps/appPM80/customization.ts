// appPM80 - what "Project Budget Management" adds to the shared app (registry: apps/appCustomization.ts; rules: documentation/APP_CUSTOMIZATION_RULES.html).
import type { AppCustomization } from '../../kit8/providers/AppCustomizationProvider';
import HomeAppPM80 from './home/HomeAppPM80';

/** the home FAB: the items it has anyway (Record Video, Record Audio, Scroll Top) + these three, nearest the button */
export const PM80_FAB_ROUTES = ['/home'];

export const appPM80Customization: AppCustomization = {
  homeComponent: HomeAppPM80,
  fabExtraActions: [
    {
      id: 'pm80-new-project',
      label: 'New Project',
      icon: 'folder-plus-outline',
      routes: PM80_FAB_ROUTES,
      run: ({ router, signedIn }) => {
        // a guest signs in first and comes back Home
        if (!signedIn) {
          router.push({ pathname: '/user/signin', params: { returnTo: '/home' } });
          return;
        }
        // the Create New Project Assistant: Assistant mode | Manual input (the New project window) | Import Project
        router.push('/pm/project/assistant');
      },
    },
    {
      id: 'pm80-all-projects',
      label: 'All Projects',
      icon: 'folder-multiple-outline',
      routes: PM80_FAB_ROUTES,
      run: ({ router }) => router.push('/catalog/project'),
    },
    {
      id: 'pm80-add-calendar-event',
      label: 'Add Calendar event',
      icon: 'calendar-plus',
      routes: PM80_FAB_ROUTES,
      run: ({ router }) => router.push({ pathname: '/user/calendar', params: { new: 'event' } }),
    },
  ],
};
