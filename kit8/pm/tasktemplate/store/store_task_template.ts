// Zustand store of the task template windows (kit8/pm/tasktemplate): which window is open and for which task.
//   savePrompt   "Save to template" (a new template from the task) / "Rename template"
//   fillPicker   "Fill from template" (the task that takes the template)
// The list of the templates itself is a React Query (crud/useTaskTemplates.ts).

import { create } from 'zustand';

export interface PMTaskTemplateSavePrompt {
  mode: 'save' | 'rename';
  /** save: the task to store */
  taskGUID?: string;
  /** rename: the template */
  templateGUID?: string;
  title: string;
  description: string;
}

export interface PMTaskTemplateStoreState {
  savePrompt: PMTaskTemplateSavePrompt | null;
  fillPickerTaskGUID: string | null;
  /** a save / fill / delete is running */
  busy: boolean;
  setSavePrompt: (prompt: PMTaskTemplateSavePrompt | null) => void;
  setFillPickerTaskGUID: (taskGUID: string | null) => void;
  setBusy: (busy: boolean) => void;
}

export const usePMTaskTemplateStore = create<PMTaskTemplateStoreState>((set) => ({
  savePrompt: null,
  fillPickerTaskGUID: null,
  busy: false,
  setSavePrompt: (savePrompt) => set({ savePrompt }),
  setFillPickerTaskGUID: (fillPickerTaskGUID) => set({ fillPickerTaskGUID }),
  setBusy: (busy) => set({ busy }),
}));
