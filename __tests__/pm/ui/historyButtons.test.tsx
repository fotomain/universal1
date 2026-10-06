/** @jest-environment jsdom */
// Undo / Redo buttons: right-click (web) or long touch opens a menu with "Clear undo / redo history".
import { act } from 'react';
import { cleanupUI, fakeCrud, mustGet, press, q, renderUI, seedStore, textOf } from './pmUiTestKit';
import React from 'react';
import PMGanttUndoButton from '../../../kit8/pm/view/gantt/buttons/PMGanttUndoButton';
import PMGanttRedoButton from '../../../kit8/pm/view/gantt/buttons/PMGanttRedoButton';
import { usePMStore } from '../../../kit8/pm/store/store_pm';
import { makePMPalette } from '../../../kit8/pm/view/theme';

const palette = makePMPalette({ primary: '#6366f1', background: '#fff', surface: '#f8fafc', text: '#0f172a', border: '#cbd5e1', error: '#dc2626' }, false);
afterEach(() => cleanupUI());
const rightClick = (testID: string) =>
  act(() => {
    mustGet(testID).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }));
  });

describe.each([
  ['undo', PMGanttUndoButton, 'clearUndo', 'Clear undo history'],
  ['redo', PMGanttRedoButton, 'clearRedo', 'Clear redo history'],
] as const)('%s button menu', (kind, Button, command, label) => {
  const setCount = (n: number) => act(() => (kind === 'undo' ? usePMStore.getState().setUndoInfo(n, n ? 'Add task' : null) : usePMStore.getState().setRedoInfo(n, n ? 'Add task' : null)));

  it('right-click opens the menu; the item calls the clear command and closes the menu', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<Button crud={crud} palette={palette} />);
    setCount(3);
    expect(q(`pm-gantt-${kind}-menu`)).toBeNull();
    rightClick(`pm-gantt-${kind}`);
    expect(q(`pm-gantt-${kind}-menu`)).not.toBeNull();
    expect(textOf(`pm-gantt-${kind}-clear`)).toContain(label);
    expect(textOf(`pm-gantt-${kind}-menu`)).toContain('3');
    press(`pm-gantt-${kind}-clear`);
    expect(crud[command]).toHaveBeenCalledTimes(1);
    expect(q(`pm-gantt-${kind}-menu`)).toBeNull();
    // the right-click itself does not undo / redo
    expect(crud[kind === 'undo' ? 'undoGanttAction' : 'redoGanttAction']).not.toHaveBeenCalled();
  });

  it('with no steps the menu still opens but the item is disabled; the backdrop closes it', () => {
    seedStore();
    const crud = fakeCrud();
    renderUI(<Button crud={crud} palette={palette} />);
    setCount(0);
    // a disabled button lets the pointer through: the right-click lands on its wrapper
    rightClick(`pm-gantt-${kind}-anchor`);
    press(`pm-gantt-${kind}-clear`);
    expect(crud[command]).not.toHaveBeenCalled();
    press(`pm-gantt-${kind}-menu-backdrop`);
    expect(q(`pm-gantt-${kind}-menu`)).toBeNull();
  });
});
