// A menu that opens right under the button that opened it (not at a fixed place of the window).
//   const a = useMenuAnchor((at) => setMenuAt(at));      <View {...a.anchorProps}><IconButton onPress={a.open} /></View>
// `at` = the right edge and the bottom of the button in window points: the menu is drawn from `at.x - width` (its right edge under the button's right edge), at `at.y`.
// The place is measured when the button is laid out and again at the press, so a window that was moved / scrolled / resized still gets the menu under its button.
import { useCallback, useRef } from 'react';
import { useWindowDimensions } from 'react-native';

export interface MenuAnchorPoint { x: number; y: number }

export function useMenuAnchor(onOpen: (at: MenuAnchorPoint) => void) {
  const win = useWindowDimensions();
  const ref = useRef<any>(null);
  const cached = useRef<MenuAnchorPoint | null>(null);
  const openRef = useRef(onOpen); openRef.current = onOpen;
  const measure = useCallback((then?: (at: MenuAnchorPoint) => void) => {
    const node = ref.current;
    if (!node?.measureInWindow) return;
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (!(w > 0 || h > 0)) return;
      const at = { x: x + w, y: y + h };
      cached.current = at;
      then?.(at);
    });
  }, []);
  const open = useCallback(() => {
    // at once (a menu that waits for the measure feels slow), then once more with the fresh place
    openRef.current(cached.current ?? { x: win.width - 16, y: 90 });
    measure((at) => openRef.current(at));
  }, [measure, win.width]);
  const anchorProps = { ref, collapsable: false, onLayout: () => measure() } as const;
  return { anchorProps, open };
}

/** left edge of a menu `width` wide whose right edge is under the button (kept inside the window by PMContextMenu) */
export const menuLeft = (at: MenuAnchorPoint, width: number): number => Math.max(8, at.x - width);
