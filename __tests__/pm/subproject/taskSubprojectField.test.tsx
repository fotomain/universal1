/** @jest-environment jsdom */
// The "Subproject" part of the task window: the flag, and with it on the picker of the project.
import { cleanupUI, q, renderUI, toggleSwitch } from '../ui/pmUiTestKit';
import PMTaskSubprojectField from '../../../kit8/pm/view/task/PMTaskSubprojectField';

afterEach(cleanupUI);
const cand = [
  { projectGUID: 'pb', projectName: 'Project B', startAt: null, finishAt: null, usedByCount: 2 },
  { projectGUID: 'pc', projectName: 'Project C', startAt: null, finishAt: null, usedByCount: 0 },
];
const base = { onFlag: jest.fn(), onSubproject: jest.fn(), candidates: cand, followsDates: true };

it('the flag off: only the switch is shown', () => {
  renderUI(<PMTaskSubprojectField {...base} flag={false} subprojectGUID="" />);
  expect(q('pm-edit-subproject-flag')).not.toBeNull();
  expect(q('pm-edit-subproject-project')).toBeNull();
});

it('the switch reports the new value', () => {
  const onFlag = jest.fn();
  renderUI(<PMTaskSubprojectField {...base} onFlag={onFlag} flag={false} subprojectGUID="" />);
  toggleSwitch('pm-edit-subproject-flag');
  expect(onFlag).toHaveBeenLastCalledWith(true);
});

it('the flag on: the picker is shown; with a subproject chosen and the dates switch on, the hint says the dates come from it', () => {
  renderUI(<PMTaskSubprojectField {...base} flag subprojectGUID="" />);
  expect(q('pm-edit-subproject-project')).not.toBeNull();
  expect(q('pm-edit-subproject-follows')).toBeNull();
  cleanupUI();
  renderUI(<PMTaskSubprojectField {...base} flag subprojectGUID="pb" />);
  expect(q('pm-edit-subproject-follows')).not.toBeNull();
  cleanupUI();
  renderUI(<PMTaskSubprojectField {...base} flag subprojectGUID="pb" followsDates={false} />);
  expect(q('pm-edit-subproject-follows')).toBeNull();
});

it('an error of the list is shown', () => {
  renderUI(<PMTaskSubprojectField {...base} flag subprojectGUID="" error="no list" />);
  expect(q('pm-edit-subproject-error')!.textContent).toBe('no list');
});
