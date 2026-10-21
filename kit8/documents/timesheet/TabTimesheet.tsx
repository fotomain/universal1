// TabTimesheet - the two switches of the time sheet (documentation/TIME_SHEET_WBS.html section 5a):
//   timesheetAllWorkCenterInputAvailable   false (built-in default): the user picks only his own Person work center. true: every work center.
//   timesheetOnlyCurrentMonthInputEnabled  true (built-in default): the period lies inside today's month. false: a free period of at most 62 days.
// Kept PER PERSON (Person edit) with the default for the user in the ORGANIZATION (Organization edit → Time sheet): a value is read Person → Organization → built-in default (timesheetSettingOf).
// `values` = the keys stored in the rowJSON being edited, `inherited` = the Organization's rowJSON (Person level only), `onChange(next)` = the new stored keys (a key that is missing = not stored).
// No permission rule yet (a PM role comes later): everybody can edit his own Person.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import SwitchApp from '../../ui/components/common/SwitchApp';
import ButtonApp from '../../ui/components/common/ButtonApp';
import { pmT } from '../../pm/i18n/pmT';
import { TIMESHEET_ALL_WORK_CENTERS_KEY, TIMESHEET_ONLY_CURRENT_MONTH_KEY, TimesheetSettingKey, timesheetSettingOf } from './timesheetModel';

export type TimesheetStoredSettings = Partial<Record<TimesheetSettingKey, boolean>>;

/** the two stored keys of a rowJSON (anything that is not a boolean is "not stored") */
export function storedTimesheetSettings(json?: Record<string, any> | null): TimesheetStoredSettings {
  const out: TimesheetStoredSettings = {};
  (['timesheetAllWorkCenterInputAvailable', 'timesheetOnlyCurrentMonthInputEnabled'] as const).forEach((k) => { if (typeof json?.[k] === 'boolean') out[k] = json[k]; });
  return out;
}

const ROWS: { key: TimesheetSettingKey; label: string; help: string }[] = [
  { key: TIMESHEET_ALL_WORK_CENTERS_KEY, label: 'All work centers can be selected', help: 'Off: a time sheet can be made only for your own Person work center. On: for any work center of the organization.' },
  { key: TIMESHEET_ONLY_CURRENT_MONTH_KEY, label: 'Only the current month', help: 'On: the period of a time sheet must lie inside today\'s month. Off: any period of at most 62 days.' },
];

export interface TabTimesheetProps {
  /** the keys stored in the rowJSON being edited */
  values: TimesheetStoredSettings;
  /** the Organization's rowJSON: shown as the inherited value on the Person level; omit on the Organization level */
  inherited?: Record<string, any> | null;
  onChange: (next: TimesheetStoredSettings) => void;
  disabled?: boolean;
  testID?: string;
}

export default function TabTimesheet({ values, inherited, onChange, disabled, testID = 'timesheet-settings' }: TabTimesheetProps) {
  const { themeColors: c } = useDesignSystem();
  const personLevel = inherited !== undefined;
  return (
    <View testID={testID} style={styles.root}>
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>
        {personLevel ? pmT('Your own values. A switch you have not set follows the organization.') : pmT('The default for every user. A person can set his own values.')}
      </Text>
      {ROWS.map((r) => {
        const own = values[r.key];
        const eff = timesheetSettingOf(r.key, personLevel ? values : null, personLevel ? inherited : values);
        const shown = personLevel ? eff.value : own ?? eff.value;
        return (
          <View key={r.key} style={styles.row}>
            <SwitchApp testID={`${testID}-${r.key}`} label={pmT(r.label)} value={shown} disabled={disabled} onValueChange={(v) => onChange({ ...values, [r.key]: v })} />
            <Text testID={`${testID}-${r.key}-help`} style={{ color: c.text, opacity: 0.65, fontSize: 12 }}>{pmT(r.help)}</Text>
            {personLevel && (
              <View style={styles.source}>
                <Text testID={`${testID}-${r.key}-source`} style={{ color: c.text, opacity: 0.8, fontSize: 12 }}>
                  {eff.source === 'person' ? pmT('Set for you') : eff.source === 'organization' ? pmT('From the organization') : pmT('Built-in default')}
                </Text>
                {own !== undefined && !disabled && (
                  <ButtonApp testID={`${testID}-${r.key}-reset`} title={pmT('Use the organization value')} variant="text" size="small" onPress={() => { const next = { ...values }; delete next[r.key]; onChange(next); }} />
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10, paddingVertical: 8 },
  row: { gap: 2 },
  source: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
