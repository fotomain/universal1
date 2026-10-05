// UI state of the user calendar that must be reachable from anywhere in the app (the calendar
// screen, a reminder, a share intent, the app bar): which entry is open in the editor / the
// quick view. The modal windows themselves are mounted once by UserCalendarNotifier (root layout).

import { create } from 'zustand';
import { UserCalendarDueReminder, UserCalendarEventJSON, UserCalendarEventRow, UserCalendarOccurrence } from '../../../register/user_calendar';

export interface UserCalendarEditorState {
  /** the saved row being edited (undefined = a new entry) */
  row?: UserCalendarEventRow;
  /** what the editor starts with */
  draft: UserCalendarEventJSON;
}

export interface UserCalendarViewState {
  occurrence: UserCalendarOccurrence;
  /** set when a reminder opened the window */
  reminder?: UserCalendarDueReminder;
}

interface UserCalendarUiState {
  editor: UserCalendarEditorState | null;
  view: UserCalendarViewState | null;
  openEditor: (editor: UserCalendarEditorState) => void;
  closeEditor: () => void;
  openView: (view: UserCalendarViewState) => void;
  closeView: () => void;
}

export const useUserCalendarUiStore = create<UserCalendarUiState>((set) => ({
  editor: null,
  view: null,
  openEditor: (editor) => set({ editor, view: null }),
  closeEditor: () => set({ editor: null }),
  openView: (view) => set({ view }),
  closeView: () => set({ view: null }),
}));
