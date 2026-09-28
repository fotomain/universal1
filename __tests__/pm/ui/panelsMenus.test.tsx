/** @jest-environment jsdom */
// kit8/pm/panels (tree hover panel, gantt bar panel) and kit8/pm/menu (context menus).
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';
import React from 'react';
import PMTreeRowHoverPanel from '../../../kit8/pm/panels/tree/PMTreeRowHoverPanel';
import PMGanttBarHoverPanel from '../../../kit8/pm/panels/gantt/PMGanttBarHoverPanel';
import PMContextMenu from '../../../kit8/pm/menu/PMContextMenu';
import PMDependencyMenu from '../../../kit8/pm/menu/PMDependencyMenu';
import { makePMPalette } from '../../../kit8/pm/theme';
import { usePMStore } from '../../../kit8/pm/store';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const G = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

afterEach(cleanupUI);

describe('PMTreeRowHoverPanel (panels/tree)', () => {
  it('task row: add below (1st) · add above · edit · link · details · delete', () => {
    const crud = fakeCrud();
    renderUI(<PMTreeRowHoverPanel guid={G} isSummary={false} crud={crud} palette={palette} width={200} right={0} animatedStyle={{}} />);
    expect(q('pm-tree-row-panel')).not.toBeNull();
    expectInOrder([`pm-tree-row-add-below-${G}`, `pm-tree-row-add-above-${G}`, `pm-tree-row-edit-${G}`, `pm-tree-row-link-${G}`, `pm-tree-row-open-${G}`, `pm-tree-row-delete-${G}`]);
    expect(q(`pm-tree-row-add-${G}`)).toBeNull(); // "add inside" only for stages
    press(`pm-tree-row-add-below-${G}`);
    press(`pm-tree-row-add-above-${G}`);
    press(`pm-tree-row-edit-${G}`);
    press(`pm-tree-row-link-${G}`);
    press(`pm-tree-row-open-${G}`);
    press(`pm-tree-row-delete-${G}`);
    expect(crud.createTaskBelow).toHaveBeenCalledWith(G);
    expect(crud.createTaskAbove).toHaveBeenCalledWith(G);
    expect(crud.edit).toHaveBeenCalledWith(G);
    expect(crud.startLink).toHaveBeenCalledWith(G);
    expect(crud.openInfo).toHaveBeenCalledWith(G);
    expect(crud.deleteTask).toHaveBeenCalledWith(G);
  });

  it('stage row also has "add task inside", after add below / above', () => {
    const crud = fakeCrud();
    renderUI(<PMTreeRowHoverPanel guid={G} isSummary crud={crud} palette={palette} width={220} right={0} animatedStyle={{}} />);
    expectInOrder([`pm-tree-row-add-below-${G}`, `pm-tree-row-add-above-${G}`, `pm-tree-row-add-${G}`, `pm-tree-row-edit-${G}`]);
    press(`pm-tree-row-add-${G}`);
    expect(crud.createTask).toHaveBeenCalledWith(G);
  });
});

describe('PMGanttBarHoverPanel (panels/gantt)', () => {
  it('add · edit · link · details · delete', () => {
    const crud = fakeCrud();
    renderUI(<PMGanttBarHoverPanel guid={G} crud={crud} palette={palette} animatedStyle={{}} />);
    expect(q('pm-gantt-bar-panel')).not.toBeNull();
    expectInOrder([`pm-gantt-bar-add-${G}`, `pm-gantt-bar-edit-${G}`, `pm-gantt-bar-link-${G}`, `pm-gantt-bar-open-${G}`, `pm-gantt-bar-delete-${G}`]);
    press(`pm-gantt-bar-add-${G}`);
    press(`pm-gantt-bar-delete-${G}`);
    expect(crud.createTask).toHaveBeenCalledWith(G);
    expect(crud.deleteTask).toHaveBeenCalledWith(G);
  });
});

describe('PMContextMenu (menu)', () => {
  it('renders caption + items with icons; item press and backdrop close', () => {
    const a = jest.fn();
    const b = jest.fn();
    const onClose = jest.fn();
    renderUI(
      <PMContextMenu
        testID="m"
        x={10}
        y={20}
        caption="Menu"
        onClose={onClose}
        items={[
          { testID: 'm-a', label: 'Alpha', icon: 'edit', onPress: a },
          { testID: 'm-b', label: 'Beta', icon: 'delete', danger: true, onPress: b },
          { testID: 'm-c', label: 'Gamma', icon: 'block', disabled: true, onPress: b },
        ]}
      />
    );
    expect(textOf('m-caption')).toBe('Menu');
    expectInOrder(['m-a', 'm-b', 'm-c']);
    expect(q('m-a-icon')).not.toBeNull();
    expect(textOf('m-b')).toContain('Beta');
    press('m-a');
    expect(a).toHaveBeenCalledTimes(1);
    press('m-c');
    expect(b).not.toHaveBeenCalled(); // disabled
    press('m-backdrop');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PMDependencyMenu (right click on a dependency arrow)', () => {
  it('hidden without store.depMenu; shows "pred → succ", Edit / Delete call crud', () => {
    const { demo } = seedStore();
    const dep = demo.deps.find((d: any) => d.projectGUID === demo.projects[0].rowGUID)!;
    const ref = { rowGUID: dep.rowGUID, dependsOnGUID: dep.rowDependsOnGUID };
    const crud = fakeCrud();
    act(() => usePMStore.getState().setDepMenu(null));
    renderUI(<PMDependencyMenu crud={crud} />);
    expect(q('pm-dep-menu')).toBeNull();
    act(() => usePMStore.getState().setDepMenu({ ...ref, x: 100, y: 100 }));
    const names = usePMStore.getState().tasksById;
    expect(textOf('pm-dep-menu-caption')).toBe(`${names[dep.rowDependsOnGUID].rowJSON.name} → ${names[dep.rowGUID].rowJSON.name}`);
    expectInOrder(['pm-dep-menu-edit', 'pm-dep-menu-delete']);
    press('pm-dep-menu-edit');
    expect(crud.openDependencyEditor).toHaveBeenCalledWith(ref);
    press('pm-dep-menu-delete');
    expect(crud.deleteDependency).toHaveBeenCalledWith(ref);
    press('pm-dep-menu-backdrop');
    expect(crud.closeDependencyMenu).toHaveBeenCalled();
    act(() => usePMStore.getState().setDepMenu(null));
  });
});
