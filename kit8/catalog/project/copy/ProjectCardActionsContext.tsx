// What the menu of a project card can do beyond the props the generic list passes (onEdit / onDelete): the copies.
// ProjectList provides it, ProjectCard reads it - the web list builds its cards itself and cannot take extra props.

import { createContext, useContext } from 'react';

export interface ProjectCardActions {
  /** a new project with the settings of this one, no tasks */
  onCopy?: (projectGUID: string) => void;
  /** the same + tasks, links and task lines */
  onCopyWithTasks?: (projectGUID: string) => void;
  /** the same + the BIM model (only offered for a BIM project: rowJSON.projectIsBIMBased) */
  onCopyWithBim?: (projectGUID: string) => void;
}

export const ProjectCardActionsContext = createContext<ProjectCardActions>({});

export const useProjectCardActions = (): ProjectCardActions => useContext(ProjectCardActionsContext);
