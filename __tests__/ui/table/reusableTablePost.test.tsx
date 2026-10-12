/** @jest-environment jsdom */
// ReusableTable with postDataNeeded (the task line table): the Post button is the FIRST button of the bar, icon always, text (Post · Posted · Post needed)
// only on a wide window, coloured by postButtonColor; a duplicated row is not posted; without postDataNeeded there is no button.
import React, { act } from 'react';

jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common/IconApp', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name, testID }: any) => R.createElement(Text, { testID }, name) };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/x', useGlobalSearchParams: () => ({}) }));
jest.mock('react-native-paper', () => ({ useTheme: () => ({ colors: { surfaceVariant: 'rgb(231, 224, 236)' } }) }));
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `new-${++n}` }; });
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../kit8/redux/reusable/useRealtimeEntity', () => ({ useRealtimeEntity: jest.fn() }));
const mockActions = {
  readData: jest.fn((p: any) => ({ type: 'read', p })),
  createOne: jest.fn((p: any) => ({ type: 'create', p })),
  updateOne: jest.fn((p: any) => ({ type: 'update', p })),
  deleteOne: jest.fn((p: any) => ({ type: 'delete', p })),
};
jest.mock('../../../kit8/redux/SystemMetaData', () => ({ SystemMetaData: { thing: { get actions() { return mockActions; } } } }));
let mockState: any = {};
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({ ...jest.requireActual('react-redux'), useSelector: (fn: any) => fn(mockState), useDispatch: () => mockDispatch }));
jest.mock('../../../kit8/catalog/inner/select_element/SelectElementFromCatalog', () => ({ __esModule: true, defaultTitleExtractor: (r: any) => r?.rowJSON?.title || '', default: () => null }));
jest.mock('../../../kit8/pm/inner/menu/PMContextMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/ui/components/common/AskBeforeDeletePostComponent', () => ({ __esModule: true, default: () => null }));
jest.mock('../../../kit8/pm/inner/buttons/PMIconButton', () => {
  const R = require('react');
  const { Pressable, Text } = require('react-native');
  return { PMIconButton: ({ testID, icon, onPress, disabled }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, icon)) };
});
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn(() => Promise.resolve()) } }));
jest.mock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  return { __esModule: true, default: ({ leftIcons, heightVariant, ...p }: any) => R.createElement(TextInput, p) };
});
jest.mock('../../../kit8/pm/inner/tooltip/PMTooltip', () => ({ usePMTip: () => ({ ref: { current: null }, onHoverIn: undefined, onHoverOut: undefined, onPressIn: undefined, onLongPress: undefined, delayLongPress: 500, accessibilityHint: undefined }) }));
jest.mock('../../../kit8/redux/uxuiSlice', () => ({ showSnackbar: (p: any) => ({ type: 'snackbar', p }) }));

import ReusableTable from '../../../kit8/ui/components/table/reusable/ReusableTable';
import { POST_BUTTON_WIDE_FROM } from '../../../kit8/ui/components/table/reusable/ReusableTablePostButton';
import { REUSABLE_TABLE_ALL } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import type { VisualColumn } from '../../../kit8/ui/components/table/reusable/reusableTableTypes';
import { Dimensions } from 'react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { const el = q(id); if (!el) throw new Error(`${id} not found`); el.click(); });
const T = 't';
const columns: VisualColumn[] = [{ key: 'n', title: '#', type: 'rowNumber' }, { key: 'title', title: 'Title', type: 'text' }];
const row = (id: string, posted: boolean) => ({ rowGUID: id, rowOwnerGUID: 'o1', rowParentGUID: 'g', orderInList: 1, rowJSON: { title: id, taskIsPosted: posted } });
function mount(props: any = {}, rows: any[] = [row('a', false)]) {
  mockState = { uxuiState: { askBeforeDeletePost: false }, thing: { entityDataFromServer: rows, readSuccessful: 1 } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<ReusableTable testID={T} entityName="thing" listOwnerGUID={REUSABLE_TABLE_ALL} listParentGUID={REUSABLE_TABLE_ALL} visualColumns={columns} {...props} />));
}
const setWidth = (width: number) => jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 } as any);
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; jest.clearAllMocks(); jest.restoreAllMocks(); });

