/** @jest-environment jsdom */
// PM dialogs: task edit, dependency editor, approve Yes/No/Cancel, Gantt UX/UI settings.
import { act } from 'react';
import { cleanupUI, fakeCrud, inputValue, press, q, renderUI, seedStore, textOf, toggleSwitch, typeInto } from './pmUiTestKit';
import React from 'react';
import PMTaskEditModal from '../../../kit8/pm/PMTaskEditModal';
import PMEditDependencyScreen from '../../../kit8/pm/PMEditDependencyScreen';
import PMApproveYesNoCancelModalWindow, { askPMApprove } from '../../../kit8/pm/PMApproveYesNoCancelModalWindow';
import PMGanttUXUISettinsModalWindow from '../../../kit8/pm/gantt/PMGanttUXUISettinsModalWindow';
import { usePMStore } from '../../../kit8/pm/store';

afterEach(() => {
  act(() => {
    const s = usePMStore.getState();
    s.setEditing(null);
    s.setEditingDep(null);
    s.setUxuiSettingsOpen(false);
  });
  cleanupUI();
});

describe('PMTaskEditModal', () => {
  it('shows every field of the selected task', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    renderUI(<PMTaskEditModal crud={fakeCrud()} />);
    expect(q('pm-edit-name')).toBeNull();
    act(() => usePMStore.getState().setEditing(t.rowGUID));
    expect(inputValue('pm-edit-name')).toBe('Task 111');
    for (const id of [
      'pm-edit-close', 'pm-edit-kind-stage', 'pm-edit-kind-task', 'pm-edit-kind-milestone', 'pm-edit-days', 'pm-edit-progress',
      'pm-edit-start', 'pm-edit-color-auto', 'pm-edit-notes', 'pm-edit-delete', 'pm-edit-open', 'pm-edit-cancel', 'pm-edit-save',
    ]) expect(q(id)).not.toBeNull();
  });

  it('Save sends the edited values; Cancel / ✕ close without saving', () => {
    const { byName } = seedStore();
    const t = byName('Task 111');
    const crud = fakeCrud();
    renderUI(<PMTaskEditModal crud={crud} />);
    act(() => usePMStore.getState().setEditing(t.rowGUID));
    typeInto('pm-edit-name', 'Renamed task');
    press('pm-edit-cancel');
    expect(crud.updateTask).not.toHaveBeenCalled();
    expect(usePMStore.getState().editingGUID).toBeNull();

    act(() => usePMStore.getState().setEditing(t.rowGUID));
    press('pm-edit-close');
    expect(usePMStore.getState().editingGUID).toBeNull();

    act(() => usePMStore.getState().setEditing(t.rowGUID));
    typeInto('pm-edit-name', 'Renamed task');
    typeInto('pm-edit-days', '7');
    typeInto('pm-edit-progress', '40');
    typeInto('pm-edit-start', '2026-10-05');
    typeInto('pm-edit-notes', 'hello');
    press('pm-edit-save');
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
    const [guid, patch] = crud.updateTask.mock.calls[0];
    expect(guid).toBe(t.rowGUID);
    expect(patch.rowProgress).toBe(40);
    expect(patch.rowJSON).toMatchObject({ name: 'Renamed task', durationDays: 7, rowKind: 'task', notes: 'hello' });
    expect(patch.rowJSON.manualStartAt).toBe(new Date(Date.UTC(2026, 9, 5)).toISOString());
  });

  it('milestone kind forces 0 days; bad start date shows an error and keeps the dialog', () => {
    const { byName } = seedStore();
    const crud = fakeCrud();
    renderUI(<PMTaskEditModal crud={crud} />);
    act(() => usePMStore.getState().setEditing(byName('Task 112').rowGUID));
    press('pm-edit-kind-milestone');
    expect(inputValue('pm-edit-days')).toBe('0');
    typeInto('pm-edit-start', '5.10.2026');
    press('pm-edit-save');
    expect(crud.updateTask).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('YYYY-MM-DD');
    typeInto('pm-edit-start', '');
    press('pm-edit-save');
    expect(crud.updateTask.mock.calls[0][1].rowJSON).toMatchObject({ rowKind: 'milestone', durationDays: 0, manualStartAt: null });
  });

  it('Delete and Details delegate to crud', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    renderUI(<PMTaskEditModal crud={crud} />);
    act(() => usePMStore.getState().setEditing(g));
    press('pm-edit-delete');
    expect(crud.deleteTask).toHaveBeenCalledWith(g);
    act(() => usePMStore.getState().setEditing(g));
    press('pm-edit-open');
    expect(crud.openInfo).toHaveBeenCalledWith(g);
  });
});

