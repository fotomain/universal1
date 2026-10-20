// State of the reminders on THIS device: the user's switch (kept in AsyncStorage) and the status of the last sync
// (read by ReminderSettingsWindow).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { ReminderStatus } from './reminderTypes';

const ENABLED_KEY = 'reminder.enabled';

interface ReminderState extends ReminderStatus {
  /** "Reminders on this device" (default on) */
  enabled: boolean;
  loaded: boolean;
  /** raised to make useReminderSync run again (after a permission answer or a switch) */
  nonce: number;
  requestSync: () => void;
  load: () => Promise<void>;
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: Partial<ReminderStatus>) => void;
}

export const useReminderStore = create<ReminderState>((set, get) => ({
  enabled: true,
  loaded: false,
  nonce: 0,
  requestSync: () => set((s) => ({ nonce: s.nonce + 1 })),
  permission: 'undetermined',
  scheduled: 0,
  nextFireMs: null,
  lastSyncAt: null,
  error: null,
  load: async () => {
    if (get().loaded) return;
    try {
      const v = await AsyncStorage.getItem(ENABLED_KEY);
      set({ enabled: v !== 'false', loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  setEnabled: (enabled) => {
    set({ enabled });
    AsyncStorage.setItem(ENABLED_KEY, String(enabled)).catch(() => {});
  },
  setStatus: (status) => set(status),
}));
