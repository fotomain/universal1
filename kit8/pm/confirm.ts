import { approvePM } from './PMApproveYesNoCancelModalWindow';

/**
 * Legacy helper: now shows PMApproveYesNoCancelModalWindow (platform confirm only when
 * no window is mounted). true = "Yes".
 */
export function confirmAsync(title: string, message: string, okLabel = 'Delete'): Promise<boolean> {
  return approvePM({ title, message, yesLabel: okLabel, destructive: okLabel === 'Delete' });
}
