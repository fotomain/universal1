// ResourceCalendarField - the field "Calendar" of a person, an equipment, a contract and a contract template (rowJSON.resourceCalendar = managementCalendarTable.rowGUID of a RESOURCE
// calendar, documentation/TIME_GENUS_CONTROL_WBS.html section 2). The hours of its days are the CAPACITY of the resource; empty = the Standard work week.
//   the picker lists the resource calendars (kind 'resource'); a calendar is SHARED by every resource that points to it ("Part-time 4 h");
//   "Own calendar" makes a private copy (copy on write: SQL organization_copy_calendar - the row and all its days) so that a vacation or a service day of ONE resource does not touch the others.
//   The contract calendar WINS over the calendar of the person while the contract is in force (SQL organization_resource_capacity_info).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { showSnackbar } from '../../../redux/uxuiSlice';
import SelectElementFromCatalog from '../../inner/select_element/SelectElementFromCatalog';
import { copyManagementCalendar } from './managementCalendarApi';
import { MANAGEMENT_CALENDAR, MANAGEMENT_CALENDAR_TABLE, calendarHoursPerDay, isResourceCalendar } from './managementCalendarModel';

/** the folder a private copy goes to, by what the calendar is for */
export type ResourceCalendarFor = 'person' | 'equipment' | 'contract';
export const OWN_CALENDAR_FOLDER: Record<ResourceCalendarFor, string> = {
  person: MANAGEMENT_CALENDAR.personFolder,
  equipment: MANAGEMENT_CALENDAR.equipmentFolder,
  contract: MANAGEMENT_CALENDAR.contractFolder,
};

export interface ResourceCalendarFieldProps {
  value: string | null | undefined;
  onChange: (calendarGUID: string | null) => void;
  /** what the calendar is for: decides the folder of an own copy */
  kind: ResourceCalendarFor;
  /** the name of the resource, for the title of an own copy ("Anna K. (own calendar)") */
  resourceTitle?: string;
  disabled?: boolean;
  label?: string;
  testID?: string;
  /** a table cell: low trigger, no label */
  compact?: boolean;
}

export const resourceCalendarTitle = (r: { rowGUID: string; rowJSON?: any }): string => {
  const title = String(r.rowJSON?.title ?? '').trim() || r.rowGUID;
  return `${title} · ${calendarHoursPerDay(r as any)} h`;
};

export default function ResourceCalendarField({ value, onChange, kind, resourceTitle, disabled, label = 'Calendar', testID = 'resource-calendar', compact }: ResourceCalendarFieldProps) {
  const { themeColors: c } = useDesignSystem();
  const dispatch = useDispatch();
  const [busy, setBusy] = useState(false);

  const makeOwn = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const guid = await copyManagementCalendar(value || MANAGEMENT_CALENDAR.standardWorkWeek, resourceTitle ? `${resourceTitle} (own calendar)` : undefined, OWN_CALENDAR_FOLDER[kind]);
      onChange(guid);
      dispatch(showSnackbar({ message: 'An own calendar was made: add the vacations and the service days there (Catalogs > Management calendars).' }));
    } catch (e: any) {
      dispatch(showSnackbar({ message: `The calendar could not be copied: ${e?.message || e}` }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View testID={testID} style={compact ? undefined : styles.wrap}>
      <SelectElementFromCatalog
        testID={`${testID}-select`}
        label={compact ? undefined : label}
        placeholder="Standard work week"
        entityName={MANAGEMENT_CALENDAR_TABLE.entity}
        value={value || null}
        filterItem={(row) => isResourceCalendar(row)}
        titleExtractor={resourceCalendarTitle}
        disabled={disabled}
        compact={compact}
        onChange={(guid) => onChange(guid || null)}
      />
      {!compact && (
        <Pressable testID={`${testID}-own`} accessibilityRole="button" accessibilityState={{ disabled: !!disabled || busy }} disabled={disabled || busy} onPress={makeOwn}
          style={[styles.own, { borderColor: c.primary, opacity: disabled ? 0.5 : 1 }]}>
          <Text style={{ color: c.primary, fontSize: 12, fontWeight: '700' }}>{busy ? 'Copying…' : 'Own calendar'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  own: { alignSelf: 'flex-start', marginTop: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 3 },
});
