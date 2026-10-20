// Organization edit -> Projects -> Settings: the DEFAULT settings of a new project (organizationTable.rowJSON.defaultProjectSettings, defaultProjectSettings.ts).
// The same switches and tabs as the Project settings window (Main, Budgets, Vendor, Product, Subprojects, ROI) - the very same components - so a value means the same thing in both.
// Loaded lazily by OrganizationEdit (only while the Projects tab is open).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import SwitchApp from '../../ui/components/common/SwitchApp';
import { pmT } from '../../pm/i18n/pmT';
import { PM_PLAN_DATE_INPUT_FORMATS } from '../../pm/model/types';
import { withAlpha } from '../../pm/view/theme';
import PMProjectBudgetsTab, { type BudgetsSubTab } from '../../pm/view/project/settings/PMProjectBudgetsTab';
import PMProjectVendorTab from '../../pm/view/project/settings/PMProjectVendorTab';
import PMProjectProductTab from '../../pm/view/project/settings/PMProjectProductTab';
import PMProjectSubprojectsTab from '../../pm/view/project/settings/PMProjectSubprojectsTab';
import PMProjectRoiTab from '../../pm/view/project/settings/PMProjectRoiTab';
import { DefaultProjectSettings, defaultProjectSettingsOf, mainValuesOf } from './defaultProjectSettings';
import ScrollableTabBar from '../../ui/components/tabs/ScrollableTabBar';

export type OrganizationSettingsTab = 'main' | 'budgets' | 'vendor' | 'product' | 'subprojects' | 'roi';

const TABS: { id: OrganizationSettingsTab; label: string }[] = [
  { id: 'main', label: 'Main' },
  { id: 'budgets', label: 'Budgets' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'product', label: 'Product' },
  { id: 'subprojects', label: 'Subprojects' },
  { id: 'roi', label: 'ROI' },
];

export default function OrganizationProjectSettings({
  values,
  onChange,
  disabled = false,
}: {
  /** the stored defaults (any subset: a missing value reads as the default of the setting) */
  values: DefaultProjectSettings | undefined | null;
  /** the whole new defaults (all keys) */
  onChange: (next: DefaultProjectSettings) => void;
  disabled?: boolean;
}) {
  const { themeColors: c } = useDesignSystem();
  const [tab, setTab] = useState<OrganizationSettingsTab>('main');
  const [budgetsSubTab, setBudgetsSubTab] = useState<BudgetsSubTab>('TabBudgetsMain');
  const v = defaultProjectSettingsOf(values);
  const main = mainValuesOf(v);
  const patch = (p: DefaultProjectSettings) => {
    if (!disabled) onChange(defaultProjectSettingsOf({ ...v, ...p }));
  };

  return (
    <View testID="organization-project-settings">
      <Text style={{ color: c.text, opacity: 0.7, fontSize: 12, marginBottom: 8 }}>
        {pmT('These settings are given to every NEW project of the organization. Existing projects are not changed.')}
      </Text>
      <ScrollableTabBar testID="organization-project-settings-tabs" style={[styles.tabs, { borderBottomColor: c.border }]}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable
              key={t.id}
              testID={`organization-project-settings-tab-${t.id}`}
              accessibilityRole="tab"
              aria-selected={on}
              onPress={() => setTab(t.id)}
              style={[styles.tab, { borderBottomColor: on ? c.primary : 'transparent', backgroundColor: on ? withAlpha(c.primary, 0.12) : 'transparent' }]}
            >
              <Text style={{ color: on ? c.primary : c.text, fontWeight: on ? '700' : '500' }}>{pmT(t.label)}</Text>
            </Pressable>
          );
        })}
      </ScrollableTabBar>

      {/* read-only for a user who cannot edit the organization */}
      <View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.6 : 1 }}>
        {tab === 'main' && (
          <View testID="organization-project-settings-main">
            <SwitchApp testID="organization-project-weekends" label={pmT('Working days only (skip weekends)')} value={main.skipWeekends} onValueChange={(on) => patch({ skipWeekends: on })} style={styles.switchRow} />
            <SwitchApp testID="organization-project-plan-day" label={pmT('Plan in days (planDay)')} value={main.planDay} onValueChange={(on) => patch({ planDay: on })} style={styles.switchRow} />
            <SwitchApp testID="organization-project-plan-hour" label={pmT('Plan in hours (planHour)')} value={main.planHour} onValueChange={(on) => patch({ planHour: on })} style={styles.switchRow} />
            <SwitchApp testID="organization-project-plan-minute" label={pmT('Plan in minutes (planMinute)')} value={main.planMinute} onValueChange={(on) => patch({ planMinute: on })} style={styles.switchRow} />
            <SwitchApp testID="organization-project-plan-second" label={pmT('Plan in seconds (planSecond)')} value={main.planSecond} onValueChange={(on) => patch({ planSecond: on })} style={styles.switchRow} />
            <Text style={[styles.label, { color: c.text }]}>{pmT('Date format (planDateInputFormat)')}</Text>
            <View style={styles.formats}>
              {PM_PLAN_DATE_INPUT_FORMATS.map((fmt) => {
                const on = main.planDateInputFormat === fmt;
                return (
                  <Pressable
                    key={fmt}
                    testID={`organization-project-format-${fmt.replace(/[^A-Za-z0-9]/g, '_')}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => patch({ planDateInputFormat: fmt })}
                    style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}
                  >
                    <Text style={{ color: on ? '#ffffff' : c.text, fontWeight: on ? '700' : '600' }}>{fmt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        {tab === 'budgets' && <PMProjectBudgetsTab values={v} onChange={patch} subTab={budgetsSubTab} onSubTabChange={setBudgetsSubTab} />}
        {tab === 'vendor' && <PMProjectVendorTab values={v} onChange={patch} />}
        {tab === 'product' && <PMProjectProductTab values={v} onChange={patch} />}
        {tab === 'subprojects' && <PMProjectSubprojectsTab values={v} onChange={patch} />}
        {tab === 'roi' && <PMProjectRoiTab values={v} onChange={patch} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1, gap: 6, marginBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  switchRow: { marginVertical: 4 },
  label: { fontWeight: '600', marginTop: 12, marginBottom: 6 },
  formats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
});
