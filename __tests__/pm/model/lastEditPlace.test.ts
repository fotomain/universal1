import {
  financesPlaceOf, lastEditPlaceOf, makeLastEditPlace, modalTabOf, pageSectionOf, sameLastEditPlace,
} from '../../../kit8/pm/model/lastEditPlace';

const NOW = new Date('2026-10-09T10:00:00.000Z');

describe('makeLastEditPlace', () => {
  it('builds a versioned place with the time and the editor', () => {
    expect(makeLastEditPlace({ surface: 'taskPage', section: 'finances', genus: 'timeGenus', lineGUID: 'l1' }, 'u1', NOW)).toEqual({
      v: 1, surface: 'taskPage', section: 'finances', genus: 'timeGenus', lineGUID: 'l1', at: NOW.toISOString(), by: 'u1',
    });
    expect(makeLastEditPlace({ surface: 'editModal', section: 'TabUXUI' }, null, NOW)).toEqual({ v: 1, surface: 'editModal', section: 'TabUXUI', at: NOW.toISOString() });
  });

  it('refuses a section the surface does not have', () => {
    expect(makeLastEditPlace({ surface: 'editModal', section: 'finances' })).toBeNull();
    expect(makeLastEditPlace({ surface: 'taskPage', section: 'TabMain' })).toBeNull();
    expect(makeLastEditPlace({ surface: 'nowhere' as any, section: 'progress' })).toBeNull();
    expect(makeLastEditPlace({ surface: 'taskPage', section: '' })).toBeNull();
  });
});

describe('lastEditPlaceOf (reads what a client wrote)', () => {
  it('returns the place; junk, another version or an unknown section = null', () => {
    const p = makeLastEditPlace({ surface: 'financesView', section: 'finances', genus: 'materialGenus' }, 'u1', NOW)!;
    expect(lastEditPlaceOf({ lastEditPlace: p })).toEqual(p);
    expect(lastEditPlaceOf(undefined)).toBeNull();
    expect(lastEditPlaceOf({})).toBeNull();
    expect(lastEditPlaceOf({ lastEditPlace: 'finances' })).toBeNull();
    expect(lastEditPlaceOf({ lastEditPlace: { ...p, v: 2 } })).toBeNull();
    expect(lastEditPlaceOf({ lastEditPlace: { ...p, section: 'somethingNew' } })).toBeNull();
    expect(lastEditPlaceOf({ lastEditPlace: { ...p, surface: 'smartWatch' } })).toBeNull();
  });

  it('drops fields of the wrong type instead of trusting them', () => {
    const got = lastEditPlaceOf({ lastEditPlace: { v: 1, surface: 'taskPage', section: 'finances', genus: 5, lineGUID: { x: 1 }, at: 7, by: ['u'] } });
    expect(got).toEqual({ v: 1, surface: 'taskPage', section: 'finances', at: '' });
  });
});

describe('sameLastEditPlace (the decision "write or not")', () => {
  const a = makeLastEditPlace({ surface: 'taskPage', section: 'finances', genus: 'timeGenus', lineGUID: 'l1' }, 'u1', NOW)!;
  it('time and editor do not count', () => {
    expect(sameLastEditPlace(a, { ...a, at: '2030-01-01T00:00:00.000Z', by: 'u2' })).toBe(true);
  });
  it('another tab, line, section or surface is another place', () => {
    expect(sameLastEditPlace(a, { ...a, genus: 'materialGenus' })).toBe(false);
    expect(sameLastEditPlace(a, { ...a, lineGUID: 'l2' })).toBe(false);
    expect(sameLastEditPlace(a, { ...a, lineGUID: undefined })).toBe(false);
    expect(sameLastEditPlace(a, { ...a, surface: 'financesView' })).toBe(false);
    expect(sameLastEditPlace(a, { ...a, section: 'progress' })).toBe(false);
  });
  it('nothing vs a place', () => {
    expect(sameLastEditPlace(null, null)).toBe(true);
    expect(sameLastEditPlace(null, a)).toBe(false);
    expect(sameLastEditPlace(a, undefined)).toBe(false);
  });
});

describe('what each screen activates', () => {
  const fin = makeLastEditPlace({ surface: 'financesView', section: 'finances', genus: 'expenseGenus', lineGUID: 'l9' }, 'u1', NOW)!;
  const modal = makeLastEditPlace({ surface: 'editModal', section: 'TabUXUI' }, 'u1', NOW)!;
  const page = makeLastEditPlace({ surface: 'taskPage', section: 'dependencies' }, 'u1', NOW)!;

  it('the Finances lines open on the same tab and line on the task page and in the Finances view', () => {
    expect(financesPlaceOf(fin)).toEqual({ genus: 'expenseGenus', lineGUID: 'l9' });
    expect(financesPlaceOf({ ...fin, surface: 'taskPage' })).toEqual({ genus: 'expenseGenus', lineGUID: 'l9' });
    expect(financesPlaceOf(modal)).toBeNull();
    expect(financesPlaceOf(page)).toBeNull();
    expect(financesPlaceOf(null)).toBeNull();
  });
  it('the task window opens on the tab it was edited on, else on Main', () => {
    expect(modalTabOf(modal)).toBe('TabUXUI');
    expect(modalTabOf(page)).toBe('TabMain');
    expect(modalTabOf(fin)).toBe('TabMain');
    expect(modalTabOf(null)).toBe('TabMain');
  });
  it('the task page scrolls to the section of a page place (a Finances place of the dashboard counts), not to a window place', () => {
    expect(pageSectionOf(page)).toBe('dependencies');
    expect(pageSectionOf(fin)).toBe('finances');
    expect(pageSectionOf(modal)).toBeNull();
    expect(pageSectionOf(null)).toBeNull();
  });
});

import { modalEditedTab, sameRowJSON } from '../../../kit8/pm/model/lastEditPlace';

describe('sameRowJSON / modalEditedTab (which tab of the task window was edited)', () => {
  it('key order and null / undefined do not count; a changed value or a nested change does', () => {
    expect(sameRowJSON({ a: 1, b: null, c: { x: [1, 2] } }, { c: { x: [1, 2] }, a: 1, d: undefined })).toBe(true);
    expect(sameRowJSON({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameRowJSON({ c: { x: [1, 2] } }, { c: { x: [1, 3] } })).toBe(false);
    expect(sameRowJSON({ a: 1, lastEditPlace: { v: 1 } }, { a: 1 }, ['lastEditPlace'])).toBe(true);
    expect(sameRowJSON(null, {})).toBe(true);
  });
  it('the tab with the change; both changed = the tab the user saved on; nothing changed = null', () => {
    expect(modalEditedTab({ main: true, uxui: false }, 'TabUXUI')).toBe('TabMain');
    expect(modalEditedTab({ main: false, uxui: true }, 'TabMain')).toBe('TabUXUI');
    expect(modalEditedTab({ main: true, uxui: true }, 'TabUXUI')).toBe('TabUXUI');
    expect(modalEditedTab({ main: true, uxui: true }, 'TabMain')).toBe('TabMain');
    expect(modalEditedTab({ main: false, uxui: false }, 'TabMain')).toBeNull();
  });
});
