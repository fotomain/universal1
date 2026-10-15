// "The buttons appear when the mouse moves / on one touch and disappear after hideButtonsAfter seconds."
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * visible: are the buttons shown. show(): show them and (re)start the countdown. hide(): hide at once.
 * hold = true keeps them shown (e.g. while the settings panel is open); the countdown starts again when it is released.
 */
export function useAutoHideControls(hideAfterSeconds: number, hold = false) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef = useRef(hold);
  holdRef.current = hold;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const show = useCallback(() => {
    setVisible(true);
    clear();
    if (!holdRef.current) timer.current = setTimeout(() => setVisible(false), Math.max(0, hideAfterSeconds) * 1000);
  }, [hideAfterSeconds]);

  const hide = useCallback(() => {
    clear();
    setVisible(false);
  }, []);

  // shown at the start, then the countdown; again when the time or the hold changes
  useEffect(() => {
    show();
    return clear;
  }, [show, hold]);

  return { visible, show, hide };
}
