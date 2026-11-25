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

it("trigger 'textInput': the field is a read only TextInputApp with the selected label; a press on it opens the list and a pick selects", async () => {
  const onSelect = jest.fn();
  renderUI(<SelectItemFromListApp testID="s" trigger="textInput" label="Mode" items={items} value="a" onSelect={onSelect} />);
  expect(q('s-input')).not.toBeNull();
  press('s-trigger');
  expect(q('s-list')).not.toBeNull();
  press('s-item-b');
  expect(onSelect).toHaveBeenCalledWith('b');
});

it("trigger 'textInput' with inputLeftIcons: the icons go INTO the field, and the list opens from the rest of the field (not from the icon)", () => {
  const onIcon = jest.fn();
  renderUI(<SelectItemFromListApp testID="s" trigger="textInput" label="Mode" items={items} value="a" onSelect={jest.fn()} inputLeftIcons={[{ icon: 'history', testID: 's-hist', onPress: onIcon }]} />);
  expect(q('s-input')).not.toBeNull();
  const trigger = q('s-trigger')!;
  // the opening area starts right of the icon (a plain pressable over the whole field would swallow the icon press)
  expect(trigger.style.left).toBe('48px');
});
