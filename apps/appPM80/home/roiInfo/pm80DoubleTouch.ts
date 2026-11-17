// pm80DoubleTouch - a second touch on the SAME thing inside the window = a double touch (phone) / double click (web).
// The first touch is not delayed: the button does its normal job at once, the second one asks for more (the ROI description).
import { useRef } from 'react';

export const DOUBLE_TOUCH_MS = 380;

export function createDoubleTouch(windowMs = DOUBLE_TOUCH_MS, now: () => number = () => Date.now()) {
  let lastKey: string | null = null;
  let lastAt = 0;
  return {
    /** true when this touch is the second one on the same key */
    touch(key: string): boolean {
      const t = now();
      if (lastKey === key && t - lastAt <= windowMs) {
        lastKey = null;
        lastAt = 0;
        return true;
      }
      lastKey = key;
      lastAt = t;
      return false;
    },
  };
}

export function useDoubleTouch() {
  const ref = useRef<ReturnType<typeof createDoubleTouch> | null>(null);
  if (!ref.current) ref.current = createDoubleTouch();
  return ref.current;
}
