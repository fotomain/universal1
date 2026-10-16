// openTaskScopedList - "Go to → Vendor invoices / Fact input": the list filtered for a task / task line opens in a NEW browser window (web) or in this app (iOS / Android).
import { Platform } from 'react-native';
import { taskScopeRouteParams, type TaskScope } from './taskScopeModel';

export function openTaskScopedList(route: string, scope: TaskScope, router: { push: (to: any) => void }): void {
  const params = taskScopeRouteParams(scope);
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
      if (window.open(q ? `${route}?${q}` : route, '_blank')) return;
    } catch {
      // the browser blocked the new window: the same window below
    }
  }
  router.push({ pathname: route, params } as any);
}
