/** @jest-environment jsdom */
// kit8/pm/view/network: PMNetworkView (radio, read-only mode), PMNetworkDiagram, PMNetworkSchedule.
import { act } from 'react';
import { cleanupUI, fakeCrud, press, q, qa, renderUI, seedStore } from './pmUiTestKit';

import React from 'react';
import PMNetworkView from '../../../kit8/pm/view/network/PMNetworkView';
import { usePMStore } from '../../../kit8/pm/store/store_pm';

const setView = (patch: Parameters<ReturnType<typeof usePMStore.getState>['setNetworkViewSettings']>[0]) =>
  act(() => usePMStore.getState().setNetworkViewSettings(patch));

afterEach(() => {
  cleanupUI();
  jest.clearAllMocks();
  act(() => {
    usePMStore.getState().setSelected(null);
    usePMStore.getState().setHovered(null);
    usePMStore.getState().setNetworkViewSettings({ ganttVsNetworkView: 'showGanttChart', networkViewMode: 'networkDiagram', networkDiagramVariant: 'cpmNodes', networkScheduleVariant: 'eventCircles' });
  });
});

describe('PMNetworkView (editable)', () => {
  it('toolbar: Gantt | Network, radio, critical path; switches go through crud (saved per project)', () => {
    seedStore();
    setView({ ganttVsNetworkView: 'showNetworkView' });
    const crud = fakeCrud();
    renderUI(<PMNetworkView crud={crud} />);
    expect(q('pm-net-view')).not.toBeNull();
    expect(q('pm-net-readonly-badge')).toBeNull();
    press('pm-gantt-vs-network-showGanttChart');
    expect(crud.setGanttVsNetworkView).toHaveBeenCalledWith('showGanttChart');
    press('pm-net-mode-networkSchedule');
    expect(crud.setNetworkViewMode).toHaveBeenCalledWith('networkSchedule');
    press('pm-net-diagram-variant-compactNodes');
    expect(crud.setNetworkDiagramVariant).toHaveBeenCalledWith('compactNodes');
    press('pm-net-critical');
    expect(crud.toggleCriticalPath).toHaveBeenCalled();
  });

  it('diagram: one node per task / milestone, tap = select + CRUD panel', () => {
    const { byName } = seedStore();
    const crud = fakeCrud();
    renderUI(<PMNetworkView crud={crud} />);
    const s = usePMStore.getState();
    const leaves = s.tasks.filter((t) => !(s.tree.childrenById[t.rowGUID]?.length) && t.rowJSON.rowKind !== 'stage');
    expect(qa('pm-net-node-').filter((id) => /^pm-net-node-[0-9a-f-]{36}$/.test(id))).toHaveLength(leaves.length);
    const guid = byName('Task 111').rowGUID;
    press(`pm-net-node-${guid}`);
    expect(usePMStore.getState().selectedGUID).toBe(guid);
    expect(q('pm-net-node-panel')).not.toBeNull();
    expect(q('pm-net-info')).not.toBeNull();
    press(`pm-net-node-edit-${guid}`);
    expect(crud.edit).toHaveBeenCalledWith(guid);
    press(`pm-net-node-delete-${guid}`);
    expect(crud.deleteTask).toHaveBeenCalledWith(guid);
  });

  it('tap-to-link: the next tapped node becomes the successor', () => {
    const { byName } = seedStore();
    const crud = fakeCrud();
    const a = byName('Task 111').rowGUID;
    const b = byName('Task 112').rowGUID;
    act(() => usePMStore.getState().setLinkSource(a));
    renderUI(<PMNetworkView crud={crud} />);
    expect(document.body.textContent).toContain('Tap the task that must wait for');
    press(`pm-net-node-${b}`);
    expect(crud.link).toHaveBeenCalledWith(a, b);
    act(() => usePMStore.getState().setLinkSource(null));
  });

  it('schedule: event circles numbered 1..n, arrow labels select tasks', () => {
    const { byName } = seedStore();
    setView({ networkViewMode: 'networkSchedule' });
    const crud = fakeCrud();
    renderUI(<PMNetworkView crud={crud} />);
    expect(q('pm-net-schedule')).not.toBeNull();
    const events = qa('pm-net-event-');
    expect(events[0]).toBe('pm-net-event-1');
    const guid = byName('Task 111').rowGUID;
    press(`pm-net-arrow-${guid}`);
    expect(usePMStore.getState().selectedGUID).toBe(guid);
    expect(q('pm-net-node-panel')).not.toBeNull();
    // time-scaled variant renders the same events
    setView({ networkScheduleVariant: 'timeScaled' });
    expect(qa('pm-net-event-')).toHaveLength(events.length);
  });
});

describe('PMNetworkView readOnly', () => {
  it('no CRUD panel, no editing; switches stay local', () => {
    const { byName } = seedStore();
    const crud = fakeCrud();
    renderUI(<PMNetworkView crud={crud} readOnly />);
    expect(q('pm-net-view-readonly')).not.toBeNull();
    expect(q('pm-net-readonly-badge')).not.toBeNull();
    const guid = byName('Task 111').rowGUID;
    press(`pm-net-node-${guid}`);
    press(`pm-net-node-${guid}`); // double tap would edit in editable mode
    expect(usePMStore.getState().selectedGUID).toBe(guid);
    expect(q('pm-net-info')).not.toBeNull(); // read-only info card
    expect(q('pm-net-node-panel')).toBeNull();
    expect(crud.edit).not.toHaveBeenCalled();
    press('pm-net-mode-networkSchedule');
    expect(crud.setNetworkViewMode).not.toHaveBeenCalled();
    expect(usePMStore.getState().networkViewMode).toBe('networkSchedule');
    press(`pm-net-arrow-${guid}`);
    expect(q('pm-net-node-panel')).toBeNull();
  });

  it('without crud the view is read-only too', () => {
    seedStore();
    renderUI(<PMNetworkView />);
    expect(q('pm-net-view-readonly')).not.toBeNull();
  });
});
