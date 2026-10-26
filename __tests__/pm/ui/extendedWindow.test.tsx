/** @jest-environment jsdom */
// PMExtendedWindow: the "Extended" window of the Gantt bar - a switch per function, short text, "more…", Save writes the keys into the project.
import './pmUiTestKit';
import React, { act } from 'react';
import { cleanupUI, fakeCrud, press, q, qa, renderUI, seedStore, toggleSwitch } from './pmUiTestKit';

const PMExtendedWindow = require('../../../kit8/pm/extended/PMExtendedWindow').default;
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

afterEach(() => { cleanupUI(); jest.clearAllMocks(); act(() => usePMStore.getState().setExtendedOpen(false)); });

function open(master: boolean) {
  seedStore();
  const s = usePMStore.getState();
  const projects = s.projectOrder.map((g: string) => s.projectsById[g]);
  const sel = s.selectedProjectGUID;
  act(() => usePMStore.getState().setProjects(projects.map((p: any) => (p.rowGUID === sel ? { ...p, rowJSON: { ...p.rowJSON, ganttExtendedFunctionalityEnabled: master } } : p))));
  const crud = fakeCrud();
  renderUI(<PMExtendedWindow crud={crud} />);
  act(() => usePMStore.getState().setExtendedOpen(true));
  return crud;
}

describe('PMExtendedWindow', () => {
  it('without the master switch of Project settings → Gantt nothing is drawn', () => {
    open(false);
    expect(q('pm-extended-window')).toBeNull();
  });

  it('shows the groups and a switch with a short text for every function of the group', () => {
    open(true);
    expect(q('pm-extended-window')).not.toBeNull();
    expect(qa('pm-extended-tab-').length).toBeGreaterThanOrEqual(7);
    expect(q('pm-ext-feature-A1')).not.toBeNull();
    expect(q('pm-ext-ganttManualSchedulingEnabled')).not.toBeNull();
    expect(q('pm-ext-more-A1')).not.toBeNull();
  });

  it('"more…" shows the full description', () => {
    open(true);
    const before = q('pm-ext-feature-A1')!.textContent!.length;
    press('pm-ext-more-A1');
    expect(q('pm-ext-feature-A1')!.textContent!.length).toBeGreaterThan(before + 40);
  });

  it('Save writes only the switches the user turned on (and ganttExtendedOptions), then closes', () => {
    const crud = open(true);
    toggleSwitch("pm-ext-ganttManualSchedulingEnabled");
    press('pm-extended-save');
    expect(crud.saveProjectJSON).toHaveBeenCalledTimes(1);
    const patch = crud.saveProjectJSON.mock.calls[0][0];
    expect(patch.ganttManualSchedulingEnabled).toBe(true);
    expect(patch.ganttExtendedOptions).toBeTruthy();
    expect(usePMStore.getState().extendedOpen).toBe(false);
  });

  it('Cancel saves nothing', () => {
    const crud = open(true);
    toggleSwitch("pm-ext-ganttManualSchedulingEnabled");
    press('pm-extended-cancel');
    expect(crud.saveProjectJSON).not.toHaveBeenCalled();
  });
});
