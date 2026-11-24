// A double click (web) / double touch (phone) on a card opens something: two presses inside DOUBLE_TAP_MS. A single press does nothing here (the card has its own buttons).
import { useEffect, useMemo, useRef } from 'react';
import { createDoubleTap } from '../../../../calendar/doubleTap';

/** returns the `onPress` of the card: `enabled` false = no double tap, the press is ignored */
export function useDoubleTapOpen(enabled: boolean, onOpen: () => void): () => void {
  const open = useRef(onOpen); open.current = onOpen;
  const on = useRef(enabled); on.current = enabled;
  const tap = useMemo(() => createDoubleTap<string>(() => {}, () => { if (on.current) open.current(); }, (a, b) => a === b), []);
  useEffect(() => () => tap.cancel(), [tap]);
  return () => { if (on.current) tap.tap('card'); };
}
