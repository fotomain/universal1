// TREE.PLUGIN - useFolderDragSource: makes a view a drag source of the folder-tree drag session (folderTreeDnd).
//   mode 'longPress'  tree rows: web = press and move a few px (touch: hold ~350 ms first, so scrolling still works);
//                     native = hold ~350 ms without moving, then drag
//   mode 'handle'     a ⠿ grip: the drag starts at once (native: PanResponder; web tables use their own DnD body)
// A drag swallows the click / press that the release would cause: `wasDragged()` is true for ~350 ms afterwards.
import { useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform } from 'react-native';
import { beginFolderDrag, cancelFolderDrag, endFolderDrag, FolderDragPayload, moveFolderDrag } from './folderTreeDnd';

export interface FolderDragSourceOptions {
  enabled?: boolean;
  /** the payload at the moment the drag starts (null = no drag) */
  getPayload: () => FolderDragPayload | null;
  mode?: 'longPress' | 'handle';
  /** native / touch hold time before a drag starts (default 350) */
  longPressMs?: number;
  /** px the pointer may move before it counts as a move (default 6) */
  slop?: number;
}

export interface FolderDragSource {
  /** web: put it on the view (the DOM element gets the pointer listeners) */
  ref: React.MutableRefObject<any>;
  /** native: spread on the view */
  props: Record<string, any>;
  /** a drag just ended: ignore the press that follows */
  wasDragged: () => boolean;
}

export function useFolderDragSource({ enabled = true, getPayload, mode = 'longPress', longPressMs = 350, slop = 6 }: FolderDragSourceOptions): FolderDragSource {
  const ref = useRef<any>(null);
  const live = useRef({ enabled, getPayload });
  live.current = { enabled, getPayload };
  const draggedAt = useRef(0);
  const wasDragged = () => Date.now() - draggedAt.current < 350;

  // ---------------- web: pointer events on the DOM element ----------------
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el: HTMLElement | null = ref.current;
    if (!el || typeof el.addEventListener !== 'function') return;
    const onDown = (e: PointerEvent) => {
      if (!live.current.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest('input, textarea, [data-nodrag]')) return;
      const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
      const sx = e.clientX; const sy = e.clientY;
      let lx = sx; let ly = sy;
      let active = false;
      let timer: any = null;
      const start = () => {
        const payload = live.current.getPayload();
        if (!payload) { cleanup(); return; }
        active = true;
        beginFolderDrag(payload, lx, ly);
      };
      const move = (ev: PointerEvent) => {
        lx = ev.clientX; ly = ev.clientY;
        const moved = Math.hypot(lx - sx, ly - sy) > slop;
        if (!active) {
          // touch: moving before the hold ends = the user scrolls
          if (touch) { if (moved) cleanup(); return; }
          if (!moved) return;
          start();
          if (!active) return;
        }
        ev.preventDefault();
        moveFolderDrag(lx, ly);
      };
      const touchBlock = (ev: TouchEvent) => { if (active && ev.cancelable) ev.preventDefault(); };
      const swallowClick = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      const up = () => {
        const was = active;
        cleanup();
        if (was) {
          draggedAt.current = Date.now();
          window.addEventListener('click', swallowClick, { capture: true, once: true });
          setTimeout(() => window.removeEventListener('click', swallowClick, true), 50);
          endFolderDrag();
        }
      };
      const cancel = () => { const was = active; cleanup(); if (was) cancelFolderDrag(); };
      const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cancel(); };
      function cleanup() {
        active = false;
        if (timer) clearTimeout(timer);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('touchmove', touchBlock);
        window.removeEventListener('keydown', key);
      }
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('touchmove', touchBlock, { passive: false });
      window.addEventListener('keydown', key);
      // a grip starts at once; a row waits for the hold (so a swipe still scrolls)
      if (touch) { if (mode === 'handle') start(); else timer = setTimeout(start, longPressMs); }
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [longPressMs, slop, mode]);

  // ---------------- native: hold, then drag (rows) ----------------
  const touch = useRef({ timer: null as any, sx: 0, sy: 0, active: false });
  const nativeLongPress = useMemo(() => {
    const clear = () => { if (touch.current.timer) clearTimeout(touch.current.timer); touch.current.timer = null; };
    return {
      onTouchStart: (e: any) => {
        if (!live.current.enabled) return;
        const { pageX, pageY } = e.nativeEvent;
        touch.current.sx = pageX; touch.current.sy = pageY; touch.current.active = false;
        clear();
        touch.current.timer = setTimeout(() => {
          touch.current.timer = null;
          const payload = live.current.getPayload();
          if (!payload) return;
          touch.current.active = true;
          beginFolderDrag(payload, touch.current.sx, touch.current.sy);
        }, longPressMs);
      },
      onTouchMove: (e: any) => {
        const { pageX, pageY } = e.nativeEvent;
        if (touch.current.active) { moveFolderDrag(pageX, pageY); return; }
        // moved before the hold ended = a scroll gesture
        if (touch.current.timer && Math.hypot(pageX - touch.current.sx, pageY - touch.current.sy) > slop * 2) clear();
      },
      onTouchEnd: () => {
        clear();
        if (touch.current.active) { touch.current.active = false; draggedAt.current = Date.now(); endFolderDrag(); }
      },
      onTouchCancel: () => {
        clear();
        if (touch.current.active) { touch.current.active = false; draggedAt.current = Date.now(); cancelFolderDrag(); }
      },
    };
  }, [longPressMs, slop]);

  // ---------------- native: a grip that drags at once ----------------
  const nativeHandle = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => live.current.enabled,
    onMoveShouldSetPanResponder: () => live.current.enabled,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const payload = live.current.getPayload();
      if (!payload) return;
      touch.current.active = true;
      beginFolderDrag(payload, e.nativeEvent.pageX, e.nativeEvent.pageY);
    },
    onPanResponderMove: (e) => { if (touch.current.active) moveFolderDrag(e.nativeEvent.pageX, e.nativeEvent.pageY); },
    onPanResponderRelease: () => { if (touch.current.active) { touch.current.active = false; draggedAt.current = Date.now(); endFolderDrag(); } },
    onPanResponderTerminate: () => { if (touch.current.active) { touch.current.active = false; cancelFolderDrag(); } },
  }), []);

  const props = Platform.OS === 'web' ? {} : mode === 'handle' ? nativeHandle.panHandlers : nativeLongPress;
  return { ref, props, wasDragged };
}
