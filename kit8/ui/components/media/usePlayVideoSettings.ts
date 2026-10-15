// The video player settings of uxuiState (persisted): { settings, change(partial), reset() }.
import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectPlayVideoSettings, PlayVideoSettings } from '../../../redux/playVideoSettings';
import { resetPlayVideoSettings, setPlayVideoSettings } from '../../../redux/uxuiSlice';

const sameSettings = (a: PlayVideoSettings, b: PlayVideoSettings) =>
  a.hideButtonsAfter === b.hideButtonsAfter && a.rewindSecondsValue === b.rewindSecondsValue;

export function usePlayVideoSettings() {
  const dispatch = useDispatch();
  // selectPlayVideoSettings builds a new object every time: compare the values, so the player does not re-render for nothing
  const settings = useSelector(selectPlayVideoSettings, sameSettings);
  const change = useCallback((patch: Partial<PlayVideoSettings>) => dispatch(setPlayVideoSettings(patch)), [dispatch]);
  const reset = useCallback(() => dispatch(resetPlayVideoSettings()), [dispatch]);
  return { settings, change, reset };
}
