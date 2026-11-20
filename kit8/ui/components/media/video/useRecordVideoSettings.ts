// The video recorder settings of uxuiState (persisted): { settings, change(partial), reset() }. Twin of usePlayVideoSettings.
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectRecordVideoSettings, RecordVideoSettings } from '../../../../redux/recordVideoSettings';
import { resetRecordVideoSettings, setRecordVideoSettings } from '../../../../redux/uxuiSlice';

const sameSettings = (a: RecordVideoSettings, b: RecordVideoSettings) =>
  a.recordDateTimeOverEnabled === b.recordDateTimeOverEnabled && a.recordDateTimeOverPosition === b.recordDateTimeOverPosition && a.recordTorchEnabled === b.recordTorchEnabled;

export function useRecordVideoSettings() {
  const dispatch = useDispatch();
  // the selector builds a new object every time: compare the values
  const settings = useSelector(selectRecordVideoSettings, sameSettings);
  const change = useCallback((patch: Partial<RecordVideoSettings>): void => {
    dispatch(setRecordVideoSettings(patch));
  }, [dispatch]);
  const reset = useCallback((): void => {
    dispatch(resetRecordVideoSettings());
  }, [dispatch]);
  return { settings, change, reset };
}
