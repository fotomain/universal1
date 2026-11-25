// /settings: tabs (General, Fonts, Colors, Dashboards, Media, This device) + a search over every setting. A search shows the matching blocks of ALL tabs; the tab bar shows how many each tab has.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ScrollableTabBar from '../components/tabs/ScrollableTabBar';
import SearchTextApp from '../components/common/SearchTextApp';
import { filterSections, hitsPerTab, sectionsOfTab, SETTINGS_TABS, SettingsTabId } from './settingsModel';
import { SECTION_COMPONENTS } from './SettingsSections';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { themeColors: c } = useDesignSystem();
  const [tab, setTab] = useState<SettingsTabId>('general');
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const hits = useMemo(() => hitsPerTab(query), [query]);
  const sections = useMemo(() => (searching ? filterSections(query) : sectionsOfTab(tab)), [searching, query, tab]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} testID="settings-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 110, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 960, paddingHorizontal: 16 }} testID="settings-content">
          <Text style={{ color: c.primary, fontSize: 26, fontWeight: '700', marginTop: 20 }}>{t('menu.settings')}</Text>
          <Text style={{ color: c.text, opacity: 0.7, marginBottom: 12 }}>{t('body.settingsDescription')}</Text>

          <SearchTextApp testID="settings-search" value={query} onChangeText={setQuery} placeholder="Search the settings..." />

          <ScrollableTabBar testID="settings-tabs" style={{ flexDirection: 'row', gap: 6, marginVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
            {SETTINGS_TABS.map((tb) => {
              const on = !searching && tb.id === tab;
              const n = searching ? hits[tb.id] : 0;
              return (
                <Pressable
                  key={tb.id}
                  testID={`settings-tab-${tb.id}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => { setQuery(''); setTab(tb.id); }}
                  style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 3, borderBottomColor: on ? c.primary : 'transparent', opacity: searching && n === 0 ? 0.4 : 1 }}
                >
                  <Text style={{ color: on ? c.primary : c.text, fontWeight: on ? '700' : '500' }}>{tb.title}{searching && n > 0 ? ` (${n})` : ''}</Text>
                </Pressable>
              );
            })}
          </ScrollableTabBar>

          {sections.length === 0 && <Text testID="settings-nothing" style={{ color: c.text, opacity: 0.7, marginVertical: 24 }}>Nothing found for "{query}".</Text>}
          {sections.map((s) => {
            const Body = SECTION_COMPONENTS[s.id];
            return Body ? (
              <View key={s.id} testID={`settings-section-${s.id}`}>
                {searching && <Text style={{ color: c.primary, fontSize: 12, marginBottom: 4 }}>{SETTINGS_TABS.find((x) => x.id === s.tab)?.title}</Text>}
                <Body />
              </View>
            ) : null;
          })}
        </View>
      </ScrollView>
    </View>
  );
}
