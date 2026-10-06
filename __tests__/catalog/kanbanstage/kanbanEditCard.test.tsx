/** @jest-environment jsdom */
// kit8/catalog/kanbanstage/KanbanEditCard: create / update / delete through the reusable saga actions; the
// form follows realtime changes made in another browser.
import React, { act } from 'react';

const mockReplace = jest.fn();
let mockParams: any = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }), useLocalSearchParams: () => mockParams }));
jest.mock('../../../kit8/ui/components/common/IconApp', () => () => null);
jest.mock('expo-crypto', () => ({ randomUUID: () => 'new-guid-1' }));
jest.mock('../../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../../kit8/ui/components/common', () => {
  const R = require('react');
  const { Pressable, Text, TextInput, Switch, View } = require('react-native');
  const Btn = ({ testID, onPress, disabled, children }: any) => R.createElement(Pressable, { testID, onPress, disabled }, R.createElement(Text, null, children));
  return {
    ButtonPrimaryApp: Btn,
    ButtonTextApp: Btn,
    TextInputApp: ({ testID, value, onChangeText, error, showError }: any) =>
      R.createElement(View, null, R.createElement(TextInput, { testID, value, onChangeText }), showError ? R.createElement(Text, { testID: `${testID}-error` }, error) : null),
    SwitchApp: ({ testID, value, onValueChange }: any) => R.createElement(Switch, { testID, value, onValueChange }),
  };
});

import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { reusableCrudSlice } from '../../../kit8/redux/reusable/reusableCrudSlice';
import { SystemMetaData } from '../../../kit8/redux/SystemMetaData';
import KanbanEditCard from '../../../kit8/catalog/kanbanstage/KanbanEditCard';
import { __resetRealtimeEntityUsers } from '../../../kit8/redux/reusable/useRealtimeEntity';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = require('react-dom/client');

const slice = reusableCrudSlice('kanbanStageReusable');
SystemMetaData.kanbanStageReusable.actions = slice.actions;
let store: any;
let dispatched: any[] = [];
let root: any;
const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const press = (id: string) => act(() => { (q(id) as any).click(); });
const typeInto = (id: string, text: string) => {
  const el = q(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => { setter.call(el, text); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const value = (id: string) => (q(id) as HTMLInputElement).value;
const PLAN = { rowGUID: 'plan', rowOwnerGUID: 'kanbanStageCatalog', rowParentGUID: 'empty', orderInList: 2048, updated_at: 't1',
  rowJSON: { stageCode: 'plan', stageName: 'Plan', stageColor: '#6366F1', isActive: true } };

function mount(params: any, rows: any[] = [PLAN]) {
  mockParams = params;
  dispatched = [];
  store = configureStore({
    reducer: { kanbanStageReusable: slice.reducer },
    middleware: (g) => g({ serializableCheck: false }).concat(() => (next: any) => (a: any) => (dispatched.push(a), next(a))),
  });
  act(() => { store.dispatch(slice.actions.readDataSuccess({ data: rows })); });
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<Provider store={store}><KanbanEditCard /></Provider>));
}
afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ''; __resetRealtimeEntityUsers(); jest.clearAllMocks(); });

it('starts the realtime subscription of the catalog', () => {
  mount({ rowGUID: 'plan' });
  expect(dispatched.some((a) => a.type === 'kanbanStageReusable/startRealtime')).toBe(true);
});

it('new stage: code follows the name, duplicates are refused, createOne goes last with the catalog owner', () => {
  mount({});
  typeInto('kanban-stage-edit-stageName', 'plan');
  expect(value('kanban-stage-edit-stageCode')).toBe('plan');
  press('kanban-stage-edit-save');
  expect(q('kanban-stage-edit-stageName-error')!.textContent).toMatch(/already in the catalog/);
  typeInto('kanban-stage-edit-stageName', 'Code Review');
  expect(value('kanban-stage-edit-stageCode')).toBe('code_review');
  press('kanban-stage-edit-color-#EF4444');
  press('kanban-stage-edit-save');
  const create = dispatched.find((a) => a.type === 'kanbanStageReusable/createOne');
  expect(create.payload).toMatchObject({
    rowGUID: 'new-guid-1',
    rowOwnerGUID: 'kanbanStageCatalog',
    rowParentGUID: 'empty',
    orderInList: 2048 + 1024,
    rowJSON: { stageName: 'Code Review', stageCode: 'code_review', stageColor: '#EF4444', isActive: true },
  });
  expect(mockReplace).toHaveBeenCalledWith('/catalog/kanbanstage/list');
});

it('existing stage: updateOne; delete asks twice', () => {
  mount({ rowGUID: 'plan' });
  expect(value('kanban-stage-edit-stageName')).toBe('Plan');
  typeInto('kanban-stage-edit-stageName', 'Planning');
  expect(value('kanban-stage-edit-stageCode')).toBe('plan'); // an existing code does not follow the name
  press('kanban-stage-edit-save');
  expect(dispatched.find((a) => a.type === 'kanbanStageReusable/updateOne').payload).toMatchObject({ rowGUID: 'plan', rowJSON: { stageName: 'Planning', stageCode: 'plan' } });
  mount({ rowGUID: 'plan' });
  press('kanban-stage-edit-delete');
  expect(dispatched.some((a) => a.type === 'kanbanStageReusable/deleteOne')).toBe(false);
  press('kanban-stage-edit-delete');
  expect(dispatched.find((a) => a.type === 'kanbanStageReusable/deleteOne').payload).toMatchObject({ rowGUID: 'plan', rowOwnerGUID: 'kanbanStageCatalog' });
});

it('realtime: clean form follows, dirty form offers Reload; deleted elsewhere blocks saving', () => {
  mount({ rowGUID: 'plan' });
  const remote = (change: any) => act(() => { store.dispatch(slice.actions.applyRealtimeChange(change)); });
  remote({ eventType: 'UPDATE', table: 'kanban_stage_table', new: { ...PLAN, updated_at: 't2', rowJSON: { ...PLAN.rowJSON, stageName: 'Plan v2' } }, old: null });
  expect(value('kanban-stage-edit-stageName')).toBe('Plan v2');
  typeInto('kanban-stage-edit-stageColor', '#000000');
  remote({ eventType: 'UPDATE', table: 'kanban_stage_table', new: { ...PLAN, updated_at: 't3', rowJSON: { ...PLAN.rowJSON, stageName: 'Plan v3' } }, old: null });
  expect(q('kanban-stage-edit-remote-changed')).not.toBeNull();
  press('kanban-stage-edit-reload');
  expect(value('kanban-stage-edit-stageName')).toBe('Plan v3');
  remote({ eventType: 'DELETE', table: 'kanban_stage_table', new: null, old: { rowGUID: 'plan' } });
  expect(q('kanban-stage-edit-gone')!.textContent).toMatch(/deleted in another window/);
});
