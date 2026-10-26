// Manual calculation mode (A2): an action that reads the dates of the plan (Post, MS Project export) calculates it first when edits are pending
// (documentation/MORE_GANTT_ProjectCalculationAutomaticOrManual.html, 4.5). Automatic mode, or nothing pending: does nothing. Returns true when it calculated.
import { usePMStore } from '../../store/store_pm';
import { pendingCountOfState } from '../../store/storeDerive';

export function ensureCalculated(): boolean {
  const s = usePMStore.getState?.();
  if (!s || s.calculationMode !== 'manual' || pendingCountOfState(s) === 0) return false;
  s.calculateProject();
  return true;
}
