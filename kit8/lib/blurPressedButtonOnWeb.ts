// Web only: stops Chrome's "Blocked aria-hidden on an element because its descendant retained focus".
//
// Why: React Navigation marks the screen you leave with aria-hidden (elements/Screen.js). When a
// button on that screen was clicked to navigate (or to open a drawer / another screen), the button
// still has focus at that moment, so Chrome refuses the aria-hidden and logs the warning.
//
// Fix: on a MOUSE / TOUCH click (not keyboard - keyboard users keep their focus), blur the focused
// button in the capture phase, i.e. before its onPress runs and the screen gets hidden.
// Text inputs, textareas and contenteditable elements are never touched.

import { Platform } from 'react-native';

let installed = false;

export function installBlurPressedButtonOnWeb() {
  if (installed || Platform.OS !== 'web' || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener(
    'click',
    (e: MouseEvent) => {
      if (e.detail === 0) return; // keyboard "click" (Enter / Space): keep the focus
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return;
      if (tag === 'BUTTON' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'link' || tag === 'A') el.blur();
    },
    true
  );
}

installBlurPressedButtonOnWeb();
