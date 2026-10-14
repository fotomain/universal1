/** @jest-environment jsdom */
// SelectItemFromListApp `clearable`: a clear (x) icon INSIDE the field while an item is selected; it calls onSelect(clearValue). Not for the link trigger / a disabled field / nothing selected.
import { cleanupUI, press, q, renderUI } from '../pm/ui/pmUiTestKit';
import SelectItemFromListApp from '../../kit8/ui/components/common/SelectItemFromListApp';

const items = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];
afterEach(() => cleanupUI());

it('shows the clear icon only for a selected item, and clears with the empty value', () => {
  const onSelect = jest.fn();
  renderUI(<SelectItemFromListApp testID="s" items={items} value="a" onSelect={onSelect} placeholder="Project" clearable />);
  expect(q('s-trigger')!.textContent).toContain('Alpha');
  press('s-clear');
  expect(onSelect).toHaveBeenCalledWith('');
});
it('nothing selected: the placeholder is shown and there is no clear icon', () => {
  renderUI(<SelectItemFromListApp testID="s" items={items} value="" onSelect={jest.fn()} placeholder="Project" clearable />);
  expect(q('s-trigger')!.textContent).toContain('Project');
  expect(q('s-clear')).toBeNull();
});
it('not clearable by default; not when disabled; a custom clearValue', () => {
  renderUI(<SelectItemFromListApp testID="s" items={items} value="a" onSelect={jest.fn()} />);
  expect(q('s-clear')).toBeNull();
  cleanupUI();
  renderUI(<SelectItemFromListApp testID="s" items={items} value="a" onSelect={jest.fn()} clearable disabled />);
  expect(q('s-clear')).toBeNull();
  cleanupUI();
  const onSelect = jest.fn();
  renderUI(<SelectItemFromListApp testID="s" items={items} value="b" onSelect={onSelect} clearable clearValue="a" />);
  press('s-clear');
  expect(onSelect).toHaveBeenCalledWith('a');
});
