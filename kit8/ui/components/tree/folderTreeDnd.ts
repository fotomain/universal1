// TREE.PLUGIN - folderTreeDnd: ONE drag session shared by every tree and every drag source (web + iOS + Android).
//
// Why not a DnD library: the tree is virtualized (200 000 folders -> ~40 mounted rows), and the dragged things come
// from OTHER components (rows of ReusableTable). So a drag is just a payload + the pointer position in window
// coordinates; a drop zone (the tree) turns the position into a target row itself.
//
//   source   beginFolderDrag(payload, x, y) · moveFolderDrag(x, y) · endFolderDrag() / cancelFolderDrag()
//            (hooks for sources: useFolderDragSource - ./useFolderDragSource)
//   zone     registerDropZone({ getRect, accepts, onMove, onLeave, onDrop })
//   picture  FolderTreeDragGhost follows the pointer (unless the source draws its own, payload.ownGhost)
//
// Coordinates: web = clientX / clientY (getBoundingClientRect), native = pageX / pageY (View.measure).
import { useSyncExternalStore } from 'react';

/** what is dragged */
export interface FolderDragPayload {
  /** 'folder' = a folder of a tree (move); 'items' = rows / products / anything dropped INTO a folder */
  kind: 'folder' | 'items' | (string & {});
  /** folder ids / row ids */
  ids: string[];
  /** text of the dragged picture */
  label: string;
  /** who started the drag (tree instance id, table testID ...) */
  source?: string;
  /** the source draws the dragged picture itself (the web table clone): no ghost */
  ownGhost?: boolean;
  data?: any;
}

export interface DropRect { left: number; top: number; width: number; height: number }

export interface DropZone {
  id: string;
  /** window rect of the zone (cached by the zone; refreshed in `refresh`) */
  getRect: () => DropRect | null;
  accepts: (payload: FolderDragPayload) => boolean;
  /** the pointer is over the zone */
  onMove: (x: number, y: number, payload: FolderDragPayload) => void;
  /** the pointer left the zone, or the drag ended */
  onLeave: () => void;
  /** dropped here; false = not handled (the source may do its default) */
  onDrop: (x: number, y: number, payload: FolderDragPayload) => boolean | void;
  /** a drag started: measure the zone again */
  refresh?: () => void;
}

export interface FolderDragState { payload: FolderDragPayload | null; x: number; y: number }

const IDLE: FolderDragState = { payload: null, x: 0, y: 0 };
let state: FolderDragState = IDLE;
let hoveredZone: string | null = null;
const zones: DropZone[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const subscribeFolderDrag = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getFolderDrag = (): FolderDragState => state;
export const isFolderDragging = () => state.payload !== null;

/** a drop zone; returns the unregister function */
export function registerDropZone(zone: DropZone): () => void {
  zones.push(zone);
  return () => {
    const i = zones.indexOf(zone);
    if (i >= 0) zones.splice(i, 1);
    if (hoveredZone === zone.id) hoveredZone = null;
  };
}

const inside = (r: DropRect | null, x: number, y: number) => !!r && x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height;

/** the zone under the pointer that takes this payload (the last registered wins) */
export function zoneAt(x: number, y: number, payload: FolderDragPayload): DropZone | null {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (z.accepts(payload) && inside(z.getRect(), x, y)) return z;
  }
  return null;
}

export function beginFolderDrag(payload: FolderDragPayload, x: number, y: number) {
  if (state.payload) cancelFolderDrag();
  state = { payload, x, y };
  zones.forEach((z) => z.refresh?.());
  notify();
  moveFolderDrag(x, y);
}

export function moveFolderDrag(x: number, y: number) {
  const payload = state.payload;
  if (!payload) return;
  state = { payload, x, y };
  const zone = zoneAt(x, y, payload);
  if (hoveredZone && (!zone || zone.id !== hoveredZone)) zones.find((z) => z.id === hoveredZone)?.onLeave();
  hoveredZone = zone ? zone.id : null;
  zone?.onMove(x, y, payload);
  notify();
}

/** the pointer was released: drops on the zone under it. true = a zone took the drop */
export function endFolderDrag(): boolean {
  const { payload, x, y } = state;
  if (!payload) return false;
  const zone = zoneAt(x, y, payload);
  hoveredZone = null;
  state = IDLE;
  zones.forEach((z) => z.onLeave());
  notify();
  return !!zone && zone.onDrop(x, y, payload) !== false;
}

export function cancelFolderDrag() {
  if (!state.payload) return;
  hoveredZone = null;
  state = IDLE;
  zones.forEach((z) => z.onLeave());
  notify();
}

/** the whole drag state (payload + pointer): re-renders on every move - for the ghost */
export function useFolderDragState(): FolderDragState {
  return useSyncExternalStore(subscribeFolderDrag, getFolderDrag, getFolderDrag);
}
/** only "is something dragged": re-renders when a drag starts / ends */
export function useFolderDragActive(): boolean {
  return useSyncExternalStore(subscribeFolderDrag, isFolderDragging, isFolderDragging);
}

/** rect of a view in the coordinates of the pointer (web: client, native: page) */
export function measureViewRect(node: any, done: (r: DropRect | null) => void) {
  if (!node) { done(null); return; }
  if (typeof node.getBoundingClientRect === 'function') {
    const r = node.getBoundingClientRect();
    done({ left: r.left, top: r.top, width: r.width, height: r.height });
  } else if (typeof node.measure === 'function') {
    node.measure((_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => done({ left: pageX, top: pageY, width, height }));
  } else done(null);
}
