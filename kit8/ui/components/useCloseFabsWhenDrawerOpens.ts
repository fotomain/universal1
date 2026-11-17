// While the main floating button (FAB) is open and the user opens the drawer (the hamburger of the app bar, or a swipe from the edge), the FAB
// must close: its list and its backdrop would lie over the menu. The drawer content (inside the navigator) sees the drawer state; the FABs are closed
// through FABProvider.closeAllFABs.
import { useEffect } from 'react';
import { useCloseAllFABs } from '../../providers/FABProvider';
import { isDrawerOpenInHistory } from './drawerHistorySettle';

export function useCloseFabsWhenDrawerOpens(drawerState: any): void {
  const closeAllFABs = useCloseAllFABs();
  const open = isDrawerOpenInHistory(drawerState);
  useEffect(() => {
    if (open) closeAllFABs();
  }, [open, closeAllFABs]);
}
