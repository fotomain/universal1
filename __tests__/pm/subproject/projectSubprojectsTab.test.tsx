/** @jest-environment jsdom */
// Project settings -> Subprojects (TabSubprojects): the master switch is OFF by default; the follow switch and its four children are shown only while the switch above them is on.
import { cleanupUI, q, renderUI, toggleSwitch } from '../ui/pmUiTestKit';
import PMProjectSubprojectsTab from '../../../kit8/pm/view/project/settings/PMProjectSubprojectsTab';

afterEach(cleanupUI);
const on = (id: string) => (q(id)!.querySelector('input') as HTMLInputElement).checked;

it('a project without the keys: only the master switch is shown, and it is OFF', () => {
  renderUI(<PMProjectSubprojectsTab values={{}} onChange={jest.fn()} />);
  expect(on('pm-project-subprojects-enabled')).toBe(false);
  expect(q('pm-project-subprojects-more')).toBeNull();
  expect(q('pm-project-subprojects-auto-change')).toBeNull();
});

it('the master switch changes only its own key', () => {
  const onChange = jest.fn();
  renderUI(<PMProjectSubprojectsTab values={{}} onChange={onChange} />);
  toggleSwitch('pm-project-subprojects-enabled');
  expect(onChange).toHaveBeenLastCalledWith({ subprojectsFunctionalityEnabled: true });
});

it('with the master switch on: the follow switch is ON by default, its children are shown: dates ON, Time / Material / Expenses OFF', () => {
  renderUI(<PMProjectSubprojectsTab values={{ subprojectsFunctionalityEnabled: true }} onChange={jest.fn()} />);
  expect(on('pm-project-subprojects-auto-change')).toBe(true);
  expect(on('pm-project-subprojects-dates')).toBe(true);
  expect(on('pm-project-subprojects-aggregate-time')).toBe(false);
  expect(on('pm-project-subprojects-aggregate-material')).toBe(false);
  expect(on('pm-project-subprojects-aggregate-expense')).toBe(false);
});

it.each([
  ['pm-project-subprojects-auto-change', { autoChangeOriginTaskBasedOnSubprojects: false }],
  ['pm-project-subprojects-dates', { autoChangeStartAndFinishDatesForOriginTask: false }],
  ['pm-project-subprojects-aggregate-time', { aggregateTimeFromSubprojectToTheOriginTask: true }],
  ['pm-project-subprojects-aggregate-material', { aggregateMaterialFromSubprojectToTheOriginTask: true }],
  ['pm-project-subprojects-aggregate-expense', { aggregateExpenceFromSubprojectToTheOriginTask: true }],
])('%s changes only its own key', (id, patch) => {
  const onChange = jest.fn();
  renderUI(<PMProjectSubprojectsTab values={{ subprojectsFunctionalityEnabled: true }} onChange={onChange} />);
  toggleSwitch(id);
  expect(onChange).toHaveBeenLastCalledWith(patch);
});

it('the follow switch OFF hides its four children', () => {
  renderUI(<PMProjectSubprojectsTab values={{ subprojectsFunctionalityEnabled: true, autoChangeOriginTaskBasedOnSubprojects: false }} onChange={jest.fn()} />);
  expect(on('pm-project-subprojects-auto-change')).toBe(false);
  expect(q('pm-project-subprojects-children')).toBeNull();
  expect(q('pm-project-subprojects-dates')).toBeNull();
});

it('shows the saved values', () => {
  renderUI(<PMProjectSubprojectsTab values={{ subprojectsFunctionalityEnabled: true, autoChangeStartAndFinishDatesForOriginTask: false, aggregateExpenceFromSubprojectToTheOriginTask: true }} onChange={jest.fn()} />);
  expect(on('pm-project-subprojects-dates')).toBe(false);
  expect(on('pm-project-subprojects-aggregate-expense')).toBe(true);
});
