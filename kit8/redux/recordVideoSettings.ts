// uxuiState.RecordVideoSettings: the settings of the video recorder (kit8/ui/components/media/RecordVideo*), the twin of
// playVideoSettings.ts. Pure: no redux import. The state is persisted (redux-persist); a state saved by an older version
// has none of it, so every reader goes through normalizeRecordVideoSettings / selectRecordVideoSettings.
// Design: documentation/CAMERA_DATE_TIME.html

/** the corner of the picture where the date and time stand */
export type RecordDateTimeOverPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export interface RecordVideoSettings {
  /** the date and time over the recorded video (a camcorder stamp) */
  recordDateTimeOverEnabled: boolean;
  recordDateTimeOverPosition: RecordDateTimeOverPosition;
}

/** the radio of the settings panel, in this order */
export const RECORD_DATE_TIME_OVER_POSITIONS: { id: RecordDateTimeOverPosition; label: string }[] = [
  { id: 'topLeft', label: 'Top Left' },
  { id: 'topRight', label: 'Top Right' },
  { id: 'bottomLeft', label: 'Bottom Left' },
  { id: 'bottomRight', label: 'Bottom Right' },
];

export const RECORD_VIDEO_DEFAULTS: RecordVideoSettings = { recordDateTimeOverEnabled: false, recordDateTimeOverPosition: 'bottomRight' };

export function isRecordDateTimeOverPosition(value: unknown): value is RecordDateTimeOverPosition {
  return RECORD_DATE_TIME_OVER_POSITIONS.some((p) => p.id === value);
}

/** anything (missing, old, typed by hand) -> valid settings */
export function normalizeRecordVideoSettings(raw?: Partial<RecordVideoSettings> | null): RecordVideoSettings {
  const D = RECORD_VIDEO_DEFAULTS;
  return {
    recordDateTimeOverEnabled: typeof raw?.recordDateTimeOverEnabled === 'boolean' ? raw.recordDateTimeOverEnabled : D.recordDateTimeOverEnabled,
    recordDateTimeOverPosition: isRecordDateTimeOverPosition(raw?.recordDateTimeOverPosition) ? raw!.recordDateTimeOverPosition! : D.recordDateTimeOverPosition,
  };
}

/** selector: state.uxuiState.RecordVideoSettings, valid also for a state persisted before it existed */
export function selectRecordVideoSettings(state: any): RecordVideoSettings {
  return normalizeRecordVideoSettings(state?.uxuiState?.RecordVideoSettings);
}
