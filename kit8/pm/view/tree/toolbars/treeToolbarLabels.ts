// The words of the "+ Stage" / "+ Task" buttons of the tree toolbar. The Project dashboard says Stage / Task; a screen with its own vocabulary (the Estimation dashboard: Section / Line) wraps its
// tree in `PMTreeLabelsContext.Provider` (PMProjectTreeHost `labels`). The names are English words that go through pmT; the defaults are the old texts, so nothing else changes.
import { createContext, useContext } from 'react';

export interface PMTreeLabels {
  stage: string;
  substage: string;
  task: string;
}

export const DEFAULT_PM_TREE_LABELS: PMTreeLabels = { stage: 'Stage', substage: 'Substage', task: 'Task' };
/** the Estimation dashboard: a stage is a section of the estimate, a task is a line */
export const ESTIMATION_TREE_LABELS: PMTreeLabels = { stage: 'Section', substage: 'Subsection', task: 'Line' };

export const PMTreeLabelsContext = createContext<PMTreeLabels>(DEFAULT_PM_TREE_LABELS);
export const usePMTreeLabels = (): PMTreeLabels => useContext(PMTreeLabelsContext);
