import uxuiReducer, { resetPlayVideoSettings, setPlayVideoSettings } from '../../kit8/redux/uxuiSlice';
import { normalizePlayVideoSettings, selectPlayVideoSettings, PLAY_VIDEO_DEFAULTS, PLAY_VIDEO_LIMITS } from '../../kit8/redux/playVideoSettings';

describe('PlayVideoSettings defaults', () => {
  it('hide the buttons after 2.5 seconds, rewind 5 seconds', () => {
    expect(PLAY_VIDEO_DEFAULTS).toEqual({ hideButtonsAfter: 2.5, rewindSecondsValue: 5 });
  });
  it('the initial state of uxuiState has them', () => {
    const state = uxuiReducer(undefined, { type: 'init' });
    expect(state.PlayVideoSettings).toEqual({ hideButtonsAfter: 2.5, rewindSecondsValue: 5 });
  });
});

describe('normalizePlayVideoSettings', () => {
  it('missing, old or broken values become the defaults', () => {
    for (const bad of [undefined, null, {}, { hideButtonsAfter: NaN }, { rewindSecondsValue: 'abc' as any }, { hideButtonsAfter: Infinity }]) {
      expect(normalizePlayVideoSettings(bad as any)).toEqual(PLAY_VIDEO_DEFAULTS);
    }
  });
  it('keeps a valid value, also typed as text', () => {
    expect(normalizePlayVideoSettings({ hideButtonsAfter: 4, rewindSecondsValue: 10 })).toEqual({ hideButtonsAfter: 4, rewindSecondsValue: 10 });
    expect(normalizePlayVideoSettings({ hideButtonsAfter: '3.5' as any, rewindSecondsValue: '15' as any })).toEqual({ hideButtonsAfter: 3.5, rewindSecondsValue: 15 });
  });
  it('stays inside the limits and rounds', () => {
    const L = PLAY_VIDEO_LIMITS;
    expect(normalizePlayVideoSettings({ hideButtonsAfter: 0, rewindSecondsValue: 0 })).toEqual({ hideButtonsAfter: L.hideButtonsAfter.min, rewindSecondsValue: L.rewindSecondsValue.min });
    expect(normalizePlayVideoSettings({ hideButtonsAfter: 99, rewindSecondsValue: 999 })).toEqual({ hideButtonsAfter: L.hideButtonsAfter.max, rewindSecondsValue: L.rewindSecondsValue.max });
    expect(normalizePlayVideoSettings({ hideButtonsAfter: 2.46, rewindSecondsValue: 5.4 })).toEqual({ hideButtonsAfter: 2.5, rewindSecondsValue: 5 });
  });
  it('a value saved under the first name (uxuiPlayVideoSettings) is still read; the new name wins', () => {
    expect(selectPlayVideoSettings({ uxuiState: { uxuiPlayVideoSettings: { hideButtonsAfter: 7, rewindSecondsValue: 12 } } })).toEqual({ hideButtonsAfter: 7, rewindSecondsValue: 12 });
    expect(selectPlayVideoSettings({ uxuiState: { uxuiPlayVideoSettings: { hideButtonsAfter: 7, rewindSecondsValue: 12 }, PlayVideoSettings: { hideButtonsAfter: 3, rewindSecondsValue: 9 } } })).toEqual({ hideButtonsAfter: 3, rewindSecondsValue: 9 });
  });
  it('selectPlayVideoSettings works for a state persisted before the settings existed', () => {
    expect(selectPlayVideoSettings({ uxuiState: { darkMode: true } })).toEqual(PLAY_VIDEO_DEFAULTS);
    expect(selectPlayVideoSettings({})).toEqual(PLAY_VIDEO_DEFAULTS);
    expect(selectPlayVideoSettings({ uxuiState: { PlayVideoSettings: { hideButtonsAfter: 6, rewindSecondsValue: 20 } } })).toEqual({ hideButtonsAfter: 6, rewindSecondsValue: 20 });
  });
});

describe('uxuiState reducers of the video settings', () => {
  it('change only the given field and keep everything valid', () => {
    let state = uxuiReducer(undefined, { type: 'init' });
    state = uxuiReducer(state, setPlayVideoSettings({ rewindSecondsValue: 10 }));
    expect(state.PlayVideoSettings).toEqual({ hideButtonsAfter: 2.5, rewindSecondsValue: 10 });
    state = uxuiReducer(state, setPlayVideoSettings({ hideButtonsAfter: 100 }));
    expect(state.PlayVideoSettings.hideButtonsAfter).toBe(PLAY_VIDEO_LIMITS.hideButtonsAfter.max);
    expect(state.PlayVideoSettings.rewindSecondsValue).toBe(10);
  });
  it('work on a state without the settings (persisted by an older version)', () => {
    const old: any = { ...uxuiReducer(undefined, { type: 'init' }) };
    delete old.PlayVideoSettings;
    expect(uxuiReducer(old, setPlayVideoSettings({ rewindSecondsValue: 7 })).PlayVideoSettings).toEqual({ hideButtonsAfter: 2.5, rewindSecondsValue: 7 });
  });
  it('reset puts the defaults back', () => {
    let state = uxuiReducer(undefined, setPlayVideoSettings({ hideButtonsAfter: 8, rewindSecondsValue: 30 }));
    state = uxuiReducer(state, resetPlayVideoSettings());
    expect(state.PlayVideoSettings).toEqual(PLAY_VIDEO_DEFAULTS);
  });
});
