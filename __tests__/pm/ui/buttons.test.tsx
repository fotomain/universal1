/** @jest-environment jsdom */
// kit8/pm/inner/buttons: every PM button exists, shows its state and calls its action.
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, mustGet, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';
import React from 'react';
import { PMIconButton } from '../../../kit8/pm/inner/buttons/PMIconButton';
import { PMDialogButton } from '../../../kit8/pm/inner/buttons/PMDialogButton';
import PMAddProjectButton from '../../../kit8/pm/view/project/buttons/PMAddProjectButton';
import PMGanttUndoButton from '../../../kit8/pm/view/gantt/buttons/PMGanttUndoButton';
import PMGanttZoomButtons from '../../../kit8/pm/view/gantt/buttons/PMGanttZoomButtons';
import PMGanttScaleButtons from '../../../kit8/pm/view/gantt/buttons/PMGanttScaleButtons';
import PMGanttViewToggles from '../../../kit8/pm/view/gantt/buttons/PMGanttViewToggles';
import PMRowActionButtons from '../../../kit8/pm/inner/buttons/PMRowActionButtons';
import { makePMPalette } from '../../../kit8/pm/view/theme';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { PM_SETTINGS_BUTTON_WIDTH, PM_SETTINGS_ICON_SIZE, PM_WIDE_ACTION_WIDTH } from '../../../kit8/pm/model/constants';
import { PM_ZOOM_PRESETS } from '../../../kit8/pm/view/gantt/ganttGeometry';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);

afterEach(cleanupUI);

describe('PMIconButton (ButtonApp variant "toolbar")', () => {
  it('renders icon + label + badge and calls onPress', () => {
    const onPress = jest.fn();
    renderUI(<PMIconButton testID="btn" icon="undo" label="Undo" badge={3} onPress={onPress} color="#000" />);
    expect(textOf('btn')).toContain('Undo');
    expect(textOf('btn')).toContain('3');
    expect(q('btn-icon')).not.toBeNull();
    press('btn');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const onPress = jest.fn();
    renderUI(<PMIconButton testID="btn" icon="delete" disabled onPress={onPress} color="#000" />);
    press('btn');
    expect(onPress).not.toHaveBeenCalled();
    expect(mustGet('btn').getAttribute('aria-disabled')).toBe('true');
  });

  it('marks the active state (toggle buttons)', () => {
    renderUI(<PMIconButton testID="btn" icon="route" active activeColor="#f00" onPress={() => undefined} color="#000" />);
    expect(mustGet('btn').getAttribute('aria-selected')).toBe('true');
  });
});

