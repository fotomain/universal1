// The windows of Resource optimization are driven by this store (zustand), the way BusyConflictsWindow is: a command sets the state, the host window reads it.
import { create } from 'zustand';
import type { LevelingPlan, PlanLevelingArgs } from './resourceLevelingRun';

export interface LevelingPreview {
  plan: LevelingPlan;
  /** the data the plan was made from: "Keep their dates" makes the same run again with the posted tasks frozen */
  args: PlanLevelingArgs;
  mode: 'manual' | 'automatic' | 'fast';
  /** updated_at of the tasks when the plan was read: a task edited since stops the apply (SQL 40001) */
  stamps: Record<string, string>;
  /** the answer to the question about the posted tasks, once it has been given */
  postedChoice?: 'unpostAndMove' | 'moveAndPostAgain' | 'keep';
}

interface State {
  preview: LevelingPreview | null;
  postedDialog: boolean;
  history: boolean;
  busy: boolean;
  setPreview: (p: LevelingPreview | null) => void;
  setPostedDialog: (open: boolean) => void;
  setHistory: (open: boolean) => void;
  setBusy: (b: boolean) => void;
}

export const useResourceLevelingUiStore = create<State>((set) => ({
  preview: null,
  postedDialog: false,
  history: false,
  busy: false,
  setPreview: (preview) => set({ preview, postedDialog: false }),
  setPostedDialog: (postedDialog) => set({ postedDialog }),
  setHistory: (history) => set({ history }),
  setBusy: (busy) => set({ busy }),
}));
