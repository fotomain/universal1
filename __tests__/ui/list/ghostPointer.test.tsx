/** @jest-environment jsdom */
// The ghost pointer of ReusableList (web): after an arrow moved a row, a drawn pointer jumps one row; it follows the mouse; a press goes to what is UNDER THE GHOST.
import React, { act, createRef } from 'react';
import GhostPointer, { GHOST_IDLE_MS } from '../../../kit8/ui/components/list/reusable/GhostPointer.web';
import type { GhostPointerHandle } from '../../../kit8/ui/components/list/reusable/ghostPointerTypes';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const ref = createRef<GhostPointerHandle>();
let elementAt: (x: number, y: number) => Element | null;

beforeEach(() => {
  jest.useFakeTimers();
  elementAt = () => null;
  (document as any).elementFromPoint = (x: number, y: number) => elementAt(x, y);
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<GhostPointer ref={ref} testID="L" />));
});
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; jest.useRealTimers(); });

const moveMouse = (x: number, y: number) => act(() => { document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true })); });
const style = (el: HTMLElement | null) => ({ left: parseFloat(el!.style.left), top: parseFloat(el!.style.top) });

describe('GhostPointer (web)', () => {
  it('nothing is drawn until an arrow jumps; the real pointer position must be known', () => {
    act(() => ref.current!.jump(72));
    expect(q('L-ghost')).toBeNull(); // the mouse never moved: no place to start from
    moveMouse(100, 200);
    act(() => ref.current!.jump(72));
    expect(q('L-ghost')).not.toBeNull();
    expect(q('L-ghost-layer')!.style.cursor).toBe('none');
  });

  it('jumps one row down / up from the pointer and follows the real mouse at the same distance', () => {
    moveMouse(100, 200);
    act(() => ref.current!.jump(72));
    expect(style(q('L-ghost') as any)).toEqual({ left: 98, top: 270 }); // x - 2, y + 72 - 2
    moveMouse(110, 205);
    expect(style(q('L-ghost') as any)).toEqual({ left: 108, top: 275 });
    act(() => ref.current!.jump(-72));
    expect(style(q('L-ghost') as any)).toEqual({ left: 108, top: 203 });
  });

  it('a press on the ghost over an arrow presses that arrow; over anything else it presses THAT element (not what is under the hidden real pointer); the ghost stays after a press inside the list and goes after one outside it', () => {
    const arrow = document.createElement('button'); arrow.setAttribute('data-testid', 'L-down-a'); document.body.appendChild(arrow);
    const other = document.createElement('button'); other.setAttribute('data-testid', 'somewhere'); document.body.appendChild(other);
    const onArrow = jest.fn(); const onOther = jest.fn();
    arrow.addEventListener('click', onArrow); other.addEventListener('click', onOther);
    moveMouse(100, 200);
    act(() => ref.current!.jump(72));
    elementAt = (x, y) => (y === 272 ? arrow : y === 200 ? other : null); // ghost at y 272, real pointer at y 200
    act(() => q('L-ghost-layer')!.click());
    expect(onArrow).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled();
    expect(q('L-ghost')).not.toBeNull();
    // the user moves the ghost to the select-all circle (the real pointer is one row above it) and presses
    const list = document.createElement('div'); list.setAttribute('data-testid', 'L'); document.body.appendChild(list);
    const selectAll = document.createElement('button'); selectAll.setAttribute('data-testid', 'L-select-all'); list.appendChild(selectAll);
    const onSelectAll = jest.fn(); selectAll.addEventListener('click', onSelectAll);
    elementAt = (x, y) => (y === 272 ? selectAll : y === 200 ? other : null);
    act(() => q('L-ghost-layer')!.click());
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onOther).not.toHaveBeenCalled(); // NOT what is under the real pointer
    expect(q('L-ghost')).not.toBeNull(); // inside the list the ghost stays over what was pressed
    // a press on something OUTSIDE the list: it is pressed and the ghost goes
    elementAt = (x, y) => other;
    act(() => q('L-ghost-layer')!.click());
    expect(onOther).toHaveBeenCalledTimes(1);
    expect(q('L-ghost')).toBeNull();
  });

  it('Escape, the wheel and the idle time take the ghost away', () => {
    moveMouse(10, 10);
    act(() => ref.current!.jump(72));
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(q('L-ghost')).toBeNull();
    act(() => ref.current!.jump(72));
    act(() => { q('L-ghost-layer')!.dispatchEvent(new WheelEvent('wheel', { bubbles: true })); });
    expect(q('L-ghost')).toBeNull();
    act(() => ref.current!.jump(72));
    act(() => { jest.advanceTimersByTime(GHOST_IDLE_MS + 10); });
    expect(q('L-ghost')).toBeNull();
  });
});
