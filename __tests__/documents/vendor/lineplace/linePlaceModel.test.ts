// The place of a line of a multi project vendor invoice / purchase order: the answer of *_line_places, the GUID pasted from the clipboard, what a field change asks the database.
import { extractGUID, parseLinePlaces, placeCellText, placeChange, placesSignature } from '../../../../kit8/documents/vendor/lineplace/linePlaceModel';

const G1 = '1ea2b3c4-0000-4000-8000-000000000001';
const G2 = '2fb3c4d5-0000-4000-8000-000000000002';

describe('extractGUID', () => {
  it('takes the first GUID of the clipboard text, lower case', () => {
    expect(extractGUID(G1)).toBe(G1);
    expect(extractGUID(`  ${G1.toUpperCase()}\n`)).toBe(G1);
    expect(extractGUID(`GUID copied: ${G1} and ${G2}`)).toBe(G1);
    expect(extractGUID(`https://x.test/pm/project/dashboard?taskGUID=${G2}&view=finances`)).toBe(G2);
  });
  it('no GUID = null (an id of a catalog or any text is not a task)', () => {
    expect(extractGUID('')).toBeNull();
    expect(extractGUID(null)).toBeNull();
    expect(extractGUID(undefined)).toBeNull();
    expect(extractGUID('vc-1')).toBeNull();
    expect(extractGUID('1ea2b3c4-0000-4000-8000')).toBeNull();
  });
});

describe('placeChange', () => {
  it('a task: only the task (the line becomes an independent line of it); a task line: only the line (its task follows); empty: both null = clear', () => {
    expect(placeChange('task', G1)).toEqual({ task: G1, taskLine: null });
    expect(placeChange('taskLine', G2)).toEqual({ task: null, taskLine: G2 });
    expect(placeChange('task', null)).toEqual({ task: null, taskLine: null });
    expect(placeChange('taskLine', null)).toEqual({ task: null, taskLine: null });
  });
});

describe('parseLinePlaces', () => {
  it('{ line: place }; missing fields are empty, a missing task line is null', () => {
    const p = parseLinePlaces({ l1: { projectGUID: 'p', projectName: 'Project 1', taskGUID: G1, taskName: 'Task 111', taskLineGUID: G2 }, l2: { projectGUID: 'p' } });
    expect(p.l1).toEqual({ projectGUID: 'p', projectName: 'Project 1', taskGUID: G1, taskName: 'Task 111', taskLineGUID: G2 });
    expect(p.l2).toEqual({ projectGUID: 'p', projectName: '', taskGUID: '', taskName: '', taskLineGUID: null });
  });
  it('anything that is not an object is an empty answer', () => {
    expect(parseLinePlaces(null)).toEqual({});
    expect(parseLinePlaces([1])).toEqual({});
    expect(parseLinePlaces('x')).toEqual({});
  });
});

describe('placesSignature / placeCellText', () => {
  it('the signature changes when a line moves, not when the rows are in another order', () => {
    const a = { rowGUID: 'a', rowProjectGUID: 'p1', rowOwnerGUID: 't1', taskLineGUID: null };
    const b = { rowGUID: 'b', rowProjectGUID: 'p1', rowOwnerGUID: 't1', taskLineGUID: 'x' };
    expect(placesSignature([a, b])).toBe(placesSignature([b, a]));
    expect(placesSignature([a, b])).not.toBe(placesSignature([{ ...a, rowOwnerGUID: 't2' }, b]));
    expect(placesSignature(undefined)).toBe('');
  });
  it('the task cell: the name with the GUID under it; the task line cell: the GUID; no place: empty', () => {
    const place = { projectGUID: 'p', projectName: 'P', taskGUID: G1, taskName: 'Task 111', taskLineGUID: G2 };
    expect(placeCellText('task', place)).toEqual({ main: 'Task 111', sub: G1 });
    expect(placeCellText('taskLine', place)).toEqual({ main: G2, sub: '' });
    expect(placeCellText('task', { ...place, taskName: '' }).main).toBe(G1);
    expect(placeCellText('taskLine', { ...place, taskLineGUID: null }).main).toBe('');
    expect(placeCellText('task', undefined)).toEqual({ main: '', sub: '' });
  });
});
