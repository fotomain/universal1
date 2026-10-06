// AppleMacUI demo (route /kit8/ui/applemacui): every component, in light AND dark mode (two columns on wide screens,
// one under the other on phones). Each column has its own <WithAppleMacUI mode="…">.
import React, { memo, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { appleMacUITheme } from './appleMacUITheme';
import { useAppleMacUI, WithAppleMacUI } from './WithAppleMacUI';
import { AppleButton } from './components/AppleButton';
import { AppleTextField } from './components/AppleTextField';
import { AppleSwitch } from './components/AppleSwitch';
import { AppleSegmentedControl } from './components/AppleSegmentedControl';
import { AppleGroupedList, AppleListRow } from './components/AppleList';
import { AppleSheet } from './components/AppleSheet';
import { AppleDatePicker } from './components/AppleDatePicker';
import { AppleNavigationBar } from './components/AppleNavigationBar';

const TEXT_STYLES = ['largeTitle', 'title1', 'title2', 'title3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption1'] as const;

const Gallery = memo(function Gallery({ name }: { name: string }) {
  const { theme, text } = useAppleMacUI();
  const [textValue, setTextValue] = useState('Hello');
  const [password, setPassword] = useState('secret');
  const [email, setEmail] = useState('not-an-email');
  const [on, setOn] = useState(true);
  const [segment, setSegment] = useState('task');
  const [date, setDate] = useState<Date | null>(new Date(2026, 9, 6, 9, 30));
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const s = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, minWidth: 300, backgroundColor: theme.colors.systemGroupedBackground },
        section: { ...text('footnote'), color: theme.colors.secondaryLabel, textTransform: 'uppercase', marginHorizontal: theme.space[4], marginTop: theme.space[5], marginBottom: theme.space[2] },
        block: { marginHorizontal: theme.space[4] },
        row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.space[2], marginBottom: theme.space[2] },
        sample: { color: theme.colors.label, marginBottom: theme.space[1] },
        sheetText: { ...text('body'), color: theme.colors.label, marginBottom: theme.space[4] },
      }),
    [theme, text]
  );
  return (
    <View style={s.root} testID={`applemacui-demo-${name}`}>
      <AppleNavigationBar title={`Apple Mac UI · ${name}`} large />

      <Text style={s.section}>Buttons</Text>
      <View style={s.block}>
        {(['filled', 'tinted', 'gray', 'plain'] as const).map((variant) => (
          <View key={variant} style={s.row}>
            <AppleButton title="Small" size="small" variant={variant} onPress={() => undefined} />
            <AppleButton title={variant} variant={variant} onPress={() => undefined} />
            <AppleButton title="Large" size="large" variant={variant} icon="add" onPress={() => undefined} />
          </View>
        ))}
        <View style={s.row}>
          <AppleButton title="Loading" loading={loading} onPress={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }} />
          <AppleButton title="Disabled" disabled />
          <AppleButton title="Delete" destructive variant="tinted" icon="delete" onPress={() => undefined} />
        </View>
      </View>

      <Text style={s.section}>Text fields</Text>
      <View style={s.block}>
        <AppleTextField label="Name" placeholder="Your name" value={textValue} onChangeText={setTextValue} helperText="The clear button appears while there is text." />
        <AppleTextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <AppleTextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" error={email.includes('@') ? false : 'Enter a valid e-mail address.'} />
        <AppleTextField label="Disabled" value="Read only" disabled />
      </View>
      <AppleGroupedList header="Grouped-list variant">
        <AppleTextField variant="grouped" label="First name" placeholder="Required" value={textValue} onChangeText={setTextValue} />
        <AppleTextField variant="grouped" label="Phone" placeholder="Optional" keyboardType="phone-pad" value="" />
      </AppleGroupedList>

      <Text style={s.section}>Date picker</Text>
      <View style={s.block}>
        <AppleDatePicker label="Date" mode="date" value={date} onChange={setDate} />
        <AppleDatePicker label="Time" mode="time" value={date} onChange={setDate} />
        <AppleDatePicker label="Date and time" mode="datetime" value={date} onChange={setDate} min={new Date(2026, 0, 1)} max={new Date(2027, 11, 31)} />
      </View>

      <Text style={s.section}>Segmented control</Text>
      <View style={s.block}>
        <AppleSegmentedControl
          value={segment}
          onValueChange={setSegment}
          segments={[
            { value: 'stage', label: 'Stage' },
            { value: 'task', label: 'Task' },
            { value: 'milestone', label: 'Milestone' },
          ]}
        />
      </View>

      <Text style={s.section}>Switch and list</Text>
      <AppleGroupedList header="Settings" footer="Inset grouped list with hairline separators.">
        <AppleListRow title="Wi-Fi" icon="wifi" value="Home" onPress={() => undefined} />
        <AppleListRow title="Notifications" subtitle="Banners, sounds, badges" icon="notifications" right={<AppleSwitch value={on} onValueChange={setOn} accessibilityLabel="Notifications" />} />
        <AppleListRow title="Selected option" accessory="check" onPress={() => undefined} />
        <AppleListRow title="Disabled row" disabled onPress={() => undefined} />
        <AppleListRow title="Delete account" destructive accessory="none" onPress={() => undefined} />
      </AppleGroupedList>
      <View style={s.block}>
        <AppleSwitch label="Switch with a label" value={on} onValueChange={setOn} />
        <AppleSwitch label="Disabled" value={false} onValueChange={() => undefined} disabled />
      </View>

      <Text style={s.section}>Sheet</Text>
      <View style={s.block}>
        <AppleButton title="Open sheet" variant="tinted" onPress={() => setSheet(true)} />
      </View>
      <AppleSheet visible={sheet} onClose={() => setSheet(false)} title="Sheet" detents={['medium', 'large']}>
        <Text style={s.sheetText}>Drag the grabber: up for the large detent, down to dismiss. The backdrop closes it too.</Text>
        <AppleButton title="Done" fullWidth size="large" onPress={() => setSheet(false)} />
      </AppleSheet>

      <Text style={s.section}>Typography</Text>
      <View style={s.block}>
        {TEXT_STYLES.map((n) => (
          <Text key={n} style={[text(n), s.sample]} allowFontScaling>
            {n} · {theme.typography[n].fontSize}
          </Text>
        ))}
      </View>
      <View style={{ height: theme.space[10] }} />
    </View>
  );
});

export default function AppleMacUIDemoScreen() {
  const win = useWindowDimensions();
  const wide = win.width >= 760;
  return (
    <ScrollView testID="applemacui-demo" contentContainerStyle={wide ? styles.wide : undefined}>
      <WithAppleMacUI theme={appleMacUITheme} mode="light">
        <Gallery name="Light" />
      </WithAppleMacUI>
      <WithAppleMacUI theme={appleMacUITheme} mode="dark">
        <Gallery name="Dark" />
      </WithAppleMacUI>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wide: { flexDirection: 'row', alignItems: 'flex-start' } });
