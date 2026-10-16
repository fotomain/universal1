/** @jest-environment jsdom */
// The subproject icon of the task tree: the icon, the warning sign while the dates differ, the tip as the accessible name.
import { cleanupUI, q, renderUI } from '../ui/pmUiTestKit';
import PMTreeSubprojectIcon, { PM_TREE_SUBPROJECT_WIDTH } from '../../../kit8/pm/view/tree/columns/PMTreeSubprojectIcon';

afterEach(cleanupUI);
const mark = (conflict: boolean) => ({ subprojectGUID: 'pb', name: 'Project B', conflict, tip: conflict ? 'Subproject: Project B - the dates of this task differ from the subproject' : 'Subproject: Project B' });

it('the normal icon is the subproject icon; its name for accessibility is the tip', () => {
  renderUI(<PMTreeSubprojectIcon testID="sp" mark={mark(false)} height={24} color="#123456" />);
  expect(q('sp')!.textContent).toContain('account_tree');
  expect(q('sp')!.getAttribute('aria-label')).toBe('Subproject: Project B');
});

it('a conflict shows the warning icon and says so', () => {
  renderUI(<PMTreeSubprojectIcon testID="sp" mark={mark(true)} height={24} color="#123456" />);
  expect(q('sp')!.textContent).toContain('warning');
  expect(q('sp')!.getAttribute('aria-label')).toContain('the dates of this task differ');
});

it('the column is narrow', () => expect(PM_TREE_SUBPROJECT_WIDTH).toBeLessThanOrEqual(26));
