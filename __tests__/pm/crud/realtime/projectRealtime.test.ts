// Pure matching rules of the PM realtime channel (kit8/pm/crud/realtime/projectRealtime.ts).
import {
  hasInvalidation,
  invalidationFor,
  isDeleteRelevant,
  mergeInvalidation,
  PM_REALTIME_NOTHING,
} from '../../../../kit8/pm/crud/realtime/projectRealtime';

const cache: any = {
  projects: [{ rowGUID: 'p1' }],
  projectData: {
    tasks: [{ rowGUID: 't1' }, { rowGUID: 't2' }],
    deps: [{ rowGUID: 't2', rowDependsOnGUID: 't1' }],
  },
  userSettingsRowGUIDs: ['s1'],
};

describe('invalidationFor', () => {
  it('maps every table to the queries it feeds', () => {
    expect(invalidationFor('project')).toEqual({ projects: true, projectData: true, closure: false, userSettings: false });
    expect(invalidationFor('task')).toEqual({ projects: true, projectData: true, closure: true, userSettings: false });
    expect(invalidationFor('dependency')).toEqual({ projects: true, projectData: true, closure: true, userSettings: false });
    expect(invalidationFor('userSettings')).toEqual({ projects: false, projectData: false, closure: false, userSettings: true });
  });
  it('merges and detects empty sets', () => {
    expect(hasInvalidation(PM_REALTIME_NOTHING)).toBe(false);
    const m = mergeInvalidation(invalidationFor('userSettings'), invalidationFor('project'));
    expect(m).toEqual({ projects: true, projectData: true, closure: false, userSettings: true });
  });
});

describe('isDeleteRelevant (unfiltered DELETE events, primary key only)', () => {
  it('matches cached rows', () => {
    expect(isDeleteRelevant('project', { rowGUID: 'p1' }, cache)).toBe(true);
    expect(isDeleteRelevant('task', { rowGUID: 't2' }, cache)).toBe(true);
    expect(isDeleteRelevant('dependency', { rowGUID: 't2', rowDependsOnGUID: 't1' }, cache)).toBe(true);
    expect(isDeleteRelevant('userSettings', { rowGUID: 's1' }, cache)).toBe(true);
  });
  it('a link whose successor task is ours matters even if the link is not cached yet', () => {
    expect(isDeleteRelevant('dependency', { rowGUID: 't1', rowDependsOnGUID: 'zz' }, cache)).toBe(true);
  });
  it('ignores rows of other projects / users and empty payloads', () => {
    expect(isDeleteRelevant('project', { rowGUID: 'other' }, cache)).toBe(false);
    expect(isDeleteRelevant('task', { rowGUID: 'other' }, cache)).toBe(false);
    expect(isDeleteRelevant('dependency', { rowGUID: 'x', rowDependsOnGUID: 'y' }, cache)).toBe(false);
    expect(isDeleteRelevant('userSettings', { rowGUID: 'other' }, cache)).toBe(false);
    expect(isDeleteRelevant('task', null, cache)).toBe(false);
    expect(isDeleteRelevant('task', {}, cache)).toBe(false);
    expect(isDeleteRelevant('task', { rowGUID: 't1' }, {})).toBe(false);
  });
});
