/** @jest-environment jsdom */
// The BIM button of the view switch: the LAST one, only while the selected project is BIM based; a saved BIM view of a project that is not BIM based shows the Gantt as active.
import React, { act } from 'react';
import { cleanupUI, press, q, renderUI, seedStore } from '../pm/ui/pmUiTestKit';

jest.mock('../../kit8/providers/WithDesignSystem', () => ({
  useDesignSystem: () => ({ activeSystem: 'native', isDark: false, themeColors: { primary: '#6366f1', background: '#fff', surface: '#fff', text: '#000', border: '#ccc', error: '#d00' } }),
}));
jest.mock('../../kit8/ui/components/common/IconApp', () => ({ __esModule: true, default: ({ name, testID }: any) => require('react').createElement(require('react-native').Text, { testID }, name) }));

import GanttToggleButtons from '../../kit8/pm/view/gantt/toolbars/GanttToggleButtons';
import { makePMPalette } from '../../kit8/pm/view/theme';
import { usePMStore } from '../../kit8/pm/store/store_pm';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
const project = (json: any) => ({ rowGUID: 'p1', treePath: 'p1', rowOwnerGUID: 'u', rowDuration: null, rowProgress: 0, orderInList: 1, rowJSON: { rowKind: 'project', name: 'P', ...json } });
const ids = () => Array.from(document.querySelectorAll('[data-testid^="pm-gantt-vs-network-show"]')).map((e: any) => e.getAttribute('data-testid').replace('pm-gantt-vs-network-', '')).filter((x: string) => !x.endsWith('-icon') && !x.endsWith('-label'));

afterEach(() => { cleanupUI(); act(() => usePMStore.setState({ selectedProjectGUID: null, projectsById: {}, ganttVsNetworkView: 'showGanttChart' } as any)); });

describe('the BIM button', () => {
  it('a plain project: no BIM button, Budgets is the last', () => {
    seedStore();
    act(() => usePMStore.setState({ selectedProjectGUID: 'p1', projectsById: { p1: project({}) } } as any));
    renderUI(<GanttToggleButtons palette={palette} onChange={jest.fn()} />);
    expect(ids().at(-1)).toBe('showPlanView');
    expect(ids()).not.toContain('showBimView');
  });

  it('a BIM based project: the BIM button is the LAST one and works', () => {
    seedStore();
    act(() => usePMStore.setState({ selectedProjectGUID: 'p1', projectsById: { p1: project({ projectIsBIMBased: true }) } } as any));
    const onChange = jest.fn();
    renderUI(<GanttToggleButtons palette={palette} onChange={onChange} />);
    expect(ids().at(-1)).toBe('showBimView');
    expect(ids().at(-2)).toBe('showPlanView');
    press('pm-gantt-vs-network-showBimView');
    expect(onChange).toHaveBeenCalledWith('showBimView');
  });

  it('the user cannot put another button after BIM (the saved order is ignored for the last place)', () => {
    seedStore();
    act(() => usePMStore.setState({ selectedProjectGUID: 'p1', projectsById: { p1: project({ projectIsBIMBased: true }) }, viewButtonsOrder: ['showBimView', 'showGanttChart'] } as any));
    renderUI(<GanttToggleButtons palette={palette} onChange={jest.fn()} />);
    expect(ids().at(-1)).toBe('showBimView');
    expect(q('pm-gantt-vs-network')).not.toBeNull();
  });

  it('a saved BIM view of a project that is not BIM based: the Gantt button is the active one', () => {
    seedStore();
    act(() => usePMStore.setState({ selectedProjectGUID: 'p1', projectsById: { p1: project({}) }, ganttVsNetworkView: 'showBimView' } as any));
    renderUI(<GanttToggleButtons palette={palette} onChange={jest.fn()} />);
    const gantt = document.querySelector('[data-testid="pm-gantt-vs-network-showGanttChart"]') as any;
    expect(gantt).not.toBeNull();
    expect(ids()).not.toContain('showBimView');
  });
});
