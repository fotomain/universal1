// React Query hooks for dependencies (DAG edges) and the closure table.

import { useQuery } from '@tanstack/react-query';
import { describeDependencyProblem, validateNewDependency } from '../../view/project/scheduling';
import { depKey, PMDependencyJSON, PMLinkType, PMTaskDependencyRow } from '../../model/types';
import { PMDependencyPatch } from '../api/dependencyApi';
import { pmKeys, usePMApi, useProjectMutation } from '../shared/queryShared';

/** Transitive blockers / dependents from the closure table. */
export function useReadTaskClosureQuery(taskGUID: string | null | undefined, direction: 'up' | 'down') {
  const api = usePMApi();
  return useQuery({
    queryKey: direction === 'up' ? pmKeys.upstream(taskGUID) : pmKeys.downstream(taskGUID),
    queryFn: () => (direction === 'up' ? api.readUpstream(taskGUID as string) : api.readDownstream(taskGUID as string)),
    enabled: !!taskGUID,
  });
}

export interface PMCreateDependencyVars {
  rowGUID: string;
  dependsOnGUID: string;
  linkType?: PMLinkType;
  lagDays?: number;
  rowJSON?: PMDependencyJSON;
}

export function useCreateDependencyMutation(ownerGUID: string | null | undefined, projectGUID: string | null | undefined) {
  const api = usePMApi();
  const build = (vars: PMCreateDependencyVars): PMTaskDependencyRow => ({
    rowGUID: vars.rowGUID,
    rowDependsOnGUID: vars.dependsOnGUID,
    projectGUID: projectGUID as string,
    rowOwnerGUID: ownerGUID as string,
    linkType: vars.linkType || 'FS',
    lagDays: vars.lagDays || 0,
    rowJSON: vars.rowJSON || {},
  });
  return useProjectMutation<PMCreateDependencyVars, PMTaskDependencyRow>(
    projectGUID,
    async (vars, current) => {
      // validation already ran in onMutate against the pre-mutation data; re-check the
      // server-bound edge against current data minus itself for safety.
      const others = (current?.deps || []).filter((d) => depKey(d) !== `${vars.dependsOnGUID}>${vars.rowGUID}`);
      const problem = validateNewDependency(current?.tasks || [], others, vars.dependsOnGUID, vars.rowGUID);
      if (problem) throw new Error(describeDependencyProblem(problem));
      return api.createDependency(build(vars));
    },
    (data, vars) => {
      const problem = validateNewDependency(data.tasks, data.deps, vars.dependsOnGUID, vars.rowGUID);
      return problem ? data : { ...data, deps: [...data.deps, build(vars)] };
    }
  );
}

export function useUpdateDependencyMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<{ rowGUID: string; dependsOnGUID: string; patch: PMDependencyPatch }, void>(
    projectGUID,
    (v) => api.updateDependency(v.rowGUID, v.dependsOnGUID, v.patch),
    (data, v) => ({
      ...data,
      deps: data.deps.map((d) =>
        d.rowGUID === v.rowGUID && d.rowDependsOnGUID === v.dependsOnGUID
          ? { ...d, ...v.patch, rowJSON: v.patch.rowJSON ? { ...(d.rowJSON || {}), ...v.patch.rowJSON } : d.rowJSON }
          : d
      ),
    })
  );
}

/** Removes ONE dependency (never a task). */
export function useDeleteDependencyMutation(projectGUID: string | null | undefined) {
  const api = usePMApi();
  return useProjectMutation<{ rowGUID: string; dependsOnGUID: string }, void>(
    projectGUID,
    (v) => api.deleteDependency(v.rowGUID, v.dependsOnGUID),
    (data, v) => ({ ...data, deps: data.deps.filter((d) => !(d.rowGUID === v.rowGUID && d.rowDependsOnGUID === v.dependsOnGUID)) })
  );
}
