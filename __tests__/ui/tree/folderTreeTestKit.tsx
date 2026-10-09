// Helpers for the folder tree tests (jsdom): fixed element rects (jsdom has no layout) + pointer-driven drags.
import { act } from 'react';

export type Rect = { left: number; top: number; width: number; height: number };

/** getBoundingClientRect by data-testid; anything else keeps jsdom's zero rect */
export function mockRects(rects: Record<string, Rect>) {
  const original = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function () {
    const id = this.getAttribute('data-testid') || '';
    const r = rects[id];
    return r
      ? ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => ({}) } as DOMRect)
      : original.call(this);
  };
  return () => { HTMLElement.prototype.getBoundingClientRect = original; };
}

export const pointer = (type: string, x: number, y: number, extra: Record<string, any> = {}) => {
  const e: any = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  Object.assign(e, { pointerType: 'mouse' }, extra);
  return e;
};

/** press on `el`, move through `path`, release at the last point (what a mouse drag does) */
export function dragWithMouse(el: Element, path: [number, number][]) {
  act(() => { el.dispatchEvent(pointer('pointerdown', path[0][0], path[0][1])); });
  for (const [x, y] of path.slice(1)) act(() => { window.dispatchEvent(pointer('pointermove', x, y)); });
  const [lx, ly] = path[path.length - 1];
  act(() => { window.dispatchEvent(pointer('pointerup', lx, ly)); });
}

export const rowTop = (el: HTMLElement) => parseFloat(el.style.top || '0');
