/** @jest-environment jsdom */
// EditTaskDescriptionFast: the name of a task typed over in a flat TextInputApp - Enter / leaving saves (once), Escape and an empty name restore, external changes follow, only the name is written.
import React, { act } from 'react';
import { cleanupUI, fakeCrud, inputValue, q, renderUI, seedStore } from './pmUiTestKit';

// the kit's TextInputApp double forwards only the value: this one forwards what the editor uses
let lastProps: any = {};
jest.doMock('../../../kit8/ui/components/common/TextInputApp', () => {
  const R = require('react');
  const { TextInput } = require('react-native');
  const TextInputApp = (props: any) => { lastProps = props; return R.createElement(TextInput, { testID: props.testID, value: props.value, placeholder: props.placeholder, onChangeText: props.onChangeText, onFocus: props.onFocus, onBlur: props.onBlur, onSubmitEditing: props.onSubmitEditing, onKeyPress: props.onKeyPress, accessibilityLabel: props.label }); };
  return { __esModule: true, default: TextInputApp, TextInputApp };
});
const { default: EditTaskDescriptionFast, nameToSave, TASK_NAME_MAX } = require('../../../kit8/pm/view/task/EditTaskDescriptionFast');
const { usePMStore } = require('../../../kit8/pm/store/store_pm');

const ID = 'pm-task-name-input';
const input = () => q(ID) as HTMLInputElement;
const type = (text: string) => act(() => { lastProps.onChangeText(text); });
const focus = () => act(() => { lastProps.onFocus(); });
const blur = () => act(() => { lastProps.onBlur(); });
const enter = () => act(() => { lastProps.onSubmitEditing(); });
const key = (k: string) => act(() => { lastProps.onKeyPress({ nativeEvent: { key: k } }); });
const rename = (guid: string, name: string) => act(() => usePMStore.setState((s: any) => ({ tasksById: { ...s.tasksById, [guid]: { ...s.tasksById[guid], rowJSON: { ...s.tasksById[guid].rowJSON, taskDescription: name } } } })));

afterEach(() => { cleanupUI(); jest.clearAllMocks(); lastProps = {}; });

function mount(over: Record<string, any> = {}) {
  const { byName } = seedStore();
  const task = byName('Task 111');
  const crud = fakeCrud();
  renderUI(<EditTaskDescriptionFast guid={task.rowGUID} crud={crud} testID="pm-task-name" {...over} />);
  return { task, crud };
}

describe('the field', () => {
  it('is a FLAT TextInputApp with the name as value and "Task name" as the placeholder; a label is passed on', () => {
    mount({ label: 'Name' });
    expect(lastProps.mode).toBe('flat');
    expect(lastProps.placeholder).toBe('Task name');
    expect(lastProps.label).toBe('Name');
    expect(lastProps.selectTextOnFocus).toBe(true);
    expect(inputValue(ID)).toBe('Task 111');
  });
  it('without a label there is none (the placeholder works alone)', () => {
    mount();
    expect(lastProps.label).toBeUndefined();
  });
  it('a task that does not exist: nothing is drawn', () => {
    seedStore();
    renderUI(<EditTaskDescriptionFast guid="nope" crud={fakeCrud()} testID="pm-task-name" />);
    expect(q('pm-task-name')).toBeNull();
  });
});