describe('postDataNeeded', () => {
  it('false by default: no Post button', () => {
    mount();
    expect(q(`${T}-post`)).toBeNull();
  });

  it('true: the Post button is the FIRST element of the panel, before the add button', () => {
    mount({ postDataNeeded: true });
    const panel = q(`${T}-crud-panel`)!;
    expect(panel.firstElementChild!.getAttribute('data-testid')).toBe(`${T}-post`);
    expect(panel.querySelector(`[data-testid="${T}-add"]`)).not.toBeNull();
  });

  it('the Post button stays when the CRUD panel is off (a table that only posts)', () => {
    mount({ postDataNeeded: true, crudPanelEnabled: false });
    expect(q(`${T}-post`)).not.toBeNull();
    expect(q(`${T}-add`)).toBeNull();
  });

  it.each([
    ['post', 'Post', 'cloud_upload'],
    ['postNeeded', 'Post needed', 'sync_problem'],
  ])('state %s: text "%s" on a wide window, the icon %s', (state, text, icon) => {
    setWidth(POST_BUTTON_WIDE_FROM + 100);
    mount({ postDataNeeded: true, postState: state });
    expect(q(`${T}-post-text`)!.textContent).toBe(text);
    expect(q(`${T}-post`)!.textContent).toContain(icon);
    expect(q(`${T}-post`)!.getAttribute('aria-label')).toBe(text);
  });

  it('state posted: everything is posted, so the Post button is invisible (not rendered)', () => {
    setWidth(POST_BUTTON_WIDE_FROM + 100);
    mount({ postDataNeeded: true, postState: 'posted' });
    expect(q(`${T}-post`)).toBeNull();
  });

  it('a narrow window shows the icon only, the label stays for the screen reader', () => {
    setWidth(POST_BUTTON_WIDE_FROM - 300);
    mount({ postDataNeeded: true, postState: 'postNeeded' });
    expect(q(`${T}-post-text`)).toBeNull();
    expect(q(`${T}-post`)!.textContent).toContain('sync_problem');
    expect(q(`${T}-post`)!.getAttribute('aria-label')).toBe('Post needed');
  });

  it('without postState: no button when every row has taskIsPosted, else Post; postedField renames the key', () => {
    setWidth(1400);
    mount({ postDataNeeded: true }, [row('a', true), row('b', true)]);
    expect(q(`${T}-post`)).toBeNull();
    act(() => root.unmount()); document.body.innerHTML = '';
    mount({ postDataNeeded: true }, [row('a', true), row('b', false)]);
    expect(q(`${T}-post-text`)!.textContent).toBe('Post');
    act(() => root.unmount()); document.body.innerHTML = '';
    mount({ postDataNeeded: true, postedField: 'done' }, [{ ...row('a', false), rowJSON: { done: true } }]);
    expect(q(`${T}-post`)).toBeNull();
    act(() => root.unmount()); document.body.innerHTML = '';
    mount({ postDataNeeded: true, postedField: 'done' }, [{ ...row('a', false), rowJSON: { done: false } }]);
    expect(q(`${T}-post-text`)!.textContent).toBe('Post');
  });

  it('pressing it runs onPost (while there is something to post)', async () => {
    const onPost = jest.fn(() => Promise.resolve());
    for (const state of ['post', 'postNeeded']) {
      mount({ postDataNeeded: true, postState: state, onPost });
      await act(async () => { q(`${T}-post`)!.click(); });
      act(() => root.unmount()); document.body.innerHTML = '';
    }
    expect(onPost).toHaveBeenCalledTimes(2);
  });

  it('the button is busy (disabled) while onPost runs, and free again after', async () => {
    let finish: () => void = () => {};
    const onPost = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    mount({ postDataNeeded: true, postState: 'post', onPost });
    await act(async () => { q(`${T}-post`)!.click(); });
    expect(q(`${T}-post`)!.getAttribute('aria-disabled')).toBe('true');
    await act(async () => { q(`${T}-post`)!.click(); });
    expect(onPost).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(q(`${T}-post`)!.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('the colour is postButtonColor (light fuchsia by default)', () => {
    setWidth(1400);
    mount({ postDataNeeded: true, postState: 'post' });
    expect(getComputedStyle(q(`${T}-post`)!).backgroundColor).toMatch(/240, 171, 252|#f0abfc/i);
    act(() => root.unmount()); document.body.innerHTML = '';
    mount({ postDataNeeded: true, postState: 'post', postButtonColor: '#00FF00' });
    expect(getComputedStyle(q(`${T}-post`)!).backgroundColor).toMatch(/0, 255, 0|#00ff00/i);
  });

  it('a duplicated row gets duplicateOverrides (not posted), the other values are copied', () => {
    mount({ postDataNeeded: true, duplicateOverrides: { taskIsPosted: false, baseOfDistribution: null } }, [{ ...row('a', true), rowJSON: { title: 'a', taskIsPosted: true, baseOfDistribution: 1 } }]);
    press(`${T}-select-a`);
    press(`${T}-duplicate-selected`);
    expect(mockActions.createOne).toHaveBeenCalledTimes(1);
    expect((mockActions.createOne.mock.calls[0] as any)[0].rowJSON).toEqual({ title: 'a', taskIsPosted: false, baseOfDistribution: null });
  });
});
