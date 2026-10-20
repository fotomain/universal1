// roiSettings - the ROI keys of a project (documentation/ROI_DOC.html section 2, SQL PART 33 / 34, README next to this file).
// Pure TypeScript, no React / Supabase imports: unit-testable.
//   project_table.rowJSON  (Project settings -> ROI). EVERY key is FALSE while never saved - the opposite of the Customer / Vendor switches:
//     roiForTasksFunctionalityEnabled   ROI per TASK (Monitor02 shows the project only while it is on, with a line per task); off: the per-task calculation does not run
//     roiHistoryFunctionalityEnabled    the ROI history: the worker writes project_status_roi_history while it is on (Monitor03 "as seen on" curve)
//     projectROIIncludeAllTaxes         master: both VAT switches below count as ON (and are shown locked)
//     projectROIIncludeSaleVAT          the VAT of the revenue side (planned revenue, fact input, customer invoice) is added to the revenue
//     projectROIIncludePurchaseVAT      ALL the VAT of the cost side (plan, vendor invoice) is added to the cost; off: net + the VAT that is cost (the IFRS / GAAP cost)
// SQL reads the same keys with vendor_project_setting_on(project, key) (FALSE unless stored true) and roi_include_vat(project, 'sale' | 'purchase'): the two must agree (__tests__/pm/reports/roi).

export interface PMProjectRoiValues {
  roiForTasksFunctionalityEnabled?: boolean;
  roiHistoryFunctionalityEnabled?: boolean;
  projectROIIncludeAllTaxes?: boolean;
  projectROIIncludeSaleVAT?: boolean;
  projectROIIncludePurchaseVAT?: boolean;
}

/** a missing key is OFF (SQL: vendor_project_setting_on) */
export const roiValuesOf = (j: PMProjectRoiValues | undefined | null): Required<PMProjectRoiValues> => ({
  roiForTasksFunctionalityEnabled: j?.roiForTasksFunctionalityEnabled === true,
  roiHistoryFunctionalityEnabled: j?.roiHistoryFunctionalityEnabled === true,
  projectROIIncludeAllTaxes: j?.projectROIIncludeAllTaxes === true,
  projectROIIncludeSaleVAT: j?.projectROIIncludeSaleVAT === true,
  projectROIIncludePurchaseVAT: j?.projectROIIncludePurchaseVAT === true,
});

/** the switches that really work: the master turns both VAT switches ON (SQL: roi_include_vat) */
export interface RoiTaxSettings { includeSaleVat: boolean; includePurchaseVat: boolean }

export const roiTaxOf = (j: PMProjectRoiValues | undefined | null): RoiTaxSettings => {
  const v = roiValuesOf(j);
  return { includeSaleVat: v.projectROIIncludeAllTaxes || v.projectROIIncludeSaleVAT, includePurchaseVat: v.projectROIIncludeAllTaxes || v.projectROIIncludePurchaseVAT };
};

/** is ROI per task on (Monitor02 shows the project, with a line per task, only then) */
export const roiForTasksOf = (j: PMProjectRoiValues | undefined | null): boolean => j?.roiForTasksFunctionalityEnabled === true;

/** is the ROI history on (the worker writes a snapshot, Monitor03 offers the "as seen on" curve) */
export const roiHistoryOf = (j: PMProjectRoiValues | undefined | null): boolean => j?.roiHistoryFunctionalityEnabled === true;
