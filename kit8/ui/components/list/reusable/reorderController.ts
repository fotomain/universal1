// ReusableList - drag reorder of a BIG list on a phone (and the web): no per-item animation, only index math over a FIXED item height.
//   start      the finger took the ⠿ handle of an item: measure the list, remember the scroll offset
//   move       the finger moved: the ghost follows it, the drop index = (scroll offset + finger y) / item height, the drop line jumps to it
//   tick       the finger is near the top / bottom edge: the list scrolls by itself (scrollToOffset), the drop index follows
//   end        released: onDrop(from, to) once, the data source saves ONE row (its orderInList between its new neighbours)
// No React here: unit tested with fake timers (__tests__/ui/list/reorderController.test.ts). 500 000 rows cost the same as 50: nothing is measured per item.
import { autoScrollSpeed, clampScroll, dropIndexAt } from './listEngine';

export interface ReorderDeps {
  /** live values (read at every call: the list grows, the height changes) */
  opts: () => { itemHeight: number; count: number; enabled: boolean; /** highest index a drop may land on (server mode: not after the last loaded row while more pages exist) */ lastDropIndex?: number };
  /** the list container: top (page y) and height in px */
  measure: (cb: (top: number, height: number) => void) => void;
  /** the last measure of the container (from its layout): a drag starts at once with it, the fresh measure only corrects it */
  cached?: () => { top: number; height: number } | null;
  scrollTo: (offset: number) => void;
  onDrop: (from: number, to: number) => void;
  /** the drag state changed (null = no drag): the list shows the ghost / the line, dims the row, stops its own scrolling */
  onChange: (state: { from: number; target: number; guid: string } | null) => void;
  ghostY: { setValue: (v: number) => void };
  lineY: { setValue: (v: number) => void };
  tickMs?: number;
}

export interface ReorderController {
  start: (guid: string, index: number, pageY: number) => void;
  move: (pageY: number) => void;
  end: () => void;
  cancel: () => void;
  onScroll: (offsetY: number) => void;
  isActive: () => boolean;
}

export function createReorderController(d: ReorderDeps): ReorderController {
  const s = { active: false, pending: false, guid: '', from: -1, target: -1, top: 0, height: 0, offset: 0, lastY: 0, timer: null as any };

  const stopTimer = () => { if (s.timer) { clearInterval(s.timer); s.timer = null; } };
  const lineAt = (target: number, itemHeight: number) => (target + (target > s.from ? 1 : 0)) * itemHeight - s.offset;

  const recompute = () => {
    const { itemHeight, count, lastDropIndex } = d.opts();
    const raw = dropIndexAt(s.offset + (s.lastY - s.top), itemHeight, count);
    const target = Math.min(raw, lastDropIndex ?? count - 1);
    d.lineY.setValue(lineAt(target, itemHeight));
    if (target !== s.target) { s.target = target; d.onChange({ from: s.from, target, guid: s.guid }); }
  };

  const ghost = () => {
    const { itemHeight } = d.opts();
    d.ghostY.setValue(Math.max(0, Math.min(s.lastY - s.top - itemHeight / 2, Math.max(0, s.height - itemHeight))));
  };

  const tick = () => {
    if (!s.active) return;
    const { itemHeight, count } = d.opts();
    const speed = autoScrollSpeed(s.lastY - s.top, s.height);
    if (speed === 0) return;
    const next = clampScroll(s.offset + speed, count, itemHeight, s.height);
    if (next === s.offset) return;
    s.offset = next;
    d.scrollTo(next);
    recompute();
  };

  return {
    start(guid, index, pageY) {
      if (!d.opts().enabled || s.active || s.pending) return;
      s.lastY = pageY;
      const activate = (top: number, height: number) => {
        s.active = true; s.guid = guid; s.from = index; s.target = -1; s.top = top; s.height = height;
        ghost();
        recompute();
        stopTimer();
        s.timer = setInterval(tick, d.tickMs ?? 16);
      };
      const known = d.cached?.();
      if (known && known.height > 0) {
        activate(known.top, known.height);
        // the fresh measure corrects a list that moved (the page scrolled)
        d.measure((top, height) => { if (s.active && s.guid === guid && height > 0) { s.top = top; s.height = height; ghost(); recompute(); } });
        return;
      }
      s.pending = true;
      d.measure((top, height) => {
        if (!s.pending) return; // cancelled while measuring
        s.pending = false;
        activate(top, height);
      });
    },
    move(pageY) {
      s.lastY = pageY;
      if (!s.active) return;
      ghost();
      recompute();
    },
    onScroll(offsetY) { s.offset = offsetY; if (s.active) d.lineY.setValue(lineAt(s.target < 0 ? s.from : s.target, d.opts().itemHeight)); },
    end() {
      s.pending = false;
      if (!s.active) return;
      stopTimer();
      const { from, target } = s;
      s.active = false;
      d.onChange(null);
      if (target >= 0 && target !== from) d.onDrop(from, target);
    },
    cancel() {
      s.pending = false;
      if (!s.active) return;
      stopTimer();
      s.active = false;
      d.onChange(null);
    },
    isActive: () => s.active || s.pending,
  };
}