describe('saving', () => {
  it('leaving the field saves the new name: the whole rowJSON is kept, only the name changes, one undo label', () => {
    const { task, crud } = mount();
    focus(); type('  Foundation works  '); blur();
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
    const [guid, patch, label] = crud.updateTask.mock.calls[0];
    expect(guid).toBe(task.rowGUID);
    expect(patch.rowJSON).toEqual({ ...task.rowJSON, taskDescription: 'Foundation works' });
    expect(label).toBe('Rename task');
    expect(inputValue(ID)).toBe('Foundation works');                   // trimmed in the field too
  });
  it('Enter saves, and leaving the field afterwards does not save the same name again', () => {
    const { crud } = mount();
    focus(); type('Walls'); enter(); blur();
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
  });
  it('an unchanged name (or only spaces added) is not saved', () => {
    const { crud } = mount();
    focus(); type('Task 111  '); blur();
    expect(crud.updateTask).not.toHaveBeenCalled();
  });
  it('an EMPTY name is never saved: the old name comes back', () => {
    const { crud } = mount();
    focus(); type('   '); blur();
    expect(crud.updateTask).not.toHaveBeenCalled();
    expect(inputValue(ID)).toBe('Task 111');
  });
  it('while the field is empty the placeholder is what the user sees (the value is "")', () => {
    mount();
    focus(); type('');
    expect(inputValue(ID)).toBe('');
    expect(input().placeholder).toBe('Task name');
  });
  it('Escape puts the old name back; leaving the field then saves nothing', () => {
    const { crud } = mount();
    focus(); type('Something else'); key('Escape');
    expect(inputValue(ID)).toBe('Task 111');
    blur();
    expect(crud.updateTask).not.toHaveBeenCalled();
  });
  it('another key does not revert', () => {
    mount();
    focus(); type('Abc'); key('a');
    expect(inputValue(ID)).toBe('Abc');
  });
  it('the name is cut at TASK_NAME_MAX', () => {
    const { crud } = mount();
    focus(); type('x'.repeat(TASK_NAME_MAX + 50)); blur();
    expect(crud.updateTask.mock.calls[0][1].rowJSON.taskDescription).toHaveLength(TASK_NAME_MAX);
  });
});

describe('the name changed elsewhere', () => {
  it('follows at once while the user is not typing', () => {
    const { task } = mount();
    rename(task.rowGUID, 'Renamed in the tree');
    expect(inputValue(ID)).toBe('Renamed in the tree');
  });
  it('does not overwrite what the user is typing', () => {
    const { task } = mount();
    focus(); type('My draft');
    rename(task.rowGUID, 'Renamed in the tree');
    expect(inputValue(ID)).toBe('My draft');
  });
  it('after the store shows the saved name the next edit can save again', () => {
    const { task, crud } = mount();
    focus(); type('One'); blur();
    rename(task.rowGUID, 'One');
    focus(); type('Two'); blur();
    expect(crud.updateTask).toHaveBeenCalledTimes(2);
    expect(crud.updateTask.mock.calls[1][1].rowJSON.taskDescription).toBe('Two');
  });
});

describe('nameToSave (pure)', () => {
  it.each([
    ['New', 'Old', 'New'],
    ['  New  ', 'Old', 'New'],
    ['Old', 'Old', null],
    ['  Old ', 'Old', null],
    ['', 'Old', null],
    ['   ', 'Old', null],
  ])('"%s" over "%s" = %s', (draft, current, expected) => {
    expect(nameToSave(draft as string, current as string)).toBe(expected);
  });
  it('is cut at the maximum', () => {
    expect(nameToSave('y'.repeat(TASK_NAME_MAX + 1), 'Old')).toHaveLength(TASK_NAME_MAX);
  });
});

describe('the Clear icon at the left', () => {
  const clearBtn = () => q('pm-task-name-clear');
  const pressClear = () => act(() => { clearBtn()!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); });
  it('is not there until the user starts editing; it is shown at the left while the field is focused; it goes when the field is left', () => {
    mount();
    expect(clearBtn()).toBeNull();
    focus();
    expect(clearBtn()).not.toBeNull();
    blur();
    expect(clearBtn()).toBeNull();
  });
  it('it comes BEFORE the field (at the left)', () => {
    mount();
    focus();
    const box = q('pm-task-name')!;
    expect(box.firstElementChild).toBe(clearBtn());
  });
  it('the field itself has no clear icon of its own (hideClearIcon): one Clear only', () => {
    mount();
    expect(lastProps.hideClearIcon).toBe(true);
  });
  it('pressing it empties the text and keeps editing; nothing is saved while the text is empty; leaving then puts the old name back', () => {
    const { crud } = mount();
    focus(); type('Foundation');
    pressClear();
    expect(inputValue(ID)).toBe('');
    blur();                                   // the blur caused by the press itself
    expect(clearBtn()).not.toBeNull();        // still editing
    expect(crud.updateTask).not.toHaveBeenCalled();
    blur();                                   // the user leaves the field
    expect(crud.updateTask).not.toHaveBeenCalled();
    expect(inputValue(ID)).toBe('Task 111');
    expect(clearBtn()).toBeNull();
  });
  it('after Clear the user types a new name and leaves: it is saved', () => {
    const { crud } = mount();
    focus(); pressClear(); blur(); focus(); type('New name'); blur();
    expect(crud.updateTask).toHaveBeenCalledTimes(1);
  });
});
