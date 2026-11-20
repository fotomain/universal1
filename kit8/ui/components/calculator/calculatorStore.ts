// calculatorStore - the little shared state of the calculators: the MEMORY (M+ / M- / MR / MC; the same number in the calculator of a field and in the
// standalone window) and the standalone WINDOW (open or not, where it stands). A module level store read with useSyncExternalStore: no provider, no redux.
import { useSyncExternalStore } from 'react';

export interface CalculatorStoreState {
  memory: number;
  windowOpen: boolean;
  /** top left corner of the standalone window; null = not placed yet (the host puts it at the top right) */
  windowX: number | null;
  windowY: number | null;
}

let state: CalculatorStoreState = { memory: 0, windowOpen: false, windowX: null, windowY: null };
const listeners = new Set<() => void>();

const set = (patch: Partial<CalculatorStoreState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

export const getCalculatorState = () => state;
export const subscribeCalculator = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const setCalculatorMemory = (memory: number) => set({ memory });
export const openCalculatorWindow = () => set({ windowOpen: true });
export const closeCalculatorWindow = () => set({ windowOpen: false });
export const toggleCalculatorWindow = () => set({ windowOpen: !state.windowOpen });
export const setCalculatorWindowPosition = (windowX: number, windowY: number) => set({ windowX, windowY });
/** tests */
export const resetCalculatorStore = () => { state = { memory: 0, windowOpen: false, windowX: null, windowY: null }; listeners.forEach((l) => l()); };

export function useCalculatorStore(): CalculatorStoreState {
  return useSyncExternalStore(subscribeCalculator, getCalculatorState, getCalculatorState);
}
