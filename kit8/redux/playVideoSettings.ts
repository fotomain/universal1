// uxuiState.PlayVideoSettings: how the buttons of the video player behave (kit8/ui/components/media/VideoControls*).
// Pure: no redux import, so the slice and the player can both use it. The state is persisted (redux-persist); a state saved by an older
// version has none of it, so every reader goes through normalizePlayVideoSettings / selectPlayVideoSettings.

export interface PlayVideoSettings {
  /** the buttons over the video disappear after this many seconds without a mouse move / touch */
  hideButtonsAfter: number;
  /** the - / + buttons and the double touch / double click at the left / right part of the video jump this many seconds */
  rewindSecondsValue: number;
}

export const PLAY_VIDEO_DEFAULTS: PlayVideoSettings = { hideButtonsAfter: 2.5, rewindSecondsValue: 5 };

/** what the settings panel allows (the steppers of the panel move by `step`) */
export const PLAY_VIDEO_LIMITS = {
  hideButtonsAfter: { min: 1, max: 10, step: 0.5 },
  rewindSecondsValue: { min: 1, max: 60, step: 1 },
} as const;

function clean(value: unknown, fallback: number, min: number, max: number, decimals: number): number {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  const factor = 10 ** decimals;
  return Math.min(max, Math.max(min, Math.round(n * factor) / factor));
}

/** anything (missing, old, typed by hand) -> valid settings */
export function normalizePlayVideoSettings(raw?: Partial<PlayVideoSettings> | null): PlayVideoSettings {
  const L = PLAY_VIDEO_LIMITS;
  const D = PLAY_VIDEO_DEFAULTS;
  return {
    hideButtonsAfter: clean(raw?.hideButtonsAfter, D.hideButtonsAfter, L.hideButtonsAfter.min, L.hideButtonsAfter.max, 1),
    rewindSecondsValue: clean(raw?.rewindSecondsValue, D.rewindSecondsValue, L.rewindSecondsValue.min, L.rewindSecondsValue.max, 0),
  };
}

/** selector: state.uxuiState.PlayVideoSettings, valid also for a state persisted before it existed */
export function selectPlayVideoSettings(state: any): PlayVideoSettings {
  const ux = state?.uxuiState;
  // for one day the key was called `uxuiPlayVideoSettings`: a device that saved values under that name keeps them
  return normalizePlayVideoSettings(ux?.PlayVideoSettings ?? ux?.uxuiPlayVideoSettings);
}
