// Zustand store of the subproject marks of the OPEN project: filled once by PMProjectDashboard (useProjectSubprojectMarks), read by the task tree and the Gantt chart.
import { create } from 'zustand';
import type { PMSubprojectMark } from './subprojectMarks';

interface State {
  projectGUID: string | null;
  marks: Record<string, PMSubprojectMark>;
  set: (projectGUID: string | null, marks: Record<string, PMSubprojectMark>) => void;
}

const NO_MARKS: Record<string, PMSubprojectMark> = Object.freeze({}) as Record<string, PMSubprojectMark>;

export const usePMSubprojectStore = create<State>((set) => ({
  projectGUID: null,
  marks: NO_MARKS,
  set: (projectGUID, marks) => set({ projectGUID, marks }),
}));

export { NO_MARKS as NO_SUBPROJECT_MARKS };
