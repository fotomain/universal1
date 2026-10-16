/** @jest-environment jsdom */
// Monitor01: the radio Projects | Subprojects | All.
import { cleanupUI, press, q, renderUI } from '../ui/pmUiTestKit';
import Monitor01ProjectKindRadio from '../../../kit8/pm/reports/monitor01/Monitor01ProjectKindRadio';

afterEach(cleanupUI);

it('three options, the title of the last is "All"; the selected one is marked', () => {
  renderUI(<Monitor01ProjectKindRadio value="projects" onChange={jest.fn()} />);
  for (const id of ['projects', 'subprojects', 'all']) expect(q(`monitor01-project-kind-${id}`)).not.toBeNull();
  expect(q('monitor01-project-kind-all')!.getAttribute('aria-label')).toBe('All');
  expect(q('monitor01-project-kind-projects')!.getAttribute('aria-label')).toBe('Projects');
  expect(q('monitor01-project-kind-subprojects')!.getAttribute('aria-label')).toBe('Subprojects');
  expect(q('monitor01-project-kind-projects')!.textContent).toContain('radio_button_checked');
  expect(q('monitor01-project-kind-all')!.textContent).toContain('radio_button_unchecked');
});

it('a press reports the kind', () => {
  const onChange = jest.fn();
  renderUI(<Monitor01ProjectKindRadio value="projects" onChange={onChange} />);
  press('monitor01-project-kind-subprojects');
  expect(onChange).toHaveBeenLastCalledWith('subprojects');
  press('monitor01-project-kind-all');
  expect(onChange).toHaveBeenLastCalledWith('all');
});

it('compact: no border, and in the toolbar of the report it stands right after "Collapse all"', () => {
  const Monitor01Toolbar = require('../../../kit8/pm/reports/monitor01/Monitor01Toolbar').default;
  renderUI(<Monitor01Toolbar autoRefresh onAutoRefreshChange={jest.fn()} onRefresh={jest.fn()} onExpandAll={jest.fn()} onCollapseAll={jest.fn()} extra={<Monitor01ProjectKindRadio value="projects" onChange={jest.fn()} />} />);
  const collapse = q('monitor01-toolbar-collapse')!;
  const radio = q('monitor01-project-kind')!;
  expect(collapse.compareDocumentPosition(radio) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(collapse.parentElement).toBe(radio.closest('[data-testid="monitor01-toolbar"]'));
  const style = getComputedStyle(q('monitor01-project-kind-projects')!);
  expect(parseFloat(style.borderTopWidth || '0')).toBe(0);
});
