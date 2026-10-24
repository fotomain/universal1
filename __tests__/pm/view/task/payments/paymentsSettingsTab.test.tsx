/** @jest-environment jsdom */
// Project settings -> Payments (TabPayments, its own tab right after Budgets): paymentPlanAfterTaskFinishEnabled is TRUE while never saved (the database reads a missing value as true);
// the key is part of the Organization defaults, and the Project settings window / Organization edit carry the tab.
import * as fs from 'fs';
import * as path from 'path';
import { cleanupUI, q, renderUI, toggleSwitch } from '../../../ui/pmUiTestKit';
import PMProjectPaymentsTab, { paymentDifferentRootsOf, paymentPlanAfterTaskFinishOf, paymentsValuesOf } from '../../../../../kit8/pm/view/project/settings/PMProjectPaymentsTab';
import { defaultProjectSettingsOf, newProjectPatchFrom } from '../../../../../kit8/catalog/organization/defaultProjectSettings';

afterEach(cleanupUI);
const checked = (id: string) => (q(id)!.querySelector('input') as HTMLInputElement).checked;
const readSrc = (rel: string) => fs.readFileSync(path.join(__dirname, '../../../../..', rel), 'utf8');

it('TRUE by default: a missing key (or anything but a stored false) is true', () => {
  expect(paymentsValuesOf(null)).toEqual({ paymentPlanAfterTaskFinishEnabled: true, paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: true });
  expect(paymentsValuesOf({})).toEqual({ paymentPlanAfterTaskFinishEnabled: true, paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: true });
  expect(paymentsValuesOf({ paymentPlanAfterTaskFinishEnabled: 'no' as any }).paymentPlanAfterTaskFinishEnabled).toBe(true);
  expect(paymentPlanAfterTaskFinishOf({ paymentPlanAfterTaskFinishEnabled: false })).toBe(false);
});

it('the switch is on for a project without the key and saves only its own key', () => {
  const onChange = jest.fn();
  renderUI(<PMProjectPaymentsTab values={{}} onChange={onChange} />);
  expect(q('pm-project-tab-payments-content')).not.toBeNull();
  expect(checked('pm-project-payment-plan-after-finish')).toBe(true);
  toggleSwitch('pm-project-payment-plan-after-finish');
  expect(onChange).toHaveBeenLastCalledWith({ paymentPlanAfterTaskFinishEnabled: false });
});

it('paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: TRUE by default, saves only its own key (PART 39)', () => {
  expect(paymentDifferentRootsOf(null)).toBe(true);
  expect(paymentDifferentRootsOf({})).toBe(true);
  expect(paymentDifferentRootsOf({ paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: false })).toBe(false);
  const onChange = jest.fn();
  renderUI(<PMProjectPaymentsTab values={{}} onChange={onChange} />);
  expect(checked('pm-project-payment-different-roots')).toBe(true);
  toggleSwitch('pm-project-payment-different-roots');
  expect(onChange).toHaveBeenLastCalledWith({ paymentContainBusinessUnitesFromTheDifferent1stLevelRootsEnabled: false });
});

it('shows the saved value', () => {
  renderUI(<PMProjectPaymentsTab values={{ paymentPlanAfterTaskFinishEnabled: false }} onChange={jest.fn()} />);
  expect(checked('pm-project-payment-plan-after-finish')).toBe(false);
});

it('the organization defaults carry the key (true) and a new project starts from the stored one', () => {
  expect(defaultProjectSettingsOf(null).paymentPlanAfterTaskFinishEnabled).toBe(true);
  expect(defaultProjectSettingsOf({ paymentPlanAfterTaskFinishEnabled: false }).paymentPlanAfterTaskFinishEnabled).toBe(false);
  expect(newProjectPatchFrom({ paymentPlanAfterTaskFinishEnabled: false } as any).paymentPlanAfterTaskFinishEnabled).toBe(false);
  expect(newProjectPatchFrom(null)).toEqual({});
});

describe('the tab is wired where the other tabs are (source check; the windows themselves are covered by the settings screen tests)', () => {
  it('Organization edit: the tab Payments right after Budgets', () => {
    const org = readSrc('kit8/catalog/organization/OrganizationProjectSettings.tsx');
    expect(org.indexOf("{ id: 'payments', label: 'Payments' }")).toBe(org.indexOf("{ id: 'budgets', label: 'Budgets' }") + "{ id: 'budgets', label: 'Budgets' },\n  ".length);
    expect(org).toContain("{tab === 'payments' && <PMProjectPaymentsTab values={v} onChange={patch} />}");
  });
  it('Project settings window: TabPayments right after TabBudgets; the key is read for a project, written on save, defaulted for a new one', () => {
    const w = readSrc('kit8/pm/view/project/recent/PMRecentProjectsToolbar.tsx');
    const tabs = w.slice(w.indexOf("{ id: 'TabMain' as const"), w.indexOf("{ id: 'TabROI' as const"));
    expect(tabs.indexOf("'TabPayments'")).toBeGreaterThan(tabs.indexOf("'TabBudgets'"));
    expect(tabs.indexOf("'TabPayments'")).toBeLessThan(tabs.indexOf("'TabVendor'"));
    expect(w).toContain('...paymentsValuesOf(null)');
    expect(w).toContain('...paymentsValuesOf(project.rowJSON)');
    expect(w).toContain('paymentsValuesOf(draft)');
    expect(w).toContain('<PMProjectPaymentsTab values={draft || {}}');
  });
});
