// The main FAB stands OUTSIDE the drawer navigator, so it cannot reach the drawer itself. The drawer content (inside the navigator) registers
// "close the drawer if it is open" here, and the FAB calls it when the user opens the FAB: an open hamburger menu closes by itself.
// The other direction (the drawer opens -> the FAB closes) is useCloseFabsWhenDrawerOpens.
import { useEffect, useRef } from 'react';
import { isDrawerOpenInHistory } from './drawerHistorySettle';

let closer: (() => void) | null = null;

/** registers the closer of the drawer; returns the function that withdraws it */
export function registerDrawerCloser(fn: () => void): () => void {
  closer = fn;
  return () => {
    if (closer === fn) closer = null;
  };
}

/** closes the drawer when it is open (nothing happens when there is no drawer or it is closed) */
export function closeDrawerIfOpen(): void {
  try {
    closer?.();
  } catch {
    // the drawer is gone: nothing to close
  }
}

/** inside the drawer content: keeps the closer registered with the newest drawer state */
export function useRegisterDrawerCloser(navigation: { closeDrawer?: () => void } | undefined, drawerState: any): void {
  const openRef = useRef(false);
  openRef.current = isDrawerOpenInHistory(drawerState);
  useEffect(
    () =>
      registerDrawerCloser(() => {
        if (openRef.current) navigation?.closeDrawer?.();
      }),
    [navigation],
  );
}
