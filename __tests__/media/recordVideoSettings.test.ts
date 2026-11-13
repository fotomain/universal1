// uxuiState.RecordVideoSettings: the settings of the video recorder (documentation/CAMERA_DATE_TIME.html)
import uxuiReducer, { resetRecordVideoSettings, setRecordVideoSettings } from '../../kit8/redux/uxuiSlice';
import { isRecordDateTimeOverPosition, normalizeRecordVideoSettings, RECORD_DATE_TIME_OVER_POSITIONS, RECORD_VIDEO_DEFAULTS, selectRecordVideoSettings } from '../../kit8/redux/recordVideoSettings';

it('defaults: the stamp is off, the corner is Bottom Right', () => {
  expect(RECORD_VIDEO_DEFAULTS).toEqual({ recordDateTimeOverEnabled: false, recordDateTimeOverPosition: 'bottomRight' });
  expect(uxuiReducer(undefined, { type: 'x' }).RecordVideoSettings).toEqual(RECORD_VIDEO_DEFAULTS);
});

it('the radio has the four corners in the asked order', () => {
  expect(RECORD_DATE_TIME_OVER_POSITIONS.map((p) => `${p.id}=${p.label}`)).toEqual(['topLeft=Top Left', 'topRight=Top Right', 'bottomLeft=Bottom Left', 'bottomRight=Bottom Right']);
  expect(isRecordDateTimeOverPosition('topLeft')).toBe(true);
  expect(isRecordDateTimeOverPosition('center')).toBe(false);
});

it('normalize: missing, old or wrong values become valid', () => {
  expect(normalizeRecordVideoSettings(undefined)).toEqual(RECORD_VIDEO_DEFAULTS);
  expect(normalizeRecordVideoSettings(null)).toEqual(RECORD_VIDEO_DEFAULTS);
  expect(normalizeRecordVideoSettings({ recordDateTimeOverEnabled: 'yes' as any, recordDateTimeOverPosition: 'middle' as any })).toEqual(RECORD_VIDEO_DEFAULTS);
  expect(normalizeRecordVideoSettings({ recordDateTimeOverEnabled: true })).toEqual({ recordDateTimeOverEnabled: true, recordDateTimeOverPosition: 'bottomRight' });
});

it('a state persisted before the settings existed is read with the defaults', () => {
  expect(selectRecordVideoSettings({ uxuiState: {} })).toEqual(RECORD_VIDEO_DEFAULTS);
  expect(selectRecordVideoSettings(undefined)).toEqual(RECORD_VIDEO_DEFAULTS);
  const old: any = { ...uxuiReducer(undefined, { type: 'x' }) };
  delete old.RecordVideoSettings;
  const next = uxuiReducer(old, setRecordVideoSettings({ recordDateTimeOverPosition: 'topLeft' }));
  expect(next.RecordVideoSettings).toEqual({ recordDateTimeOverEnabled: false, recordDateTimeOverPosition: 'topLeft' });
});

it('set changes only the given fields, a wrong corner is refused, reset gives the defaults', () => {
  let state = uxuiReducer(undefined, setRecordVideoSettings({ recordDateTimeOverEnabled: true }));
  state = uxuiReducer(state, setRecordVideoSettings({ recordDateTimeOverPosition: 'topRight' }));
  expect(selectRecordVideoSettings({ uxuiState: state })).toEqual({ recordDateTimeOverEnabled: true, recordDateTimeOverPosition: 'topRight' });
  state = uxuiReducer(state, setRecordVideoSettings({ recordDateTimeOverPosition: 'nowhere' as any }));
  expect(state.RecordVideoSettings.recordDateTimeOverPosition).toBe('bottomRight');
  expect(uxuiReducer(state, resetRecordVideoSettings()).RecordVideoSettings).toEqual(RECORD_VIDEO_DEFAULTS);
});
