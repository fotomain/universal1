// "Custom recurrence" window (forai: PeriodismDayScreen / WeekScreen / MonthScreen / YearScreen):
// repeat every N day / week / month / year · week: repeat on days · month: on day N / on the n-th weekday ·
// ends never / on a date / after N occurrences.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ModalWindowListToSelect, SelectDateApp } from '../../../components/common';
import IconApp from '../../../components/common/IconApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import {
  addDays,
  dayFromKey,
  dayKey,
  MONTH_SHORT,
  nthWeekdayOf,
  UserCalendarRecurrence,
  UserCalendarRepeatUnit,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
} from '../../../register/user_calendar';
import { CalButton, CalInput, CalValueButton, CalWindow } from './calendarUi';

const UNITS: UserCalendarRepeatUnit[] = ['day', 'week', 'month', 'year'];
const ORDINALS = ['first', 'second', 'third', 'fourth', 'last'];
const shortDate = (key: string) => {
  const d = dayFromKey(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

interface Props {
  visible: boolean;
  /** start of the entry: default weekday / day of the month */
  start: Date;
  value: UserCalendarRecurrence | null | undefined;
  onDone: (value: UserCalendarRecurrence) => void;
  onClose: () => void;
}

export default function UserCalendarRecurrenceModal({ visible, start, value, onDone, onClose }: Props) {
  const { themeColors: c } = useDesignSystem();
  const [draft, setDraft] = useState<UserCalendarRecurrence>({ freq: 'week', interval: 1, weekdays: [start.getDay()], end: { type: 'never' } });
  const [intervalText, setIntervalText] = useState('1');
  const [countText, setCountText] = useState('10');
  const [endDate, setEndDate] = useState(dayKey(addDays(start, 30)));
  const [menu, setMenu] = useState<'unit' | 'monthly' | null>(null);

  useEffect(() => {
    if (!visible) return;
    const v: UserCalendarRecurrence = value ? { ...value } : { freq: 'week', interval: 1, weekdays: [start.getDay()], end: { type: 'never' } };
    if (v.freq === 'week' && !(v.weekdays && v.weekdays.length)) v.weekdays = [start.getDay()];
    setDraft(v);
    setIntervalText(String(v.interval || 1));
    setCountText(String(v.end.type === 'after' ? v.end.count : 10));
    setEndDate(v.end.type === 'on' ? v.end.date : dayKey(addDays(start, v.freq === 'year' ? 365 * 5 : v.freq === 'month' ? 365 : v.freq === 'week' ? 91 : 30)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const plural = (Number(intervalText) || 1) > 1 ? 's' : '';
  const toggleDay = (d: number) => {
    const days = new Set(draft.weekdays || []);
    if (days.has(d)) {
      if (days.size > 1) days.delete(d); // at least one day stays
    } else days.add(d);
    setDraft({ ...draft, weekdays: [...days].sort((a, b) => a - b) });
  };
  const done = () => {
    const interval = Math.max(1, Math.min(999, Math.floor(Number(intervalText) || 1)));
    const end = draft.end.type === 'after' ? { type: 'after' as const, count: Math.max(1, Math.min(999, Math.floor(Number(countText) || 1))) } : draft.end.type === 'on' ? { type: 'on' as const, date: endDate } : { type: 'never' as const };
    onDone({ ...draft, interval, end, weekdays: draft.freq === 'week' ? draft.weekdays : undefined, monthlyMode: draft.freq === 'month' ? draft.monthlyMode || 'dayOfMonth' : undefined });
  };

  const radio = (type: 'never' | 'on' | 'after', label: string, extra?: React.ReactNode) => {
    const selected = draft.end.type === type;
    return (
      <View style={styles.endRow}>
        <Pressable
          testID={`user-calendar-recurrence-end-${type}`}
          accessibilityRole="radio"
          accessibilityState={{ selected }}
          onPress={() => setDraft({ ...draft, end: type === 'never' ? { type } : type === 'on' ? { type, date: endDate } : { type, count: Number(countText) || 1 } })}
          style={styles.radio}
        >
          <IconApp name={selected ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={selected ? c.primary : c.text} />
          <Text style={{ color: c.text, fontSize: 15, marginLeft: 10, width: 54 }}>{label}</Text>
        </Pressable>
        <View style={{ opacity: selected ? 1 : 0.45, flexDirection: 'row', alignItems: 'center' }} pointerEvents={selected ? 'auto' : 'none'}>
          {extra}
        </View>
      </View>
    );
  };

  return (
    <CalWindow
      visible={visible}
      onClose={onClose}
      color={c}
      maxWidth={420}
      testID="user-calendar-recurrence"
      header={<Text style={{ color: c.text, fontSize: 18, fontWeight: '600', marginLeft: 8, flex: 1 }}>Custom recurrence</Text>}
      footer={
        <>
          <CalButton label="Cancel" onPress={onClose} color={c} testID="user-calendar-recurrence-cancel" />
          <CalButton label="Done" primary onPress={done} color={c} testID="user-calendar-recurrence-done" />
        </>
      }
    >
      <Text style={[styles.caption, { color: c.text }]}>Repeat every</Text>
      <View style={styles.line}>
        <CalInput testID="user-calendar-recurrence-interval" color={c} value={intervalText} onChangeText={(t) => setIntervalText(t.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="numeric" selectTextOnFocus style={{ width: 60, textAlign: 'center', marginRight: 8, marginBottom: 6 }} />
        <CalValueButton testID="user-calendar-recurrence-unit" label={`${draft.freq}${plural}`} onPress={() => setMenu('unit')} color={c} />
      </View>

      {draft.freq === 'week' && (
        <>
          <Text style={[styles.caption, { color: c.text }]}>Repeat on</Text>
          <View style={styles.line}>
            {/* Monday first, as on the reference screens */}
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = (draft.weekdays || []).includes(d);
              return (
                <Pressable
                  key={d}
                  testID={`user-calendar-recurrence-day-${d}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={WEEKDAY_NAMES[d]}
                  onPress={() => toggleDay(d)}
                  style={[styles.day, { backgroundColor: on ? c.primary : 'transparent', borderColor: on ? c.primary : c.border }]}
                >
                  <Text style={{ color: on ? '#fff' : c.text, fontWeight: '700', fontSize: 12 }}>{WEEKDAY_LETTERS[d]}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {draft.freq === 'month' && (
        <View style={styles.line}>
          <CalValueButton
            testID="user-calendar-recurrence-monthly"
            label={draft.monthlyMode === 'nthWeekday' ? `Monthly on the ${ORDINALS[nthWeekdayOf(start)]} ${WEEKDAY_NAMES[start.getDay()]}` : `Monthly on day ${start.getDate()}`}
            onPress={() => setMenu('monthly')}
            color={c}
          />
        </View>
      )}

      <Text style={[styles.caption, { color: c.text, marginTop: 10 }]}>Ends</Text>
      {radio('never', 'Never')}
      {radio(
        'on',
        'On',
        <SelectDateApp
          testID="user-calendar-recurrence-end-date"
          value={dayFromKey(endDate)}
          validRange={{ startDate: start }}
          onSelect={(d) => {
            if (!d) return;
            setEndDate(dayKey(d));
            setDraft((p) => ({ ...p, end: { type: 'on', date: dayKey(d) } }));
          }}
        >
          {({ open }) => <CalValueButton label={shortDate(endDate)} onPress={open} color={c} icon="calendar_today" />}
        </SelectDateApp>
      )}
      {radio(
        'after',
        'After',
        <>
          <CalInput testID="user-calendar-recurrence-count" color={c} value={countText} onChangeText={(t) => setCountText(t.replace(/[^0-9]/g, '').slice(0, 3))} keyboardType="numeric" selectTextOnFocus style={{ width: 60, textAlign: 'center' }} />
          <Text style={{ color: c.text, marginLeft: 8, fontSize: 14 }}>occurrence{(Number(countText) || 1) > 1 ? 's' : ''}</Text>
        </>
      )}

      <ModalWindowListToSelect
        testID="user-calendar-recurrence-unit-list"
        visible={menu === 'unit'}
        title="Repeat every"
        items={UNITS.map((u) => ({ id: u, title: `${u}${plural}` }))}
        selectedId={draft.freq}
        onSelect={(id) => {
          const freq = id as UserCalendarRepeatUnit;
          setDraft({ ...draft, freq, weekdays: freq === 'week' ? (draft.weekdays && draft.weekdays.length ? draft.weekdays : [start.getDay()]) : draft.weekdays });
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />
      <ModalWindowListToSelect
        testID="user-calendar-recurrence-monthly-list"
        visible={menu === 'monthly'}
        title="Monthly"
        items={[
          { id: 'dayOfMonth', title: `Monthly on day ${start.getDate()}` },
          { id: 'nthWeekday', title: `Monthly on the ${ORDINALS[nthWeekdayOf(start)]} ${WEEKDAY_NAMES[start.getDay()]}` },
        ]}
        selectedId={draft.monthlyMode || 'dayOfMonth'}
        onSelect={(id) => {
          setDraft({ ...draft, monthlyMode: id as 'dayOfMonth' | 'nthWeekday' });
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />
    </CalWindow>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 13, opacity: 0.75, marginBottom: 6, marginTop: 4 },
  line: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  day: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 6 },
  endRow: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  radio: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, marginRight: 8 },
});
