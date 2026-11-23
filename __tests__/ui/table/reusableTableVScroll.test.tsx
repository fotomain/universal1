/** @jest-environment jsdom */
// ReusableTable: the vertical scrollbar for the mouse stays at the right edge of the visible table (not at the end of the wide content).
import React, { act } from 'react';
import {
  vOffsetAfterDrag, vOffsetForTrackPress, vScrollMax, vScrollNeeded, vThumbHeight, vThumbTop, vThumbTravel, VSCROLL_MIN_THUMB,
} from '../../../kit8/ui/components/table/reusable/tableVScrollModel';
import ReusableTableVScrollbar from '../../../kit8/ui/components/table/reusable/ReusableTableVScrollbar';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const m = (over: Partial<{ contentH: number; viewH: number; offsetY: number; bodyY: number }> = {}) => ({ contentH: 1000, viewH: 400, offsetY: 0, bodyY: 40, ...over });

describe('tableVScrollModel', () => {
  it('the bar is needed only while the rows do not fit', () => {
    expect(vScrollNeeded(m())).toBe(true);
    expect(vScrollNeeded(m({ contentH: 400 }))).toBe(false);
    expect(vScrollNeeded(m({ contentH: 400.5 }))).toBe(false); // rounding noise
    expect(vScrollNeeded(m({ viewH: 0 }))).toBe(false); // not measured yet
  });
  it('the thumb is the visible share of the content, never below the minimum', () => {
    expect(vThumbHeight(m())).toBe(160); // 400 * 400 / 1000
    expect(vThumbHeight(m({ contentH: 1000000 }))).toBe(VSCROLL_MIN_THUMB);
    expect(vThumbTravel(m())).toBe(240);
    expect(vScrollMax(m())).toBe(600);
  });
  it('the thumb follows the offset from the top to the bottom of the track', () => {
    expect(vThumbTop(m({ offsetY: 0 }))).toBe(0);
    expect(vThumbTop(m({ offsetY: 300 }))).toBe(120);
    expect(vThumbTop(m({ offsetY: 600 }))).toBe(240);
    expect(vThumbTop(m({ offsetY: 9999 }))).toBe(240); // overscroll stays inside the track
    expect(vThumbTop(m({ offsetY: -50 }))).toBe(0);
  });
  it('a drag of the thumb moves the rows in proportion and stays inside the content', () => {
    expect(vOffsetAfterDrag(m(), 0, 120)).toBe(300);
    expect(vOffsetAfterDrag(m(), 300, -60)).toBe(150);
    expect(vOffsetAfterDrag(m(), 0, 5000)).toBe(600);
    expect(vOffsetAfterDrag(m(), 100, -5000)).toBe(0);
    expect(vOffsetAfterDrag(m({ contentH: 300 }), 0, 50)).toBe(0); // nothing to scroll
  });
  it('a press on the track centers the thumb there', () => {
    expect(vOffsetForTrackPress(m(), 80)).toBe(0); // thumb 160 high: centered at 80 = its top is 0
    expect(vOffsetForTrackPress(m(), 200)).toBe(300); // top 120 of 240
    expect(vOffsetForTrackPress(m(), 399)).toBe(600);
    expect(vOffsetForTrackPress(m(), -10)).toBe(0);
  });
});

describe('ReusableTableVScrollbar', () => {
  const colors = { thumbColor: '#6366f1', trackColor: '#fff', headerColor: '#eee', borderColor: '#ccc', testID: 't-scroll-y' };
  const render = (metrics: any, scrollTo = jest.fn()) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<ReusableTableVScrollbar metrics={metrics} scrollTo={scrollTo} {...colors} />); });
    return { host, root, scrollTo };
  };

  it('is not drawn while the rows fit', () => {
    const { host } = render(m({ contentH: 380 }));
    expect(host.querySelector('[data-testid="t-scroll-y"]')).toBeNull();
  });

  it('is drawn with a track and a thumb of the computed size and place', () => {
    const { host } = render(m({ offsetY: 300 }));
    expect(host.querySelector('[data-testid="t-scroll-y"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="t-scroll-y-track"]')).not.toBeNull();
    const thumb = host.querySelector('[data-testid="t-scroll-y-thumb"]') as HTMLElement;
    expect(thumb).not.toBeNull();
    expect(thumb.style.height).toBe('160px');
    expect(thumb.style.top).toBe('120px');
  });
});
