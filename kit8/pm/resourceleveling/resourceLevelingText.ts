// resourceLevelingText - the words of Resource optimization that depend on a code (a reason a task was moved, a reason a conflict could not be solved) and the sentence of a conflict.
// Every text goes through pmT, looked up at call time, so it follows a language change. Pure apart from pmT.
import { pmT } from '../i18n/pmT';
import type { LevelingConflict, MoveReason, UnresolvedCode } from './resourceLevelingModel';
import { resourceGuidOfKey, resourceKindOfKey } from './resourceLevelingModel';

export function moveReasonText(code: MoveReason | null | undefined): string {
  switch (code) {
    case 'priorityYield': return pmT('Lower priority than the task that keeps the resource');
    case 'slackYield': return pmT('More slack than the task that keeps the resource');
    case 'laterStartYield': return pmT('Starts later than the task that keeps the resource');
    case 'idYield': return pmT('Comes after the task that keeps the resource');
    case 'foreignYield': return pmT('The resource is held by other projects');
    default: return '';
  }
}

export function unresolvedText(code: UnresolvedCode | undefined): string {
  switch (code) {
    case 'frozenPosted': return pmT('The task is posted and keeps its dates');
    case 'frozenStarted': return pmT('The task has started or is finished');
    case 'frozenFact': return pmT('The task has a posted fact');
    case 'priority1000': return pmT('The task has priority 1000: it is never moved');
    case 'constraintHonored': return pmT('The task must start or finish on a date');
    case 'manualTask': return pmT('The task is scheduled manually');
    case 'outOfScope': return pmT('The task is not in this run');
    case 'slackLimit': return pmT('Moving needs more than the slack (Smoothing keeps the project dates)');
    case 'noCapacityInHorizon': return pmT('No later day has the room');
    case 'taskExceedsCapacity': return pmT('The task alone needs more hours than the resource has: split it or use another resource');
    case 'capacityUnknown': return pmT('The calendar of the resource has no row for the day');
    case 'foreignLoad': return pmT('The other projects hold the resource');
    case 'passLimit': return pmT('The run was stopped by its safety counter');
    default: return pmT('Could not be solved');
  }
}

/** hours with at most 2 decimals, no trailing zeros: 8 · 7.5 · 0.25 */
export const hoursText = (h: number): string => String(Math.round(h * 100) / 100);

/** "person Anna: 11 h on 2026-10-12, capacity 8 h" - the resource is named by the caller (names are not in the engine) */
export function conflictSentence(c: LevelingConflict, resourceTitle: string, dayText: string): string {
  void resourceKindOfKey; void resourceGuidOfKey;
  if (c.capacity === null) return pmT('{{resource}}: {{hours}} h on {{day}}, the calendar has no capacity for this day', { resource: resourceTitle, hours: hoursText(c.booked + c.foreign), day: dayText });
  return pmT('{{resource}}: {{hours}} h on {{day}}, capacity {{capacity}} h', { resource: resourceTitle, hours: hoursText(c.booked + c.foreign), day: dayText, capacity: hoursText(c.capacity) });
}