describe('PMEditDependencyScreen', () => {
  const firstDep = (demo: any) => demo.deps.find((d: any) => d.projectGUID === demo.projects[0].rowGUID)!;

  it('shows GUIDs (copyable), link types, lag, colors and actions', () => {
    const { demo } = seedStore();
    const dep = firstDep(demo);
    renderUI(<PMEditDependencyScreen crud={fakeCrud()} />);
    act(() => usePMStore.getState().setEditingDep({ rowGUID: dep.rowGUID, dependsOnGUID: dep.rowDependsOnGUID }));
    expect(inputValue('pm-dep-from-guid')).toBe(dep.rowDependsOnGUID);
    expect(inputValue('pm-dep-to-guid')).toBe(dep.rowGUID);
    for (const id of ['pm-dep-close', 'pm-dep-from-guid-copy', 'pm-dep-to-guid-copy', 'pm-dep-type-FS', 'pm-dep-type-SS', 'pm-dep-type-FF', 'pm-dep-type-SF', 'pm-dep-lag', 'pm-dep-color-default', 'pm-dep-delete', 'pm-dep-cancel', 'pm-dep-save'])
      expect(q(id)).not.toBeNull();
  });

  it('copy button copies the GUID to the clipboard', async () => {
    const { demo } = seedStore();
    const dep = firstDep(demo);
    renderUI(<PMEditDependencyScreen crud={fakeCrud()} />);
    act(() => usePMStore.getState().setEditingDep({ rowGUID: dep.rowGUID, dependsOnGUID: dep.rowDependsOnGUID }));
    press('pm-dep-from-guid-copy');
    await act(async () => undefined);
    expect(require('expo-clipboard').setStringAsync).toHaveBeenCalledWith(dep.rowDependsOnGUID);
  });

  it('Save sends type / lag / color; unchanged Save does not write; Delete removes', () => {
    const { demo } = seedStore();
    const dep = firstDep(demo);
    const ref = { rowGUID: dep.rowGUID, dependsOnGUID: dep.rowDependsOnGUID };
    const crud = fakeCrud();
    renderUI(<PMEditDependencyScreen crud={crud} />);
    act(() => usePMStore.getState().setEditingDep(ref));
    press('pm-dep-save');
    expect(crud.updateDependency).not.toHaveBeenCalled();
    expect(usePMStore.getState().editingDep).toBeNull();

    act(() => usePMStore.getState().setEditingDep(ref));
    press('pm-dep-type-SS');
    typeInto('pm-dep-lag', '2');
    const swatch = Array.from(document.querySelectorAll('[data-testid^="pm-dep-color-"]'))
      .map((e) => e.getAttribute('data-testid')!)
      .find((id) => id !== 'pm-dep-color-default')!;
    press(swatch);
    press('pm-dep-save');
    expect(crud.updateDependency).toHaveBeenCalledWith(ref, expect.objectContaining({ linkType: 'SS', lagDays: 2, rowJSON: expect.objectContaining({ dependencyColor: swatch.replace('pm-dep-color-', '') }) }));

    act(() => usePMStore.getState().setEditingDep(ref));
    press('pm-dep-delete');
    expect(crud.deleteDependency).toHaveBeenCalledWith(ref);
  });
});

