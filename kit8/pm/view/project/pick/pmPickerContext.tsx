// pmPickerContext - the project dashboard used as a PICKER of a task or of a task line (kit8/documents/vendor/lineplace: the lines of a multi project vendor invoice / purchase order).
// PMProjectDashboard gets `picker`, provides it here, and the parts that know a task / a line read it:
//   PMProjectFinancesView         a "Select this task" button in its toolbar (picker.mode 'task' | 'line')
//   PMProjectTaskFinancesCRUD     the row menu of a line gets "Select this line" (picker.mode 'line'); a click on a read only cell does the same
// Outside a picker the context is null and nothing changes.
import React, { createContext, useContext } from 'react';

export type PMPickerMode = 'task' | 'line';
export interface PMPickedPlace { projectGUID: string; taskGUID: string; taskLineGUID?: string | null; genus?: string | null }
export interface PMPicker {
  /** 'task': the task is the answer; 'line': a line of the Finances table is the answer (the task can be picked too) */
  mode: PMPickerMode;
  onPick: (place: PMPickedPlace) => void;
}

const PMPickerContext = createContext<PMPicker | null>(null);
export const PMPickerProvider = PMPickerContext.Provider;
export const usePMPicker = (): PMPicker | null => useContext(PMPickerContext);

/** pure: what a click on a task / a line answers */
export function pickedTask(projectGUID: string, taskGUID: string): PMPickedPlace { return { projectGUID, taskGUID, taskLineGUID: null }; }
export function pickedLine(projectGUID: string, taskGUID: string, taskLineGUID: string, genus?: string | null): PMPickedPlace { return { projectGUID, taskGUID, taskLineGUID, genus: genus ?? null }; }

export function PMPickerScope({ picker, children }: { picker?: PMPicker | null; children: React.ReactNode }) {
  return <PMPickerContext.Provider value={picker ?? null}>{children}</PMPickerContext.Provider>;
}
