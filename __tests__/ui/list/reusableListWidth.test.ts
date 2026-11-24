import { reusableListWidthStyle, REUSABLE_LIST_DEFAULT_MAX_WIDTH } from '../../../kit8/ui/components/list/reusable/reusableListWidth';

describe('reusableListWidth', () => {
  test('the default max width is 960', () => {
    expect(REUSABLE_LIST_DEFAULT_MAX_WIDTH).toBe(960);
  });
  test('not defined: as wide as the parent, at most 960, centred', () => {
    expect(reusableListWidthStyle()).toEqual({ width: '100%', maxWidth: 960, alignSelf: 'center' });
    expect(reusableListWidthStyle(undefined)).toEqual({ width: '100%', maxWidth: 960, alignSelf: 'center' });
  });
  test('a wrong value counts as not defined', () => {
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(reusableListWidthStyle(bad)).toEqual({ width: '100%', maxWidth: 960, alignSelf: 'center' });
    }
  });
  test('defined: that width, never wider than the parent', () => {
    expect(reusableListWidthStyle(600)).toEqual({ width: 600, maxWidth: '100%', alignSelf: 'center' });
    expect(reusableListWidthStyle(1400)).toEqual({ width: 1400, maxWidth: '100%', alignSelf: 'center' });
  });
});
