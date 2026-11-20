// pm80Layout - sizes of the PM80 home for the window: phone portrait, phone landscape, tablet / web.
//   portrait : the hub (ROI ring) on top, under it the 8 items in a GRID of `itemsPerRow` (2, 3 or 4; the first row is full), everything
//              scaled to the width (down to 320 px)
//   landscape: hub + ROI chips on the LEFT, the 4 KPI rings and the 8 items (itemsPerRow in a row, in the business order) on the RIGHT
// Pure (tested) except the hook.
import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, useWindowDimensions } from 'react-native';

export interface PM80Layout {
  width: number;
  height: number;
  isLandscape: boolean;
  /** a phone / small window: native, or a web window narrower than 768 px */
  isMobile: boolean;
  /** max width of the header and of the body */
  bodyMax: number;
  /** width of the content inside the cards (window - the paddings) */
  inner: number;
  /** diameter of the central ROI ring */
  hub: number;
  /** hub / 194 (the design size): the fonts inside follow it */
  scale: number;
  /** width of one circle with its texts */
  sat: number;
  /** diameter of a circle */
  satCircle: number;
  /** diameter of a KPI ring */
  kpi: number;
  /** landscape: width of the left column (chips + hub) */
  leftW: number;
  /** items in one row of the grid (2, 3 or 4) */
  itemsPerRow: number;
  /** horizontal space between two items of a row */
  itemGap: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const MIN_GAP = 4;
/** the gap between the items of a full row: what is left of the width, shared, but 4..28 px */
const gapOf = (avail: number, sat: number, perRow: number) => clamp(Math.floor((avail - perRow * sat) / Math.max(1, perRow - 1)), MIN_GAP, 28);

/**
 * @param chrome the horizontal space the card around the content takes (Paper 28, Tamagui 50)
 */
export function computePM80Layout(
  width: number,
  height: number,
  chrome = 28,
  windowWidth = width,
  os: string = Platform.OS,
  itemsPerRow = 3
): PM80Layout {
  const perRow = clamp(Math.round(itemsPerRow) || 3, 2, 4);
  const isMobile = os !== 'web' || windowWidth < 768;
  // the orientation is the window's; the SIZES follow the width the home really has (the drawer / the page may take some)
  const isLandscape = windowWidth > height && width >= 560;
  const bodyMax = isLandscape ? 960 : 480;
  const inner = Math.max(240, Math.min(width, bodyMax) - chrome);

  if (!isLandscape) {
    // the hub keeps its size (it was [circle][hub][circle]); the items are cells of the grid: perRow of them fit the width
    const side = clamp(Math.floor(inner * 0.245), 62, 86);
    const hub = clamp(inner - 2 * side - 8, 128, 194);
    const sat = clamp(Math.floor((inner - (perRow - 1) * MIN_GAP) / perRow), 56, 120);
    return {
      width,
      height,
      isLandscape,
      isMobile,
      bodyMax,
      inner,
      hub,
      scale: hub / 194,
      sat,
      satCircle: clamp(sat - 20, 42, 76),
      kpi: clamp(Math.floor(inner / 4) - 8, 54, 76),
      leftW: inner,
      itemsPerRow: perRow,
      itemGap: gapOf(inner, sat, perRow),
    };
  }

  const leftW = clamp(Math.floor(inner * 0.34), 200, 300);
  const hub = clamp(leftW - 8, 170, 220);
  const rightW = inner - leftW - 16;
  const cell = Math.floor((rightW - (perRow - 1) * MIN_GAP) / perRow);
  const satL = clamp(cell, 64, 120);
  return {
    width,
    height,
    isLandscape,
    isMobile,
    bodyMax,
    inner,
    hub,
    scale: hub / 194,
    sat: satL,
    satCircle: clamp(cell - 26, 46, 64),
    // the 4 KPI rings keep their size whatever the grid is (they are 4 in a row of the same width)
    kpi: clamp(Math.floor(rightW / 4) - 18, 54, 80),
    leftW,
    itemsPerRow: perRow,
    itemGap: gapOf(rightW, satL, perRow),
  };
}

export interface PM80LayoutBox extends PM80Layout {
  /** put it on the root view of the home: the sizes then follow the width the home really gets */
  onLayout: (e: LayoutChangeEvent) => void;
}

export function usePM80Layout(chrome = 28, itemsPerRow = 3): PM80LayoutBox {
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState<number | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setMeasured((prev) => (prev !== null && Math.abs(prev - w) < 2 ? prev : w));
  }, []);
  return useMemo(
    () => ({ ...computePM80Layout(measured ?? win.width, win.height, chrome, win.width, Platform.OS, itemsPerRow), onLayout }),
    [measured, win.width, win.height, chrome, itemsPerRow, onLayout]
  );
}
