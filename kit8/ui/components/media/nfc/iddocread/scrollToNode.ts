// After the ID reading is finished the screen scrolls down to the "Create media post" button (the data and the photo are above it, the password form below).
// Web (react-native-web): the node is a DOM element -> scrollIntoView. Phone: measure the node inside the ScrollView and scroll there, a little above it.
/** how far above the node the phone leaves the top of the view (the end of the data stays visible) */
export const SCROLL_TARGET_MARGIN = 140;

export function scrollNodeIntoView(node: any, scroll: any, margin: number = SCROLL_TARGET_MARGIN): boolean {
  try {
    if (!node) return false;
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    }
    const inner = scroll?.getInnerViewRef?.() ?? scroll?.getInnerViewNode?.();
    if (typeof node.measureLayout === 'function' && inner != null && typeof scroll?.scrollTo === 'function') {
      node.measureLayout(inner, (_x: number, y: number) => scroll.scrollTo({ y: Math.max(0, y - margin), animated: true }), () => undefined);
      return true;
    }
  } catch {
    // the view is gone or cannot measure: staying where it is is harmless
  }
  return false;
}
