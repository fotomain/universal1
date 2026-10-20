// "A reminder is shown once per device": the keys that UserCalendarNotifier (the in-app modal) and the OS
// notification share, so a reminder that the OS already showed (or the user tapped) does not open the modal again.

import AsyncStorage from '@react-native-async-storage/async-storage';

export const SHOWN_KEY = 'userCalendar.shownReminders';
const WEEK_MS = 7 * 24 * 3600 * 1000;

export const shownKeyOf = (ownerGUID: string, key: string) => `${ownerGUID}:${key}`;

export async function readShownReminders(): Promise<Record<string, number>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(SHOWN_KEY)) || '{}') || {};
  } catch {
    return {};
  }
}

/** Remembers the keys as shown (and forgets the ones older than a week). */
export async function markRemindersShown(ownerGUID: string, keys: string[], nowMs = Date.now()): Promise<void> {
  if (!keys.length) return;
  const shown = await readShownReminders();
  keys.forEach((k) => (shown[shownKeyOf(ownerGUID, k)] = nowMs));
  Object.keys(shown).forEach((k) => nowMs - shown[k] > WEEK_MS && delete shown[k]);
  await AsyncStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
}
