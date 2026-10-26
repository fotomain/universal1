/** @jest-environment jsdom */
// Project settings → Gantt: the master switch, and (while it is on) one switch per Extended function, grouped, with the short text and "more…".
import './pmUiTestKit';
import React from 'react';
import { cleanupUI, press, q, qa, renderUI, toggleSwitch } from './pmUiTestKit';

const PMProjectGanttTab = require('../../../kit8/pm/view/project/settings/PMProjectGanttTab').default;
const { ganttValuesOf } = require('../../../kit8/pm/view/project/settings/PMProjectGanttTab');
const { PM_EXTENDED_FEATURES } = require('../../../kit8/pm/extended/extendedModel');

afterEach(() => { cleanupUI(); jest.clearAllMocks(); });

describe('PMProjectGanttTab', () => {
  it('master off: only the master switch, no function switches', () => {
    renderUI(<PMProjectGanttTab values={{}} onChange={jest.fn()} />);
    expect(q('pm-project-gantt-extended')).not.toBeNull();
    expect(qa('pm-project-gantt-gantt')).toEqual([]);
  });

  it('master on: a switch for every function, all off', () => {
    renderUI(<PMProjectGanttTab values={{ ganttExtendedFunctionalityEnabled: true }} onChange={jest.fn()} />);
    expect(qa('pm-project-gantt-gantt').length).toBe(PM_EXTENDED_FEATURES.length);
    expect(q('pm-project-gantt-ganttManualSchedulingEnabled')).not.toBeNull();
  });

  it('a function switch reports its own key; "more…" shows the full text', () => {
    const onChange = jest.fn();
    renderUI(<PMProjectGanttTab values={{ ganttExtendedFunctionalityEnabled: true }} onChange={onChange} />);
    toggleSwitch('pm-project-gantt-ganttDeadlineEnabled');
    expect(onChange).toHaveBeenCalledWith({ ganttDeadlineEnabled: true });
    const before = document.body.textContent!.length;
    press('pm-project-gantt-more-A5');
    expect(document.body.textContent!.length).toBeGreaterThan(before + 40);
  });

  it('a function that needs another one is disabled until it is on', () => {
    expect(ganttValuesOf({}).ganttTrackingBarsEnabled).toBe(false);
    expect(ganttValuesOf({ ganttDeadlineEnabled: true }).ganttDeadlineEnabled).toBe(true);
  });
});
