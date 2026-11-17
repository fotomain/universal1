// pm80FlowScroll - on a phone a tap on a circle of the home scrolls the page so that the "Business order" panel is the TOP
// item of the screen (the panel then shows the tapped step and the next one, see PM80FlowStrip activeId).
//   The page below the panel is shorter than a screen, so a spacer is added under the page (only after the first tap)
//   until the panel can really reach the top.
//   Who scrolls: the HOME SCREEN (app/home/index.tsx offers its ScrollView through HomeScrollContext); where there is
//   no host (demo page, tests) the component's own ScrollView is used.
// The numbers are pure (tested); the hook only wires them to the scroller.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, ScrollView, View } from 'react-native';
import { useHomeScrollHost } from '../../../kit8/ui/home/HomeScrollContext';

/** the panel keeps this many px of air above it */
export const FLOW_TOP_GAP = 8;

/** scroll offset that puts the panel at the top (never negative) */
export const flowScrollY = (panelTop: number): number => Math.max(0, Math.round(panelTop - FLOW_TOP_GAP));

/**
 * Scroll offset from window coordinates: where the panel is on the screen (panelWinY), where the visible part of the
 * page starts (viewportTopWinY) and the offset in force.
 */
export const flowTargetOffset = (panelWinY: number, viewportTopWinY: number, currentOffset: number): number =>
  Math.max(0, Math.round(currentOffset + (panelWinY - viewportTopWinY) - FLOW_TOP_GAP));

/**
 * Height of the spacer under the page so that the panel can be scrolled to the top.
 * @param viewportH height of the visible part of the page
 * @param belowPanelH the page from the top of the panel to the end of its block (the spacer is NOT in it: it sits outside
 *                    the block, so this number never depends on the spacer = no feedback loop)
 */
export function flowSpacerHeight(viewportH: number, belowPanelH: number): number {
  if (viewportH <= 0 || belowPanelH <= 0) return 0;
  return Math.max(0, Math.ceil(viewportH - belowPanelH - FLOW_TOP_GAP));
}

/** can the scroller reach the offset with the content it has now? */
export const flowCanReach = (viewportH: number, contentH: number, panelTop: number): boolean =>
  viewportH > 0 && contentH - viewportH >= flowScrollY(panelTop) - 1;

export function usePM80FlowScroll(isMobile: boolean) {
  const host = useHomeScrollHost();
  const hostRef = useRef(host);
  hostRef.current = host;

  const scrollRef = useRef<ScrollView>(null); // the component's own ScrollView (used when there is no host)
  const panelRef = useRef<View>(null);
  const bodyY = useRef(0); // y of the block that holds the panel
  const bodyH = useRef(0); // its height (the spacer is outside of it)
  const panelY = useRef(0); // y of the panel inside that block
  const wantScroll = useRef(false);
  const [ownViewportH, setOwnViewportH] = useState(0);
  const [ownContentH, setOwnContentH] = useState(0);
  const [spacerH, setSpacerH] = useState(0);
  const [armed, setArmed] = useState(false); // the spacer exists only after the first tap on a circle
  const [tick, setTick] = useState(0);

  const bump = () => setTick((t) => t + 1);

  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    if (Math.round(y) !== bodyY.current || Math.round(height) !== bodyH.current) {
      bodyY.current = Math.round(y);
      bodyH.current = Math.round(height);
      bump();
    }
  }, []);
  const onPanelLayout = useCallback((e: LayoutChangeEvent) => {
    const y = Math.round(e.nativeEvent.layout.y);
    if (y !== panelY.current) {
      panelY.current = y;
      bump();
    }
  }, []);
  const onScrollViewLayout = useCallback((e: LayoutChangeEvent) => setOwnViewportH(Math.round(e.nativeEvent.layout.height)), []);
  const onContentSizeChange = useCallback((_w: number, h: number) => setOwnContentH(Math.round(h)), []);

  const viewportH = host ? host.viewportH : ownViewportH;
  const contentH = host ? host.contentH : ownContentH;

  // 1. the spacer
  useEffect(() => {
    const next = isMobile && armed ? flowSpacerHeight(viewportH, bodyH.current - panelY.current) : 0;
    if (Math.abs(next - spacerH) > 1) setSpacerH(next);
  }, [isMobile, armed, viewportH, spacerH, tick]);

  // 2. the scroll, as soon as the page is long enough
  useEffect(() => {
    if (!wantScroll.current) return;
    const h = hostRef.current;
    if (h) {
      panelRef.current?.measureInWindow((_x, panelWinY) => {
        h.measureTop((viewportTopWinY) => {
          const target = flowTargetOffset(panelWinY, viewportTopWinY, h.getOffset());
          if (h.contentH - h.viewportH >= target - 1 && wantScroll.current) {
            wantScroll.current = false;
            h.scrollTo(target, true);
          }
        });
      });
      return;
    }
    const top = bodyY.current + panelY.current;
    if (flowCanReach(ownViewportH, ownContentH, top)) {
      wantScroll.current = false;
      scrollRef.current?.scrollTo({ y: flowScrollY(top), animated: true });
    }
  }, [viewportH, contentH, spacerH, tick, ownViewportH, ownContentH]);

  /** a circle was tapped: (phone only) scroll the Business order panel to the top */
  const scrollToFlow = useCallback(() => {
    if (!isMobile) return;
    wantScroll.current = true;
    setArmed(true);
    bump();
  }, [isMobile]);

  return {
    scrollRef,
    panelRef,
    spacerH,
    scrollToFlow,
    onBodyLayout,
    onPanelLayout,
    scrollViewProps: { onLayout: onScrollViewLayout, onContentSizeChange },
  };
}
