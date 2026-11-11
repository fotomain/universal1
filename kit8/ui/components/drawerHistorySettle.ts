// Firefox + a slide-out Drawer (narrow window): pressing a Drawer item made expo-router do `history.go(-1)` (the open-drawer
// history entry goes away) in the SAME state change that pushes the new route; Firefox fires the `popstate` of that go() late,
// after expo-router stopped waiting for it, and the late popstate was taken as "Back" -> the screen jumped back
// (Home -> Project Dashboard -> Home). Fix: close the drawer FIRST (that go(-1) lands on an entry with the SAME path = harmless),
// wait for its popstate, THEN navigate. Other browsers keep the one-step navigation.

export function isFirefoxWeb(): boolean {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent || '');
}

/** the drawer state has its "open" entry in the history (a slide-out drawer that is open) */
export function isDrawerOpenInHistory(state: any): boolean {
  return !!state?.history?.some((h: any) => h?.type === 'drawer');
}

/** calls `then` after the next `popstate` (the browser has finished the history.go of the drawer closing), at the latest after `timeoutMs` */
export function afterNextPopState(then: () => void, timeoutMs = 1500): void {
  let done = false;
  const fin = () => {
    if (done) return;
    done = true;
    window.removeEventListener('popstate', fin);
    clearTimeout(timer);
    setTimeout(then, 0); // after the listeners of the same popstate event (expo-router's own) have run
  };
  const timer = setTimeout(fin, timeoutMs);
  window.addEventListener('popstate', fin);
}