describe('PMDialogButton (ButtonApp contained / outlined / text)', () => {
  it.each(['primary', 'secondary', 'text', 'danger', 'dangerOutlined', 'dangerContained'] as const)('kind %s renders its title and presses', (kind) => {
    const onPress = jest.fn();
    renderUI(<PMDialogButton testID="dlg" kind={kind} title="Save" onPress={onPress} />);
    expect(textOf('dlg')).toContain('Save');
    press('dlg');
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('PMAddProjectButton', () => {
  it('"+ Project" opens the new-project flow', () => {
    const onPress = jest.fn();
    renderUI(<PMAddProjectButton onPress={onPress} />);
    expect(textOf('pm-project-add')).toContain('Project');
    press('pm-project-add');
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Gantt bar buttons', () => {
  it('Undo: icon only, disabled without steps, asks crud to undo when there are steps', () => {
    const crud = fakeCrud();
    act(() => usePMStore.getState().setUndoInfo(0, null));
    renderUI(<PMGanttUndoButton crud={crud} palette={palette} />);
    expect(textOf('pm-gantt-undo')).not.toContain('Undo'); // no text label
    press('pm-gantt-undo');
    expect(crud.undoGanttAction).not.toHaveBeenCalled();
    act(() => usePMStore.getState().setUndoInfo(2, 'Move "Task 111"'));
    expect(textOf('pm-gantt-undo')).toContain('2');
    press('pm-gantt-undo');
    expect(crud.undoGanttAction).toHaveBeenCalledTimes(1);
  });

  it('Zoom out · Zoom in · Fit to screen (fit right after zoom in)', () => {
    const out = jest.fn();
    const inn = jest.fn();
    const fit = jest.fn();
    renderUI(<PMGanttZoomButtons palette={palette} onZoomOut={out} onZoomIn={inn} onFit={fit} />);
    expectInOrder(['pm-gantt-zoom-out', 'pm-gantt-zoom-in', 'pm-gantt-fit']);
    press('pm-gantt-zoom-out');
    press('pm-gantt-zoom-in');
    press('pm-gantt-fit');
    expect([out, inn, fit].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('Day · Week · Month · Year (Year after Month) set the zoom presets', () => {
    const onZoom = jest.fn();
    renderUI(<PMGanttScaleButtons palette={palette} activeUnit="month" onZoom={onZoom} />);
    expectInOrder(['pm-gantt-scale-day', 'pm-gantt-scale-week', 'pm-gantt-scale-month', 'pm-gantt-scale-year']);
    expect(mustGet('pm-gantt-scale-month').getAttribute('aria-selected')).toBe('true');
    press('pm-gantt-scale-year');
    press('pm-gantt-scale-day');
    expect(onZoom.mock.calls.map((c) => c[0])).toEqual([PM_ZOOM_PRESETS.year, PM_ZOOM_PRESETS.day]);
  });

  it('% · ⚙ settings · Critical path', () => {
    const crud = fakeCrud();
    act(() => usePMStore.getState().setUxuiSettingsOpen(false));
    renderUI(<PMGanttViewToggles crud={crud} palette={palette} />);
    expectInOrder(['pm-gantt-task-progress', 'pm-gantt-uxui-settings', 'pm-gantt-critical']);
    press('pm-gantt-task-progress');
    expect(crud.toggleTaskProgressOnGantt).toHaveBeenCalled();
    press('pm-gantt-critical');
    expect(crud.toggleCriticalPath).toHaveBeenCalled();
    press('pm-gantt-uxui-settings');
    expect(usePMStore.getState().uxuiSettingsOpen).toBe(true);
    const settingsBtn = mustGet('pm-gantt-uxui-settings');
    const criticalBtn = mustGet('pm-gantt-critical');
    expect(settingsBtn.style.width).toBe(`${PM_SETTINGS_BUTTON_WIDTH}px`);
    expect(criticalBtn.style.width).toBe(`${PM_WIDE_ACTION_WIDTH}px`);
    // never shrinks in a crowded toolbar: stays the same size as "+ Project"
    expect(criticalBtn.style.minWidth).toBe(`${PM_WIDE_ACTION_WIDTH}px`);
    expect(criticalBtn.style.flexShrink).toBe('0');
  });
});

describe('PMRowActionButtons', () => {
  it('edit · duplicate · copy info · share · link · details · sql_for_delete call crud with the row', () => {
    const { byName } = seedStore();
    const guid = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    renderUI(<PMRowActionButtons guid={guid} crud={crud} palette={palette} testIDPrefix="row" />);
    expectInOrder([`row-edit-${guid}`, `row-duplicate-${guid}`, `row-copy-info-${guid}`, `row-share-${guid}`, `row-link-${guid}`, `row-open-${guid}`, `row-delete-${guid}`]);
    press(`row-edit-${guid}`);
    press(`row-duplicate-${guid}`);
    expect(crud.duplicateTask).toHaveBeenCalledWith(guid);
    press(`row-copy-info-${guid}`);
    press(`row-share-${guid}`);
    expect(crud.copyTaskInfo).toHaveBeenCalledWith(guid);
    expect(crud.shareTask).toHaveBeenCalledWith(guid);
    press(`row-link-${guid}`);
    press(`row-open-${guid}`);
    press(`row-delete-${guid}`);
    expect(crud.edit).toHaveBeenCalledWith(guid);
    expect(crud.startLink).toHaveBeenCalledWith(guid);
    expect(crud.openInfo).toHaveBeenCalledWith(guid);
    expect(crud.deleteTask).toHaveBeenCalledWith(guid);
  });
});
