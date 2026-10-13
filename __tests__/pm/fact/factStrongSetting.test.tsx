/** @jest-environment jsdom */
// Project settings → Budgets → Main: the switch factStrongInputByTaskLine (false by default).
import { cleanupUI, q, renderUI, toggleSwitch } from '../ui/pmUiTestKit';
import PMProjectBudgetsTab, { budgetsValuesOf } from '../../../kit8/pm/view/project/settings/PMProjectBudgetsTab';

afterEach(cleanupUI);

it('is false by default - also for a project that never had the key', () => {
  expect(budgetsValuesOf(null).factStrongInputByTaskLine).toBe(false);
  expect(budgetsValuesOf({}).factStrongInputByTaskLine).toBe(false);
  expect(budgetsValuesOf({ factStrongInputByTaskLine: true }).factStrongInputByTaskLine).toBe(true);
});

it('the switch changes only that key', () => {
  const onChange = jest.fn();
  renderUI(<PMProjectBudgetsTab values={budgetsValuesOf(null)} onChange={onChange} />);
  expect(q('pm-project-fact-strong-input')).not.toBeNull();
  toggleSwitch('pm-project-fact-strong-input');
  expect(onChange).toHaveBeenCalledWith({ factStrongInputByTaskLine: true });
});

it('shows the saved value', () => {
  renderUI(<PMProjectBudgetsTab values={budgetsValuesOf({ factStrongInputByTaskLine: true })} onChange={jest.fn()} />);
  const input = q('pm-project-fact-strong-input')!.querySelector('input') as HTMLInputElement;
  expect(input.checked).toBe(true);
});
