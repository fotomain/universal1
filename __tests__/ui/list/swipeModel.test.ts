// ReusableList swipe rules (pure): the four modes per direction, what the user may do, the drag limits, what a lifted finger does, hidden archived rows.
import {
  archivedRowsModeOf, clampSwipe, DEFAULT_LIST_SETTINGS, hasArchive, isRowArchived, rowsOfArchivedTab, normalizeListSettings, resolveSwipe, SWIPE_ACTION_WIDTH, SWIPE_MODES, swipeActionOf, swipeAllowed,
  swipeOutcome, swipeStops, withoutArchive, ReusableListSettings, SwipeConfig,
} from '../../../kit8/ui/components/list/reusable/swipeModel';

const all = { edit: true, delete: true };
const W = 400;
const set = (l: any, r: any, mode: any = 'showArchivedRowsOnSeparateTab'): ReusableListSettings => ({ swipeModeFromLeftToRight: l, swipeModeFromRightToLeft: r, showArchivedRowsMode: mode });
const stopStop: SwipeConfig = { ltr: { action: 'archive', stop: true }, rtl: { action: 'delete', stop: true } };
const disDis: SwipeConfig = { ltr: { action: 'archive', stop: false }, rtl: { action: 'delete', stop: false } };

describe('modes', () => {
  it('four modes: an action and stop | disappear', () => {
    expect(SWIPE_MODES).toEqual(['archiveWithStop', 'archiveWithDesappear', 'deleteWithStop', 'deleteWithDesappear']);
    expect(swipeActionOf('archiveWithDesappear')).toBe('archive');
    expect(swipeActionOf('deleteWithStop')).toBe('delete');
    expect(swipeStops('deleteWithStop')).toBe(true);
    expect(swipeStops('deleteWithDesappear')).toBe(false);
  });
  it('defaults: left -> right archiveWithStop, right -> left deleteWithStop, archived rows on a separate tab', () => {
    expect(DEFAULT_LIST_SETTINGS).toEqual({ swipeModeFromLeftToRight: 'archiveWithStop', swipeModeFromRightToLeft: 'deleteWithStop', showArchivedRowsMode: 'showArchivedRowsOnSeparateTab' });
  });
  it('normalizeListSettings: a wrong or missing value falls back to the default of that key', () => {
    expect(normalizeListSettings(null)).toEqual(DEFAULT_LIST_SETTINGS);
    expect(normalizeListSettings({ swipeModeFromLeftToRight: 'nope', swipeModeFromRightToLeft: 'archiveWithDesappear', showArchivedRowsMode: 'x' }))
      .toEqual({ swipeModeFromLeftToRight: 'archiveWithStop', swipeModeFromRightToLeft: 'archiveWithDesappear', showArchivedRowsMode: 'showArchivedRowsOnSeparateTab' });
    expect(normalizeListSettings({ showArchivedRowsMode: 'showArchivedRowsInOneList' }).showArchivedRowsMode).toBe('showArchivedRowsInOneList');
    // the first version stored a boolean
    expect(normalizeListSettings({ showArchivedRows: true }).showArchivedRowsMode).toBe('showArchivedRowsInOneList');
  });
});

describe('resolveSwipe', () => {
  it('follows the settings; any mode in either direction (also the same action twice)', () => {
    expect(resolveSwipe(undefined, DEFAULT_LIST_SETTINGS, all)).toEqual(stopStop);
    expect(resolveSwipe(true, set('deleteWithDesappear', 'archiveWithDesappear'), all)).toEqual({ ltr: { action: 'delete', stop: false }, rtl: { action: 'archive', stop: false } });
    expect(resolveSwipe(true, set('deleteWithStop', 'deleteWithStop'), all)).toEqual({ ltr: { action: 'delete', stop: true }, rtl: { action: 'delete', stop: true } });
  });
  it('is ON when the host says nothing; swipeActions false = no swipe', () => {
    expect(resolveSwipe(undefined, DEFAULT_LIST_SETTINGS, all)).not.toBeNull();
    expect(resolveSwipe(false, DEFAULT_LIST_SETTINGS, all)).toBeNull();
  });
  it('an action the prop switches off, or the user may not do, takes its direction away; nothing left = null', () => {
    expect(resolveSwipe({ delete: false }, DEFAULT_LIST_SETTINGS, all)).toEqual({ ltr: stopStop.ltr, rtl: null });
    expect(resolveSwipe({ archive: false }, DEFAULT_LIST_SETTINGS, all)).toEqual({ ltr: null, rtl: stopStop.rtl });
    expect(resolveSwipe(true, DEFAULT_LIST_SETTINGS, { edit: true, delete: false })).toEqual({ ltr: stopStop.ltr, rtl: null });
    expect(resolveSwipe(true, DEFAULT_LIST_SETTINGS, { edit: false, delete: false })).toBeNull();
  });
  it('withoutArchive / hasArchive', () => {
    expect(hasArchive(stopStop)).toBe(true);
    expect(withoutArchive(stopStop)).toEqual({ ltr: null, rtl: stopStop.rtl });
    expect(withoutArchive({ ltr: { action: 'archive', stop: true }, rtl: null })).toBeNull();
    expect(hasArchive(withoutArchive(stopStop))).toBe(false);
  });
});

