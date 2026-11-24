/** @jest-environment jsdom */
// A menu opens under the button that opened it: right edge of the menu = right edge of the button, top = the bottom of the button.
import React, { act } from 'react';
import { menuLeft, useMenuAnchor } from '../../../kit8/ui/components/list/reusable/useMenuAnchor';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

it('menuLeft puts the right edge of the menu under the right edge of the button, never off the left of the window', () => {
  expect(menuLeft({ x: 500, y: 60 }, 196)).toBe(304);
  expect(menuLeft({ x: 100, y: 60 }, 196)).toBe(8);
});

it('opens at once with the measured place of the button, then again with the fresh one', () => {
  const spy = jest.fn();
  let anchor: any;
  function Probe() {
    anchor = useMenuAnchor(spy);
    return <div data-testid="probe" />;
  }
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<Probe />));
  // before any measure: the fallback place, not nothing
  act(() => anchor.open());
  expect(spy).toHaveBeenLastCalledWith({ x: expect.any(Number), y: 90 });
  // the button is laid out at x 700, y 40, 40 x 32
  anchor.anchorProps.ref.current = { measureInWindow: (cb: any) => cb(700, 40, 40, 32) };
  act(() => anchor.anchorProps.onLayout());
  spy.mockClear();
  act(() => anchor.open());
  expect(spy).toHaveBeenNthCalledWith(1, { x: 740, y: 72 });
  expect(spy).toHaveBeenLastCalledWith({ x: 740, y: 72 });
  // the button moved (the page scrolled): the press measures again
  anchor.anchorProps.ref.current = { measureInWindow: (cb: any) => cb(700, 10, 40, 32) };
  spy.mockClear();
  act(() => anchor.open());
  expect(spy).toHaveBeenNthCalledWith(1, { x: 740, y: 72 });
  expect(spy).toHaveBeenLastCalledWith({ x: 740, y: 42 });
  act(() => root.unmount());
});
