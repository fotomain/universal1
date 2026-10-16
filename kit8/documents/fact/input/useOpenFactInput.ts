// useOpenFactInput - open the fact input document from ANYWHERE a task GUID or a task line GUID is known (the Finances table, the task tree, a report ...):
//   const openFactInput = useOpenFactInput();   openFactInput({ taskGUID, taskLineGUID, genus });
// `newWindow` (the Task menu "Create based on this → Fact input"): on the web the document opens in a NEW browser window (blocked / iOS / Android: this app).
// The document itself is the route /pm/project/task/fact (app/pm/project/task/fact), so a deep link works too.
import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { FACT_INPUT_ROUTE, OpenFactInputParams, factInputRouteParams } from './factInputModel';

export function useOpenFactInput(): (params: OpenFactInputParams, opts?: { newWindow?: boolean }) => void {
  const router = useRouter();
  return useCallback((params: OpenFactInputParams, opts?: { newWindow?: boolean }) => {
    if (!params?.taskGUID) return;
    if (opts?.newWindow && Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const q = Object.entries(factInputRouteParams(params)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
        if (window.open(q ? `${FACT_INPUT_ROUTE}?${q}` : FACT_INPUT_ROUTE, '_blank')) return;
      } catch {
        // the browser blocked the new window: this window below
      }
    }
    router.push({ pathname: FACT_INPUT_ROUTE, params: factInputRouteParams(params) } as any);
  }, [router]);
}
