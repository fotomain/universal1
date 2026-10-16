/** @jest-environment jsdom */
// the helpers import the settings tab components (budgetsValuesOf ...): the PM UI kit mocks their native-only modules; import it FIRST
import '../../pm/ui/pmUiTestKit';
import {
  defaultProjectSettingsOf,
  mainValuesOf,
  newProjectPatchFrom,
  storedDefaultProjectSettings,
} from '../../../kit8/catalog/organization/defaultProjectSettings';
import { normalizeOrganization } from '../../../kit8/catalog/organization/organizationModel';

describe('defaultProjectSettings (organization defaults of a new project)', () => {
  it('mainValuesOf: a missing value reads as the default of the setting', () => {
    expect(mainValuesOf(null)).toEqual({
      skipWeekends: false,
      planDay: true,
      planHour: false,
      planMinute: false,
      planSecond: false,
      planDateInputFormat: 'YYYY-MM-DD',
    });
    expect(mainValuesOf({ planHour: true, skipWeekends: true }).planHour).toBe(true);
    // an unknown date format falls back to the default
    expect(mainValuesOf({ planDateInputFormat: 'nope' as any }).planDateInputFormat).toBe('YYYY-MM-DD');
  });

  it('defaultProjectSettingsOf: all the keys of Main + Budgets + Vendor + Subprojects, nothing of name / dates / partners', () => {
    const all = defaultProjectSettingsOf({ planHour: true, currencyForBudget: 'EUR', multiProjectVendorInvoceNeeded: true, subprojectsFunctionalityEnabled: true } as any);
    expect(all.planHour).toBe(true);
    expect(all.currencyForBudget).toBe('EUR');
    expect(all.multiProjectVendorInvoceNeeded).toBe(true);
    expect(all.subprojectsFunctionalityEnabled).toBe(true);
    // vendor defaults: true unless stored false
    expect(all.independentInvoiceInputAvailable).toBe(true);
    for (const k of ['name', 'projectStartDate', 'projectFinishDate', 'mainSupplierGUID', 'projectManagerPerson']) {
      expect(k in all).toBe(false);
    }
  });

  it('storedDefaultProjectSettings: only a plain object counts', () => {
    expect(storedDefaultProjectSettings(undefined)).toBeNull();
    expect(storedDefaultProjectSettings({})).toBeNull();
    expect(storedDefaultProjectSettings({ defaultProjectSettings: [] })).toBeNull();
    expect(storedDefaultProjectSettings({ defaultProjectSettings: 'x' })).toBeNull();
    expect(storedDefaultProjectSettings({ defaultProjectSettings: { planHour: true } })).toEqual({ planHour: true });
  });

  it('newProjectPatchFrom: nothing stored = nothing changes', () => {
    expect(newProjectPatchFrom(null)).toEqual({});
    expect(newProjectPatchFrom(undefined)).toEqual({});
  });

  it('newProjectPatchFrom: the stored values are used, an empty center is not overwritten, "business units required" is not touched', () => {
    const patch: any = newProjectPatchFrom({ planMinute: true, currencyForBudget: 'USD', projectCostCenter: 'unit-cost', projectBusinessUnitsRequired: false } as any);
    expect(patch.planMinute).toBe(true);
    expect(patch.currencyForBudget).toBe('USD');
    expect(patch.projectCostCenter).toBe('unit-cost');
    expect('projectRevenueCenter' in patch).toBe(false);
    expect('projectProfitCenter' in patch).toBe(false);
    expect('projectInvestmentCenter' in patch).toBe(false);
    expect('projectBusinessUnitsRequired' in patch).toBe(false);
  });

  it('normalizeOrganization keeps the defaults object and drops anything else', () => {
    const base = { organizationTitle: 'Acme', createdByUser: 'a@b.c', isActive: true };
    const kept = normalizeOrganization({ ...base, defaultProjectSettings: { planHour: true } });
    expect(kept.defaultProjectSettings).toEqual({ planHour: true });
    expect('defaultProjectSettings' in normalizeOrganization({ ...base, defaultProjectSettings: [1] as any })).toBe(false);
    expect('defaultProjectSettings' in normalizeOrganization({ ...base, defaultProjectSettings: 'x' as any })).toBe(false);
    expect('defaultProjectSettings' in normalizeOrganization(base)).toBe(false);
  });
});
