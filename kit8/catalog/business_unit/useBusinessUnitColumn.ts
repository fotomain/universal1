// The "Business unit" column every catalog table that can name a default unit shares (rowJSON.businessUnitAssigned): a select of the units, shown with their
// path, empty = "inherited from the next source" (the line takes its unit from: its resource, the role, the budget item, the contract, the project - in that order).
// `useBusinessUnitColumn()` reads the units (redux + realtime) and returns the column; a dashboard puts it into its table context (`businessUnitColumn`).
import { useMemo } from 'react';
import type { VisualColumn } from '../../ui/components/table/reusable/reusableTableTypes';
import { businessUnitOptions } from './businessUnitModel';
import { useBusinessUnitData } from './useBusinessUnitData';

export const BUSINESS_UNIT_ASSIGNED_KEY = 'businessUnitAssigned';

export function businessUnitAssignedColumn(options: { value: string; label: string }[], width = 260): VisualColumn {
  return {
    key: BUSINESS_UNIT_ASSIGNED_KEY, title: 'Business unit', type: 'select', field: BUSINESS_UNIT_ASSIGNED_KEY, width, allowEmpty: true, placeholder: 'Not set', options,
  };
}

export function useBusinessUnitColumn(): VisualColumn {
  const { rows } = useBusinessUnitData(true);
  return useMemo(() => businessUnitAssignedColumn(businessUnitOptions(rows)), [rows]);
}
