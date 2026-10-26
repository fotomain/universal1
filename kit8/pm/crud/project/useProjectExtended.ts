// The project-level commands of the Gantt Extended functions (kit8/pm/extended): one whole-row update of project_table.rowJSON.
//   saveProjectJSON(patch)   merges `patch` into the rowJSON of the project (default: the selected one); optimistic (the store follows through the cache), then saved.
import { useMemo } from 'react';
import { usePMStore } from '../../store/store_pm';
import { useUpdateProjectMutation } from './projectQueries';

export function useProjectExtended(ownerGUID: string, projectGUID: string | null) {
  const updateProject = useUpdateProjectMutation(ownerGUID);
  return useMemo(
    () => ({
      saveProjectJSON: (patch: Record<string, unknown>, guid: string | null = projectGUID) => {
        const cur = guid ? usePMStore.getState().projectsById[guid] : undefined;
        if (!guid || !cur) return;
        updateProject.mutate({ rowGUID: guid, patch: { rowJSON: { ...cur.rowJSON, ...patch } as any } });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectGUID, updateProject.mutate]
  );
}
