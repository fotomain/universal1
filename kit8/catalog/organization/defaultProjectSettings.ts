// Default project settings of an organization: organizationTable.rowJSON.defaultProjectSettings.
//   * Organization edit -> Projects -> Settings edits them (OrganizationProjectSettings.tsx).
//   * Project settings window (three dots menu) -> "Save settings to organization" writes the values of the window there (useMyOrganization).
//   * A NEW project starts from them (PMRecentProjectsToolbar.openNew): newProjectPatchFrom(). An organization that never saved them changes nothing.
// What is a "setting": the plan units + the date format + working days (Main), the Budgets tab, the Vendor tab, the Customer tab, the Product tab, the Subprojects tab, the ROI tab, the Payments tab and the Resources tab (Resource optimization) of the
// project settings. NOT: name, dates, project manager, partners, kanban, the row command modes (those are of the project / the user).
import type { PMPlanDateInputFormat } from '../../pm/model/types';
import { PM_PLAN_DATE_INPUT_FORMATS } from '../../pm/model/types';
import { budgetsValuesOf, type PMProjectBudgetsValues } from '../../pm/view/project/settings/PMProjectBudgetsTab';
import { vendorValuesOf, type PMProjectVendorValues } from '../../pm/view/project/settings/PMProjectVendorTab';
import { customerValuesOf, type PMProjectCustomerValues } from '../../pm/view/project/settings/PMProjectCustomerTab';
import { productValuesOf, type PMProjectProductValues } from '../../pm/view/project/settings/PMProjectProductTab';
import { subprojectValuesOf, type PMSubprojectValues } from '../../pm/subproject/subprojectModel';
import { roiValuesOf, type PMProjectRoiValues } from '../../pm/reports/roi/roiSettings';
import { paymentsValuesOf, type PMProjectPaymentsValues } from '../../pm/view/project/settings/PMProjectPaymentsTab';
import { resourceLevelingValuesOf, type PMResourceLevelingValues } from '../../pm/resourceleveling/resourceLevelingSettings';
import { PROJECT_CENTER_FIELDS } from '../business_unit/businessUnitModel';

export const DEFAULT_PROJECT_SETTINGS_KEY = 'defaultProjectSettings';

export interface PMProjectMainValues {
  skipWeekends?: boolean;
  planDay?: boolean;
  planHour?: boolean;
  planMinute?: boolean;
  planSecond?: boolean;
  planDateInputFormat?: PMPlanDateInputFormat;
}

export interface DefaultProjectSettings extends PMProjectMainValues, PMProjectBudgetsValues, PMProjectVendorValues, PMProjectCustomerValues, PMProjectProductValues, PMSubprojectValues, PMProjectRoiValues, PMProjectPaymentsValues, PMResourceLevelingValues {}

export const mainValuesOf = (j: PMProjectMainValues | undefined | null): Required<PMProjectMainValues> => ({
  skipWeekends: !!j?.skipWeekends,
  planDay: j?.planDay ?? true,
  planHour: !!j?.planHour,
  planMinute: !!j?.planMinute,
  planSecond: !!j?.planSecond,
  planDateInputFormat: (PM_PLAN_DATE_INPUT_FORMATS as readonly string[]).includes(j?.planDateInputFormat as string)
    ? (j!.planDateInputFormat as PMPlanDateInputFormat)
    : 'YYYY-MM-DD',
});

export const isPlainObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The settings (all keys, missing ones read as the default of the setting) of a project row's rowJSON, a Project settings draft or a stored defaultProjectSettings. */
export const defaultProjectSettingsOf = (source: DefaultProjectSettings | undefined | null): DefaultProjectSettings => ({
  ...mainValuesOf(source),
  ...budgetsValuesOf(source),
  ...vendorValuesOf(source),
  ...customerValuesOf(source),
  ...productValuesOf(source),
  ...subprojectValuesOf(source),
  ...roiValuesOf(source),
  ...paymentsValuesOf(source),
  ...resourceLevelingValuesOf(source),
});

/** The defaults stored in an organization's rowJSON, or null when the organization never saved them. */
export const storedDefaultProjectSettings = (organizationJSON: { defaultProjectSettings?: unknown } | undefined | null): DefaultProjectSettings | null =>
  isPlainObject(organizationJSON?.defaultProjectSettings) ? (organizationJSON!.defaultProjectSettings as DefaultProjectSettings) : null;

/**
 * The fields of a NEW project's Project settings draft that the organization defaults set (null/empty defaults = {}: nothing changes).
 * Business units: a center the defaults leave empty is NOT overwritten (the draft keeps the first unit that fits), and the "required" flag of a new project stays on.
 */
export const newProjectPatchFrom = (defaults: DefaultProjectSettings | undefined | null): DefaultProjectSettings => {
  if (!defaults || !isPlainObject(defaults)) return {};
  const all = defaultProjectSettingsOf(defaults);
  const patch: Record<string, any> = { ...all };
  delete patch.projectBusinessUnitsRequired;
  for (const f of PROJECT_CENTER_FIELDS) {
    if (!patch[f.key]) delete patch[f.key];
  }
  return patch as DefaultProjectSettings;
};
