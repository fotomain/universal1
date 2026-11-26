// ReusableList - the GHOST POINTER (web). A browser never lets a page move the real mouse pointer (a page that could would be able to trick the user into clicking). So when an
// arrow of the select column moves a row, the real pointer is hidden over the page and a drawn pointer (the ghost) jumps to the arrow's new place - one row up or down:
//  - the ghost follows the real mouse at the same distance it had after the jump (the real pointer is not under it any more);
//  - a press goes to the element UNDER THE GHOST (what the user sees under the pointer, never what is under the hidden real pointer): on an arrow of the list it presses that arrow
//    and the ghost jumps again; on anything else INSIDE the list (the select-all circle, a toolbar button ...) that element is pressed and the ghost STAYS over it (the pointer does not jump away); outside the list the element is pressed and the ghost goes away;
//  - the ghost goes away by itself: Escape, the wheel, or 5 s without a mouse move / press.
// The overlay is a transparent layer over the whole page (cursor: none); nothing else on the page sees the mouse while the ghost is there.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GhostPointerHandle, GhostPointerProps } from './ghostPointerTypes';

export const GHOST_IDLE_MS = 5000;

const Z = 2147483000;

const GhostPointer = forwardRef<GhostPointerHandle, GhostPointerProps>(function GhostPointer({ testID }, ref) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const posRef = useRef<{ x: number; y: number } | null>(null);
  /** where the real pointer is (always tracked) and how far the ghost stands from it */
  const real = useRef<{ x: number; y: number; known: boolean }>({ x: 0, y: 0, known: false });
  const off = useRef({ dx: 0, dy: 0 });
  const timer = useRef<any>(null);
  const overlay = useRef<HTMLDivElement | null>(null);

  const dismiss = useCallback(() => { clearTimeout(timer.current); posRef.current = null; setPos(null); }, []);
  const arm = useCallback(() => { clearTimeout(timer.current); timer.current = setTimeout(dismiss, GHOST_IDLE_MS); }, [dismiss]);
  const place = useCallback((p: { x: number; y: number }) => { posRef.current = p; setPos(p); arm(); }, [arm]);

  useImperativeHandle(ref, () => ({
    jump: (dy: number) => {
      const base = posRef.current ?? (real.current.known ? real.current : null);
      if (!base) return;
      const next = { x: base.x, y: base.y + dy };
      off.current = { dx: next.x - real.current.x, dy: next.y - real.current.y };
      place(next);
    },
  }), [place]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const move = (e: PointerEvent) => {
      real.current = { x: e.clientX, y: e.clientY, known: true };
      if (posRef.current) place({ x: e.clientX + off.current.dx, y: e.clientY + off.current.dy });
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('keydown', key, true); clearTimeout(timer.current); };
  }, [place, dismiss]);

  const under = (x: number, y: number): Element | null => {
    const o = overlay.current;
    if (!o) return null;
    o.style.pointerEvents = 'none';
    const el = document.elementFromPoint(x, y);
    o.style.pointerEvents = 'auto';
    return el;
  };
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const p = posRef.current;
    if (!p) return;
    const target = under(p.x, p.y) as HTMLElement | null;
    const arrow = target?.closest(`[data-testid^="${testID}-up-"],[data-testid^="${testID}-down-"]`) as HTMLElement | null;
    if (arrow) { arm(); arrow.click(); return; }
    // anything else: the press goes to what the user SEES under the ghost. Inside the list (the select-all circle, a toolbar button, a card) the ghost STAYS where it is - the pointer
    // does not jump away from what was just pressed (the real pointer is hidden, one row off); outside the list (the menu, the app bar) the ghost is done and the real pointer comes back
    const insideList = !!target?.closest(`[data-testid="${testID}"]`);
    if (insideList) arm(); else dismiss();
    target?.click?.();
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) target.focus();
  };

  if (!pos || typeof document === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('react-dom').createPortal(
    <div ref={overlay} data-testid={`${testID}-ghost-layer`} onClick={onClick} onWheel={dismiss} style={{ position: 'fixed', inset: 0, zIndex: Z, cursor: 'none', background: 'transparent' }}>
      <svg data-testid={`${testID}-ghost`} width={22} height={26} viewBox="0 0 22 26" style={{ position: 'fixed', left: pos.x - 2, top: pos.y - 2, pointerEvents: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))' }}>
        <path d="M2 2 L2 20 L6.8 15.8 L10 22.5 L13 21.1 L9.9 14.5 L16.2 14.5 Z" fill="#000" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>,
    document.body,
  );
});

export default GhostPointer;
