// The "Calendar" column of a ReusableTable of resources (equipment, contract templates): rowJSON.resourceCalendar = a RESOURCE calendar (the capacity of the row); empty = the Standard
// work week. `useResourceCalendarColumn()` reads the calendars (redux + realtime) and returns the column, like useBusinessUnitColumn. A person and a contract are edited in forms
// (ResourceCalendarField: it also makes an own copy).
import { useMemo } from 'react';
import type { VisualColumn } from '../../../ui/components/table/reusable/reusableTableTypes';
import { calendarsOf, isResourceCalendar } from './managementCalendarModel';
import { resourceCalendarTitle } from './ResourceCalendarField';
import { useManagementCalendarData } from './useManagementCalendarData';

export const RESOURCE_CALENDAR_KEY = 'resourceCalendar';

export function resourceCalendarColumn(options: { value: string; label: string }[], width = 230): VisualColumn {
  return { key: RESOURCE_CALENDAR_KEY, title: 'Calendar', type: 'select', field: RESOURCE_CALENDAR_KEY, width, allowEmpty: true, placeholder: 'Standard work week', options };
}

/** the resource calendars as select options (title + hours per day) */
export const resourceCalendarOptions = (rows: { rowGUID: string; rowParentGUID?: string; rowJSON?: any }[]) =>
  calendarsOf(rows as any).filter((r) => isResourceCalendar(r)).map((r) => ({ value: r.rowGUID, label: resourceCalendarTitle(r) }));

export function useResourceCalendarColumn(): VisualColumn {
  const { rows } = useManagementCalendarData(true);
  return useMemo(() => resourceCalendarColumn(resourceCalendarOptions(rows)), [rows]);
}
