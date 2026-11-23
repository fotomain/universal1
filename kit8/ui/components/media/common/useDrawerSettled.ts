// A camera screen must not start (ask for the camera permission, switch the camera on) while the hamburger menu is open or still sliding shut.
// Seen on Android (2026-11-23): Identification pressed in the open menu -> the screen asked the camera permission at once -> the Android dialog paused the
// activity in the middle of the closing animation -> the menu stayed open and the camera ran UNDER it.
// `useDrawerSettled()` is false while the drawer navigator above the screen is open, and for `settleMs` after it closed or after the screen mounted
// (the status flips when the close is DISPATCHED, the animation takes ~250 ms more, and a screen that the menu item just opened mounts inside it).
import type { Context } from 'react';
import { useContext, useEffect, useState } from 'react';
// the plain context module of expo-router's drawer (the same object the drawer navigator provides); 'expo-router/drawer' itself loads the whole router, too heavy for Jest
import { DrawerStatusContext } from 'expo-router/build/react-navigation/drawer/utils/DrawerStatusContext';

/** how long after "closed" the menu still slides (react-native-drawer-layout closes in ~250 ms) */
export const DRAWER_SETTLE_MS = 400;

export function useDrawerSettled(settleMs: number = DRAWER_SETTLE_MS): boolean {
  const status = useContext(DrawerStatusContext as Context<'open' | 'closed' | undefined>);
  const open = status === 'open';
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (open) {
      setSettled(false);
      return undefined;
    }
    const timer = setTimeout(() => setSettled(true), settleMs);
    return () => clearTimeout(timer);
  }, [open, settleMs]);
  return !open && settled;
}
