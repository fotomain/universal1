/** @jest-environment jsdom */
// kit8/pm/progress/line settings UI + kit8/pm/tree/inline cell editors (Days / Start / %).
import { act } from 'react';
import { cleanupUI, expectInOrder, fakeCrud, inputValue, press, pressKey, q, renderUI, seedStore, typeInto } from './pmUiTestKit';
import React from 'react';
import PMProgressLineSettings from '../../../kit8/pm/progress/line/PMProgressLineSettings';
import PMColorSwatchPicker from '../../../kit8/pm/progress/line/PMColorSwatchPicker';
import PMProgressLinePositionSelector from '../../../kit8/pm/progress/line/PMProgressLinePositionSelector';
import { PM_PROGRESS_LINE_SWATCHES } from '../../../kit8/pm/progress/line/progressLineConstants';
import EditTaskDays from '../../../kit8/pm/tree/inline/EditTaskDays';
import EditTaskStart from '../../../kit8/pm/tree/inline/EditTaskStart';
import EditTaskProgress from '../../../kit8/pm/tree/inline/EditTaskProgress';
import { usePMStore } from '../../../kit8/pm/store';

const colors = { text: '#000', border: '#ccc', background: '#fff', primary: '#6366f1', error: '#f00' };

afterEach(cleanupUI);

describe('progress/line settings', () => {
  it('position selector: On top · Middle · On bottom', () => {
    const onChange = jest.fn();
    renderUI(<PMProgressLinePositionSelector testID="pos" value="onTop" onChange={onChange} colors={colors} />);
    expectInOrder(['pos-onTop', 'pos-atTheMiddle', 'pos-onBottom']);
    press('pos-onBottom');
    expect(onChange).toHaveBeenCalledWith('onBottom');
  });

  it('color swatches: Default + every swatch', () => {
    const onChange = jest.fn();
    renderUI(<PMColorSwatchPicker testID="col" value={null} onChange={onChange} defaultColor="yellow" colors={colors} />);
    expect(q('col-default')).not.toBeNull();
    for (const c of PM_PROGRESS_LINE_SWATCHES) expect(q(`col-${c}`)).not.toBeNull();
    press('col-#22c55e');
    press('col-default');
    expect(onChange.mock.calls).toEqual([['#22c55e'], [null]]);
  });

  it('PMProgressLineSettings: title, -pos / -color pickers, Default = yellow', () => {
    const onPosition = jest.fn();
    const onColor = jest.fn();
    renderUI(
      <PMProgressLineSettings testID="tl" title="Task progress line" positionLabel="Position" position="atTheMiddle" onPosition={onPosition} color="#22c55e" onColor={onColor} previewBarColor="#6366f1" colors={colors} />
    );
    expect(document.body.textContent).toContain('Task progress line');
    press('tl-pos-onTop');
    press('tl-color-default');
    press('tl-color-#ef4444');
    expect(onPosition).toHaveBeenCalledWith('onTop');
    expect(onColor.mock.calls).toEqual([['yellow'], ['#ef4444']]);
  });
});

describe('inline cell editors (tree Days / Start / %)', () => {
  const scrollY = { value: 0 } as any;
  const base = (guid: string, crud: any) => ({ guid, rowIndex: 1, x: 0, width: 80, scrollY, crud, colors });

  it('Days: Enter commits a valid value, 0 keeps the editor open, Esc cancels', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'days' } as any));
    renderUI(<EditTaskDays {...base(g, crud)} />);
    const id = `pm-tree-edit-days-${g}`;
    expect(Number(inputValue(id))).toBeGreaterThanOrEqual(1);
    typeInto(id, '0');
    pressKey(id, 'Enter');
    expect(crud.setDurationDays).not.toHaveBeenCalled();
    typeInto(id, '5x');
    expect(inputValue(id)).toBe('5'); // digits only
    pressKey(id, 'Enter');
    expect(crud.setDurationDays).toHaveBeenCalledWith(g, 5);
    expect(usePMStore.getState().cellEdit).toBeNull();
  });

  it('Days: Escape cancels without saving', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    act(() => usePMStore.getState().setCellEdit({ guid: g, field: 'days' } as any));
    renderUI(<EditTaskDays {...base(g, crud)} />);
    typeInto(`pm-tree-edit-days-${g}`, '9');
    pressKey(`pm-tree-edit-days-${g}`, 'Escape');
    expect(crud.setDurationDays).not.toHaveBeenCalled();
    expect(usePMStore.getState().cellEdit).toBeNull();
  });

  it('Start: YYYY-MM-DD sets the constraint, empty = ASAP', () => {
    const { byName } = seedStore();
    const g = byName('Task 112').rowGUID;
    const crud = fakeCrud();
    renderUI(<EditTaskStart {...base(g, crud)} />);
    const id = `pm-tree-edit-start-${g}`;
    expect(inputValue(id)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    typeInto(id, '2026-10-12');
    pressKey(id, 'Enter');
    expect(crud.setStartConstraint).toHaveBeenCalledWith(g, Date.UTC(2026, 9, 12));
    cleanupUI();
    renderUI(<EditTaskStart {...base(g, crud)} />);
    typeInto(id, '');
    pressKey(id, 'Enter');
    expect(crud.setStartConstraint).toHaveBeenLastCalledWith(g, null);
  });

  it('%: 0..100 only', () => {
    const { byName } = seedStore();
    const g = byName('Task 111').rowGUID;
    const crud = fakeCrud();
    renderUI(<EditTaskProgress {...base(g, crud)} />);
    const id = `pm-tree-edit-progress-${g}`;
    typeInto(id, '150');
    pressKey(id, 'Enter');
    expect(crud.setProgress).not.toHaveBeenCalled();
    typeInto(id, '75');
    pressKey(id, 'Enter');
    expect(crud.setProgress).toHaveBeenCalledWith(g, 75);
  });
});
