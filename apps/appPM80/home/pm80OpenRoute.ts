// pm80OpenRoute - every link of the PM80 home opens its screen in a NEW browser window (web);
// on iOS / Android (no windows) it is pushed in this app. A blocked pop-up falls back to this window.
// Same pattern as `openTaskEditWindow` (kit8/pm/view/task/edit/taskEditWindowLink.ts).
import { Platform } from 'react-native';

export function openPM80Route(route: string, router: { push: (to: any) => void }): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      if (window.open(route, '_blank')) return;
    } catch {
      // the browser blocked the new window: this window below
    }
  }
  try {
    router.push(route as any);
  } catch {
    // route unavailable (standalone test)
  }
}
