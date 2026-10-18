// useTaskScope - the scope (task / task line) of a document list: starts from the props (route params), is cleared by the chip, and follows a NEW link opened while the list is mounted.
// taskName: the name of the scope's task (one read of project_task_table; '' until it is read or when the task is not visible). No react-query here: a list rendered without a
// QueryClientProvider (its tests) still works; the read happens only while a scope is active.
import { useEffect, useState } from 'react';
import { useSupabase } from '../../providers/WithSupabase';
import { EMPTY_TASK_SCOPE, TaskScope, sameTaskScope, taskScopeActive } from './taskScopeModel';

export function useTaskScope(initial: TaskScope | null | undefined) {
  const start = initial && taskScopeActive(initial) ? initial : EMPTY_TASK_SCOPE;
  const [scope, setScope] = useState<TaskScope>(start);
  // a new link (other params) replaces the scope
  useEffect(() => { setScope((cur) => (sameTaskScope(cur, start) ? cur : start)); }, [start.taskGUID, start.taskLineGUID]); // eslint-disable-line react-hooks/exhaustive-deps
  const { supabase } = useSupabase();
  const [names, setNames] = useState<Record<string, string>>({});
  const taskGUID = scope.taskGUID;
  useEffect(() => {
    if (!taskGUID || names[taskGUID] !== undefined) return undefined;
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from('project_task_table').select('rowJSON').eq('rowGUID', taskGUID).maybeSingle();
        if (alive) setNames((n) => ({ ...n, [taskGUID]: String((data as any)?.rowJSON?.taskDescription ?? '') }));
      } catch {
        if (alive) setNames((n) => ({ ...n, [taskGUID]: '' }));
      }
    })();
    return () => { alive = false; };
  }, [taskGUID, supabase]); // eslint-disable-line react-hooks/exhaustive-deps
  return { scope, active: taskScopeActive(scope), clear: () => setScope(EMPTY_TASK_SCOPE), taskName: names[taskGUID] ?? '' };
}
