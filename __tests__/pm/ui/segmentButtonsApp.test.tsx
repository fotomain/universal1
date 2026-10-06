/** @jest-environment jsdom */
// kit8/ui/components/common/SegmentButtonsApp + its use in PMTaskEditModal (Stage | Task | Milestone).
import { cleanupUI, mustGet, press, renderUI, textOf } from './pmUiTestKit';
import React from 'react';
import SegmentButtonsApp from '../../../kit8/ui/components/common/SegmentButtonsApp';

afterEach(() => cleanupUI());

describe('SegmentButtonsApp', () => {
  const buttons = [
    { value: 'stage', label: 'Stage' },
    { value: 'task', label: 'Task', icon: 'check' },
    { value: 'milestone', label: 'Milestone', disabled: true },
  ];

  it('shows the segments in order, marks the selected one and reports a new choice', () => {
    const onValueChange = jest.fn();
    renderUI(<SegmentButtonsApp testID="seg" value="task" onValueChange={onValueChange} buttons={buttons} />);
    const group = mustGet('seg');
    expect(Array.from(group.children).map((e) => e.getAttribute('data-testid'))).toEqual(['seg-stage', 'seg-task', 'seg-milestone']);
    expect(textOf('seg-stage')).toContain('Stage');
    expect(mustGet('seg-task').getAttribute('aria-checked')).toBe('true');
    expect(mustGet('seg-stage').getAttribute('aria-checked')).toBe('false');
    press('seg-stage');
    expect(onValueChange).toHaveBeenCalledWith('stage');
    press('seg-task'); // already selected: nothing
    expect(onValueChange).toHaveBeenCalledTimes(1);
    // equal width segments
    expect(mustGet('seg-stage').style.flexGrow).toBe(mustGet('seg-milestone').style.flexGrow);
  });

  it('a disabled segment cannot be chosen; custom testIDs are kept', () => {
    const onValueChange = jest.fn();
    renderUI(<SegmentButtonsApp value="stage" onValueChange={onValueChange} buttons={[...buttons.slice(0, 2), { ...buttons[2], testID: 'my-milestone' }]} />);
    expect(mustGet('my-milestone').getAttribute('aria-disabled')).toBe('true');
    press('my-milestone');
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