describe('PMApproveYesNoCancelModalWindow', () => {
  it.each([
    ['pm-approve-yes', 'yes'],
    ['pm-approve-no', 'no'],
    ['pm-approve-cancel', 'cancel'],
  ])('%s answers %s', async (id, answer) => {
    renderUI(<PMApproveYesNoCancelModalWindow />);
    expect(q('pm-approve-window')).toBeNull();
    let p!: Promise<string>;
    act(() => {
      p = askPMApprove({ title: 'Delete "Task 1"?', message: 'Sure?', yesLabel: 'Delete', destructive: true });
    });
    expect(q('pm-approve-window')).not.toBeNull();
    expect(q('pm-approve-icon')).not.toBeNull();
    expect(textOf('pm-approve-window')).toContain('Delete "Task 1"?');
    expect(textOf('pm-approve-yes')).toContain('Delete');
    press(id);
    await expect(p).resolves.toBe(answer);
    expect(q('pm-approve-window')).toBeNull();
  });

  it('web keyboard: Enter = Yes, Esc = Cancel', async () => {
    renderUI(<PMApproveYesNoCancelModalWindow />);
    let p!: Promise<string>;
    act(() => {
      p = askPMApprove({ title: 'Undo?' });
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    await expect(p).resolves.toBe('yes');
    act(() => {
      p = askPMApprove({ title: 'Undo?' });
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await expect(p).resolves.toBe('cancel');
  });
});

describe('PMGanttUXUISettinsModalWindow (⚙ on the Gantt bar)', () => {
  it('opens from store, shows every setting, Save writes the draft', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<PMGanttUXUISettinsModalWindow crud={crud} />);
    expect(q('pm-uxui-window')).toBeNull();
    act(() => usePMStore.getState().setUxuiSettingsOpen(true));
    for (const id of [
      'pm-uxui-close', 'pm-uxui-critical', 'pm-uxui-arrows-smoothForm', 'pm-uxui-arrows-squareForm', 'pm-uxui-progress',
      'pm-uxui-task-line-pos-onTop', 'pm-uxui-task-line-pos-atTheMiddle', 'pm-uxui-task-line-pos-onBottom', 'pm-uxui-task-line-color-default',
      'pm-uxui-project-line-pos-onTop', 'pm-uxui-project-line-pos-atTheMiddle', 'pm-uxui-project-line-pos-onBottom', 'pm-uxui-project-line-color-default',
      'pm-uxui-defaults', 'pm-uxui-cancel', 'pm-uxui-save',
    ]) expect(q(id)).not.toBeNull();

    toggleSwitch('pm-uxui-critical');
    press('pm-uxui-arrows-squareForm');
    toggleSwitch('pm-uxui-progress');
    press('pm-uxui-task-line-pos-onBottom');
    press('pm-uxui-task-line-color-#22c55e');
    press('pm-uxui-project-line-pos-onTop');
    press('pm-uxui-project-line-color-#ef4444');
    press('pm-uxui-save');
    expect(crud.setGanttViewSettings).toHaveBeenCalledTimes(1);
    const d = crud.setGanttViewSettings.mock.calls[0][0];
    expect(d).toMatchObject({
      ganttArrowsForm: 'squareForm',
      taskProgressLinePosition: 'onBottom',
      taskProgressLineColor: '#22c55e',
      projectProgressLinePosition: 'onTop',
      projectProgressLineColor: '#ef4444',
    });
    expect(typeof d.showCriticalPath).toBe('boolean');
    expect(typeof d.showTaskProgressOnGantt).toBe('boolean');
    expect(usePMStore.getState().uxuiSettingsOpen).toBe(false);
  });

  it('task tree: "#" switch + default column order', () => {
    seedStore();
    act(() => usePMStore.getState().setTreeColumnsSettings({ treeColumnsOrder: ['name', 'wbs', 'start', 'days', 'progress'] }));
    const crud = fakeCrud();
    renderUI(<PMGanttUXUISettinsModalWindow crud={crud} />);
    act(() => usePMStore.getState().setUxuiSettingsOpen(true));
    expect(textOf('pm-uxui-tree-columns-order')).toBe('#  ·  Task name  ·  Start  ·  Days  ·  %'); // the draft comes from the project (defaults)
    toggleSwitch('pm-uxui-tree-numbers');
    press('pm-uxui-save');
    const d = crud.setGanttViewSettings.mock.calls[0][0];
    expect(d.showTreeHierarchyNumbers).toBe(false);
    expect(d.treeColumnsOrder).toEqual(['wbs', 'name', 'start', 'days', 'progress']);
    act(() => usePMStore.getState().setTreeColumnsSettings({ treeColumnsOrder: ['wbs', 'name', 'start', 'days', 'progress'], showTreeHierarchyNumbers: true }));
  });

  it('Cancel / ✕ close without saving; Defaults resets the draft', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<PMGanttUXUISettinsModalWindow crud={crud} />);
    act(() => usePMStore.getState().setUxuiSettingsOpen(true));
    press('pm-uxui-task-line-color-#22c55e');
    press('pm-uxui-cancel');
    expect(q('pm-uxui-window')).toBeNull();
    act(() => usePMStore.getState().setUxuiSettingsOpen(true));
    press('pm-uxui-close');
    expect(q('pm-uxui-window')).toBeNull();
    expect(crud.setGanttViewSettings).not.toHaveBeenCalled();

    act(() => usePMStore.getState().setUxuiSettingsOpen(true));
    press('pm-uxui-task-line-color-#22c55e');
    press('pm-uxui-defaults');
    press('pm-uxui-save');
    expect(crud.setGanttViewSettings.mock.calls[0][0].taskProgressLineColor).toBe('yellow');
  });
});