describe('archived rows: one list or a separate tab', () => {
  it('the setting decides; a list without swipe / Settings keeps one list', () => {
    expect(archivedRowsModeOf(undefined, DEFAULT_LIST_SETTINGS)).toBe('showArchivedRowsOnSeparateTab');
    expect(archivedRowsModeOf(true, set('archiveWithStop', 'deleteWithStop', 'showArchivedRowsInOneList'))).toBe('showArchivedRowsInOneList');
    expect(archivedRowsModeOf(false, DEFAULT_LIST_SETTINGS)).toBe('showArchivedRowsInOneList');
  });
  it('tab All = the rows that are not archived, tab Archived = the archived ones', () => {
    const rows = [{ id: 1, rowJSON: {} }, { id: 2, rowJSON: { rowIsArchived: true } }, { id: 3, rowJSON: { rowIsArchived: false } }];
    expect(rowsOfArchivedTab(rows, 'all').map((r) => r.id)).toEqual([1, 3]);
    expect(rowsOfArchivedTab(rows, 'archived').map((r) => r.id)).toEqual([2]);
  });
});

describe('clampSwipe / swipeAllowed', () => {
  it('a direction that does not swipe stays at 0; Stop never goes past its button; Disappear up to the item width', () => {
    expect(clampSwipe(50, W, stopStop)).toBe(50);
    expect(clampSwipe(900, W, stopStop)).toBe(SWIPE_ACTION_WIDTH);
    expect(clampSwipe(-900, W, stopStop)).toBe(-SWIPE_ACTION_WIDTH);
    expect(clampSwipe(900, W, disDis)).toBe(W);
    expect(clampSwipe(-900, W, disDis)).toBe(-W);
    expect(clampSwipe(50, W, { ltr: null, rtl: stopStop.rtl })).toBe(0);
    expect(swipeAllowed(10, { ltr: null, rtl: stopStop.rtl })).toBe(false);
    expect(swipeAllowed(-10, { ltr: null, rtl: stopStop.rtl })).toBe(true);
  });
});

describe('swipeOutcome', () => {
  it('a short drag closes; half a button opens it', () => {
    expect(swipeOutcome(SWIPE_ACTION_WIDTH * 0.3, 0, W, stopStop)).toEqual({ kind: 'close' });
    expect(swipeOutcome(SWIPE_ACTION_WIDTH * 0.6, 0, W, stopStop)).toEqual({ kind: 'open', direction: 'ltr' });
    expect(swipeOutcome(-SWIPE_ACTION_WIDTH * 0.6, 0, W, stopStop)).toEqual({ kind: 'open', direction: 'rtl' });
  });
  it('a Stop mode never runs by itself, however long or fast the swipe', () => {
    expect(swipeOutcome(SWIPE_ACTION_WIDTH, 3, W, stopStop)).toEqual({ kind: 'open', direction: 'ltr' });
    expect(swipeOutcome(-SWIPE_ACTION_WIDTH, -3, W, stopStop)).toEqual({ kind: 'open', direction: 'rtl' });
  });
  it('a Desappear mode runs after a long swipe, or a flick past 60 % of a button; a short one opens the button', () => {
    expect(swipeOutcome(W * 0.4, 0, W, disDis)).toEqual({ kind: 'run', direction: 'ltr', action: 'archive' });
    expect(swipeOutcome(-W * 0.4, 0, W, disDis)).toEqual({ kind: 'run', direction: 'rtl', action: 'delete' });
    expect(swipeOutcome(SWIPE_ACTION_WIDTH, 1.5, W, disDis)).toEqual({ kind: 'run', direction: 'ltr', action: 'archive' });
    expect(swipeOutcome(SWIPE_ACTION_WIDTH, -1.5, W, disDis)).toEqual({ kind: 'open', direction: 'ltr' });
    expect(swipeOutcome(SWIPE_ACTION_WIDTH, 0, W, disDis)).toEqual({ kind: 'open', direction: 'ltr' });
    // a tiny drag with a high speed is not a swipe
    expect(swipeOutcome(10, 3, W, disDis)).toEqual({ kind: 'close' });
  });
  it('a direction that does not swipe always closes', () => expect(swipeOutcome(W, 0, W, { ltr: null, rtl: stopStop.rtl })).toEqual({ kind: 'close' }));
});

describe('isRowArchived', () => {
  it('is true only for rowJSON.rowIsArchived === true', () => {
    expect(isRowArchived({ rowJSON: { rowIsArchived: true } })).toBe(true);
    expect(isRowArchived({ rowJSON: { rowIsArchived: false } })).toBe(false);
    expect(isRowArchived({ rowJSON: { rowIsArchived: 'true' } })).toBe(false);
    expect(isRowArchived({})).toBe(false);
    expect(isRowArchived(null)).toBe(false);
  });
});
