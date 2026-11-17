// HomeScrollContext - the home screen (app/home/index.tsx) owns the ScrollView that really scrolls; a home component
// (appPM80) that wants to scroll the page to one of its blocks asks this host instead of its own (unbounded) ScrollView.
import React, { createContext, useContext } from 'react';

export interface HomeScrollHost {
  /** height of the visible part of the page */
  viewportH: number;
  /** height of the whole page (spacer included) */
  contentH: number;
  /** current scroll offset */
  getOffset: () => number;
  /** y of the top of the visible part, in window coordinates */
  measureTop: (cb: (windowY: number) => void) => void;
  scrollTo: (y: number, animated?: boolean) => void;
}

export const HomeScrollContext = createContext<HomeScrollHost | null>(null);

/** null when the component is not inside the home screen (demo page, tests) */
export const useHomeScrollHost = (): HomeScrollHost | null => useContext(HomeScrollContext);
