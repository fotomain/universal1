// ReusableList - swipe actions of an item: the pure rules (no React), so they are tested without a screen.
// The finger moves LEFT -> RIGHT (positive x, `swipeModeFromLeftToRight`) or RIGHT -> LEFT (negative x, `swipeModeFromRightToLeft`); each direction has ONE of four modes
// (the settings of the list, `reusableListGUID` -> ReusableListSettings, window: three dots menu -> Settings):
//   archiveWithStop / deleteWithStop          the item stops at the action button (96 px); the user presses it
//   archiveWithDesappear / deleteWithDesappear a long swipe or a flick runs the action at once and the item slides out
// Archive does not move the row anywhere: it sets `rowJSON.rowIsArchived` to true (a second archive = false); the card shows the Archive icon.
// Where archived rows live is the setting `showArchivedRowsMode`: on a separate tab (default; tabs All / Archived, shown only while archived rows exist) or in the same list.

/** width of the revealed action button, px */
export const SWIPE_ACTION_WIDTH = 96;
/** a drag past this share of the item width runs a "Desappear" action at once (no button to press), never less than 1.2 buttons */
export const SWIPE_RUN_SHARE = 0.3;
/** a quick flick (px / ms) that also runs a "Desappear" action, once the drag is past 60 % of a button */
export const SWIPE_FLICK_VELOCITY = 1.2;
/** a drag shorter than half a button just closes again */
export const SWIPE_OPEN_AT = SWIPE_ACTION_WIDTH * 0.5;

export const SWIPE_MODES = ['archiveWithStop', 'archiveWithDesappear', 'deleteWithStop', 'deleteWithDesappear'] as const;
export type SwipeMode = typeof SWIPE_MODES[number];
export type SwipeAction = 'archive' | 'delete';
/** 'ltr' = the finger moves from the left to the right (positive x), 'rtl' = from the right to the left */
export type SwipeDirection = 'ltr' | 'rtl';

export const isSwipeMode = (v: unknown): v is SwipeMode => typeof v === 'string' && (SWIPE_MODES as readonly string[]).includes(v);
export const swipeActionOf = (mode: SwipeMode): SwipeAction => (mode.startsWith('archive') ? 'archive' : 'delete');
export const swipeStops = (mode: SwipeMode): boolean => mode.endsWith('WithStop');

/** the visible card inside its item: side margin x, top / bottom margin y, corner radius (px) */
export interface SwipeInset { x?: number; y?: number; radius?: number }

/** the local settings of ONE list (kept on this device under its reusableListGUID) */
export interface ReusableListSettings {
  swipeModeFromLeftToRight: SwipeMode;
  swipeModeFromRightToLeft: SwipeMode;
  /** where archived rows are shown: in the one list (marked with the Archive icon) or on their own tab (All | Archived; the tabs are drawn only while archived rows exist) */
  showArchivedRowsMode: ShowArchivedRowsMode;
}
export const SHOW_ARCHIVED_ROWS_MODES = ['showArchivedRowsInOneList', 'showArchivedRowsOnSeparateTab'] as const;
export type ShowArchivedRowsMode = typeof SHOW_ARCHIVED_ROWS_MODES[number];
export const isShowArchivedRowsMode = (v: unknown): v is ShowArchivedRowsMode => typeof v === 'string' && (SHOW_ARCHIVED_ROWS_MODES as readonly string[]).includes(v);
export const DEFAULT_LIST_SETTINGS: ReusableListSettings = { swipeModeFromLeftToRight: 'archiveWithStop', swipeModeFromRightToLeft: 'deleteWithStop', showArchivedRowsMode: 'showArchivedRowsOnSeparateTab' };

/** anything stored / typed -> valid settings (a wrong value falls back to the default of that key) */
export function normalizeListSettings(raw: unknown): ReusableListSettings {
  const r: any = raw && typeof raw === 'object' ? raw : {};
  return {
    swipeModeFromLeftToRight: isSwipeMode(r.swipeModeFromLeftToRight) ? r.swipeModeFromLeftToRight : DEFAULT_LIST_SETTINGS.swipeModeFromLeftToRight,
    swipeModeFromRightToLeft: isSwipeMode(r.swipeModeFromRightToLeft) ? r.swipeModeFromRightToLeft : DEFAULT_LIST_SETTINGS.swipeModeFromRightToLeft,
    // showArchivedRows (true) of the first version = the one list
    showArchivedRowsMode: isShowArchivedRowsMode(r.showArchivedRowsMode) ? r.showArchivedRowsMode : r.showArchivedRows === true ? 'showArchivedRowsInOneList' : DEFAULT_LIST_SETTINGS.showArchivedRowsMode,
  };
}

/** the prop `swipeActions` of the list: not set / true = on (both actions), false = no swipe at all, or an object that switches an ACTION off (`{ delete: false }`) */
export type SwipeActionsProp = boolean | { archive?: boolean; delete?: boolean };

export interface SwipeSideConfig { action: SwipeAction; stop: boolean }
/** what the item does in each direction (null = that direction does not swipe) */
export interface SwipeConfig { ltr: SwipeSideConfig | null; rtl: SwipeSideConfig | null }

/**
 * the swipes the user may use now: the settings of the list, narrowed by the prop (an action that is switched off) and by what the user may do
 * (archive changes the row = canEdit, delete = canDelete). null = no swipe at all
 */
