// useOpenFactInput - open the fact input document from ANYWHERE a task GUID or a task line GUID is known (the Finances table, the task tree, a report ...):
//   const openFactInput = useOpenFactInput();   openFactInput({ taskGUID, taskLineGUID, genus });
// The document itself is the route /pm/project/task/fact (app/pm/project/task/fact), so a deep link works too.
import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { FACT_INPUT_ROUTE, OpenFactInputParams, factInputRouteParams } from './factInputModel';

export function useOpenFactInput(): (params: OpenFactInputParams) => void {
  const router = useRouter();
  return useCallback((params: OpenFactInputParams) => {
    if (!params?.taskGUID) return;
    router.push({ pathname: FACT_INPUT_ROUTE, params: factInputRouteParams(params) } as any);
  }, [router]);
}