export function resolveSwipe(prop: SwipeActionsProp | undefined, settings: ReusableListSettings, can: { edit: boolean; delete: boolean }): SwipeConfig | null {
  if (prop === false) return null;
  const allowed = typeof prop === 'object' && prop ? { archive: prop.archive !== false, delete: prop.delete !== false } : { archive: true, delete: true };
  const side = (mode: SwipeMode): SwipeSideConfig | null => {
    const action = swipeActionOf(mode);
    const ok = action === 'archive' ? allowed.archive && can.edit : allowed.delete && can.delete;
    return ok ? { action, stop: swipeStops(mode) } : null;
  };
  const cfg: SwipeConfig = { ltr: side(settings.swipeModeFromLeftToRight), rtl: side(settings.swipeModeFromRightToLeft) };
  return cfg.ltr || cfg.rtl ? cfg : null;
}

/** the same swipe without the archive action (a row the database refuses to update) */
export function withoutArchive(cfg: SwipeConfig | null): SwipeConfig | null {
  if (!cfg) return null;
  const out: SwipeConfig = { ltr: cfg.ltr?.action === 'archive' ? null : cfg.ltr, rtl: cfg.rtl?.action === 'archive' ? null : cfg.rtl };
  return out.ltr || out.rtl ? out : null;
}

/** the Archive / Restore command (row menu, card FAB) is offered by the list: not with `swipeActions` false or `{ archive: false }`. The user's swipe settings do not matter here */
export const archiveOffered = (prop: SwipeActionsProp | undefined): boolean => prop !== false && !(typeof prop === 'object' && prop !== null && prop.archive === false);

/** does some direction archive */
export const hasArchive = (cfg: SwipeConfig | null): boolean => cfg?.ltr?.action === 'archive' || cfg?.rtl?.action === 'archive';

/** where archived rows live in THIS list: a list without swipe / Settings (`swipeActions` false) keeps them in the one list */
export function archivedRowsModeOf(prop: SwipeActionsProp | undefined, settings: ReusableListSettings): ShowArchivedRowsMode {
  return prop === false ? 'showArchivedRowsInOneList' : settings.showArchivedRowsMode;
}

export type ArchivedTab = 'all' | 'archived';
/**
 * the rows of a list with archived rows on a separate tab: tab All = the rows that are not archived, tab Archived = the archived ones.
 * The tabs exist only while archived rows exist: without them everything is on All.
 */
export function rowsOfArchivedTab<T extends { rowJSON?: any }>(rows: T[], tab: ArchivedTab): T[] {
  return tab === 'archived' ? rows.filter((r) => isRowArchived(r)) : rows.filter((r) => !isRowArchived(r));
}

const sideOf = (x: number, cfg: SwipeConfig): SwipeSideConfig | null => (x > 0 ? cfg.ltr : x < 0 ? cfg.rtl : null);
export const directionOf = (x: number): SwipeDirection | null => (x > 0 ? 'ltr' : x < 0 ? 'rtl' : null);

/** the position of the item for a drag: only a direction that swipes, a Stop mode never past its button, never past the item width */
export function clampSwipe(x: number, width: number, cfg: SwipeConfig): number {
  const side = sideOf(x, cfg);
  if (!side) return 0;
  const max = side.stop ? SWIPE_ACTION_WIDTH : Math.max(width, SWIPE_ACTION_WIDTH);
  return x > 0 ? Math.min(x, max) : Math.max(x, -max);
}

/** can a horizontal move that ends at x start a swipe (the responder asks while the finger moves) */
export function swipeAllowed(x: number, cfg: SwipeConfig): boolean {
  return !!sideOf(x, cfg);
}

export type SwipeOutcome = { kind: 'run'; direction: SwipeDirection; action: SwipeAction } | { kind: 'open'; direction: SwipeDirection } | { kind: 'close' };

/** what happens when the finger is lifted at x (the clamped position) with the speed vx (px / ms, positive = to the right) */
export function swipeOutcome(x: number, vx: number, width: number, cfg: SwipeConfig): SwipeOutcome {
  const side = sideOf(x, cfg);
  const direction = directionOf(x);
  if (!side || !direction) return { kind: 'close' };
  const dist = Math.abs(x);
  if (!side.stop) {
    const toward = direction === 'ltr' ? vx : -vx;
    const runAt = Math.max(SWIPE_ACTION_WIDTH * 1.2, Math.max(width, SWIPE_ACTION_WIDTH) * SWIPE_RUN_SHARE);
    if (dist >= runAt || (dist >= SWIPE_ACTION_WIDTH * 0.6 && toward >= SWIPE_FLICK_VELOCITY)) return { kind: 'run', direction, action: side.action };
  }
  if (dist >= SWIPE_OPEN_AT) return { kind: 'open', direction };
  return { kind: 'close' };
}

/** the row is archived (the only thing archive writes) */
export const isRowArchived = (row: { rowJSON?: any } | null | undefined): boolean => row?.rowJSON?.rowIsArchived === true;

/** the words of the settings window */
export const SHOW_ARCHIVED_LABEL: Record<ShowArchivedRowsMode, { label: string; description: string }> = {
  showArchivedRowsOnSeparateTab: { label: 'On a separate tab', description: 'Tabs All and Archived (the tabs show only while archived cards exist).' },
  showArchivedRowsInOneList: { label: 'In the same list', description: 'Archived cards stay in the list with the Archive icon; no tabs.' },
};
export const SWIPE_MODE_LABEL: Record<SwipeMode, { label: string; description: string }> = {
  archiveWithStop: { label: 'Archive, stop at the button', description: 'The card stops at the Archive button; press it.' },
  archiveWithDesappear: { label: 'Archive, card disappears', description: 'A long swipe archives at once; the card slides out.' },
  deleteWithStop: { label: 'Delete, stop at the button', description: 'The card stops at the Delete button; press it.' },
  deleteWithDesappear: { label: 'Delete, card disappears', description: 'A long swipe deletes at once (after the question, if on).' },
};
