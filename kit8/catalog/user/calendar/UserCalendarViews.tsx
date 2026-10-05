// The four views of the user calendar: Month grid · Week / Day time grid · Agenda list.
// Plain React Native views (the same code on web, Android and iOS, portrait and landscape).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import IconApp from '../../../components/common/IconApp';
import {
  addDays,
  DAY_MS,
  dayKey,
  MONTH_NAMES,
  startOfDay,
  timeText,
  UserCalendarEventRow,
  UserCalendarOccurrence,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
} from '../../../register/user_calendar';
import type { CalendarColors } from './calendarUi';

export interface UserCalendarViewProps {
  occurrences: UserCalendarOccurrence[];
  color: CalendarColors;
  colorOf: (row: UserCalendarEventRow) => string;
  onOpen: (occurrence: UserCalendarOccurrence) => void;
  /** new entry at this local time (allDay = a day cell was tapped) */
  onNewAt: (start: Date, allDay: boolean) => void;
  onShowDay: (day: Date) => void;
  onToggleDone: (row: UserCalendarEventRow) => void;
}

/** Monday-first weeks. */
export const startOfWeek = (d: Date | number) => {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
};

const isDone = (o: UserCalendarOccurrence) => !!o.row.rowJSON.done && o.row.rowJSON.kind !== 'event';
const isTaskLike = (o: UserCalendarOccurrence) => o.row.rowJSON.kind === 'task' || o.row.rowJSON.kind === 'projectTask';

/** Occurrences per local day ('YYYY-MM-DD'); an entry of several days is in each of them. */
function byDay(occurrences: UserCalendarOccurrence[]): Record<string, UserCalendarOccurrence[]> {
  const map: Record<string, UserCalendarOccurrence[]> = {};
  for (const o of occurrences) {
    const last = startOfDay(Math.max(o.startMs, o.endMs - 1)).getTime();
    let guard = 0;
    for (let d = startOfDay(o.startMs); d.getTime() <= last && guard < 62; d = addDays(d, 1), guard++) (map[dayKey(d)] ||= []).push(o);
  }
  Object.values(map).forEach((list) => list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startMs - b.startMs));
  return map;
}

/** One line of an entry (month cells, all-day band). */
function Chip({ o, p, compact }: { o: UserCalendarOccurrence; p: UserCalendarViewProps; compact?: boolean }) {
  const bg = p.colorOf(o.row);
  const solid = o.allDay || o.row.rowJSON.kind === 'birthday';
  return (
    <Pressable
      testID={`user-calendar-chip-${o.key}`}
      accessibilityRole="button"
      accessibilityLabel={o.row.rowJSON.title}
      onPress={() => p.onOpen(o)}
      style={[styles.chip, { backgroundColor: solid ? bg : 'transparent', opacity: isDone(o) ? 0.55 : 1 }]}
    >
      {!solid && <View style={[styles.chipDot, { backgroundColor: bg }]} />}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: compact ? 10.5 : 11.5, color: solid ? '#fff' : p.color.text, textDecorationLine: isDone(o) ? 'line-through' : 'none' }}>
        {!solid && !compact ? `${timeText(o.startMs)} ` : ''}
        {o.row.rowJSON.title || '(No title)'}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------------------------
export function UserCalendarMonthView({ anchor, ...p }: UserCalendarViewProps & { anchor: Date }) {
  const [rowH, setRowH] = useState(90);
  const first = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const map = useMemo(() => byDay(p.occurrences), [p.occurrences]);
  const today = dayKey(new Date());
  const lines = Math.max(1, Math.floor((rowH - 24) / 17));
  const c = p.color;
  return (
    <View style={{ flex: 1 }} testID="user-calendar-month">
      <View style={{ flexDirection: 'row' }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Text key={i} style={[styles.weekday, { color: c.text }]}>{WEEKDAY_SHORT[(i + 1) % 7]}</Text>
        ))}
      </View>
      {[0, 1, 2, 3, 4, 5].map((w) => (
        <View key={w} style={{ flex: 1, flexDirection: 'row' }} onLayout={w === 0 ? (e) => setRowH(e.nativeEvent.layout.height) : undefined}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const day = addDays(first, w * 7 + i);
            const key = dayKey(day);
            const list = map[key] || [];
            const shown = list.length > lines ? list.slice(0, Math.max(0, lines - 1)) : list;
            const other = day.getMonth() !== anchor.getMonth();
            return (
              <Pressable
                key={key}
                testID={`user-calendar-month-day-${key}`}
                accessibilityLabel={`${day.getDate()} ${MONTH_NAMES[day.getMonth()]}, ${list.length} entries`}
                onPress={() => p.onNewAt(day, true)}
                style={[styles.monthCell, { borderColor: c.border, backgroundColor: other ? `${c.border}33` : 'transparent' }]}
              >
                <Pressable onPress={() => p.onShowDay(day)} hitSlop={4} style={[styles.dayNumber, key === today ? { backgroundColor: c.primary } : null]}>
                  <Text style={{ fontSize: 12, fontWeight: key === today ? '800' : '500', color: key === today ? '#fff' : c.text, opacity: other ? 0.5 : 1 }}>{day.getDate()}</Text>
                </Pressable>
                {shown.map((o) => <Chip key={o.key + key} o={o} p={p} compact />)}
                {list.length > shown.length && (
                  <Pressable onPress={() => p.onShowDay(day)} testID={`user-calendar-month-more-${key}`}>
                    <Text style={{ fontSize: 10.5, color: c.text, opacity: 0.7, paddingHorizontal: 4 }}>+{list.length - shown.length} more</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Week / Day (time grid)
// ---------------------------------------------------------------------------------------------
const HOUR_H = 48;
const GUTTER = 44;

/** Side-by-side columns for entries that overlap in time. */
function layoutDay(list: UserCalendarOccurrence[], dayStart: number) {
  const dayEnd = dayStart + DAY_MS;
  const items = list
    .filter((o) => !o.allDay)
    .map((o) => ({ o, s: Math.max(o.startMs, dayStart), e: Math.min(Math.max(o.endMs, o.startMs + 20 * 60000), dayEnd), col: 0, cols: 1 }))
    .sort((a, b) => a.s - b.s || b.e - a.e);
  let cluster: typeof items = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((i) => i.col + 1));
    cluster.forEach((i) => (i.cols = cols));
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length && item.s >= clusterEnd) flush();
    const used = new Set(cluster.filter((i) => i.e > item.s).map((i) => i.col));
    let col = 0;
    while (used.has(col)) col++;
    item.col = col;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.e);
  }
  flush();
  return items;
}

export function UserCalendarTimeGridView({ days, ...p }: UserCalendarViewProps & { days: Date[] }) {
  const c = p.color;
  const map = useMemo(() => byDay(p.occurrences), [p.occurrences]);
  const scrollRef = useRef<ScrollView>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const today = dayKey(nowMs);
  const firstKey = dayKey(days[0]);
  useEffect(() => {
    // open at the working hours (or one hour before now, for today)
    const hour = days.some((d) => dayKey(d) === dayKey(new Date())) ? Math.max(0, new Date().getHours() - 1) : 7;
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: hour * HOUR_H, animated: false }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstKey, days.length]);
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const maxAllDay = Math.min(3, Math.max(0, ...days.map((d) => (map[dayKey(d)] || []).filter((o) => o.allDay).length)));

  return (
    <View style={{ flex: 1 }} testID="user-calendar-timegrid">
      {/* ---- day headers + all-day band ---- */}
      <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }}>
        <View style={{ width: GUTTER }} />
        {days.map((day) => {
          const key = dayKey(day);
          const allDay = (map[key] || []).filter((o) => o.allDay);
          return (
            <View key={key} style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
              <Pressable onPress={() => p.onShowDay(day)} style={{ alignItems: 'center', paddingVertical: 4 }} testID={`user-calendar-timegrid-head-${key}`}>
                <Text style={{ fontSize: 11, color: key === today ? c.primary : c.text, opacity: key === today ? 1 : 0.7 }}>{days.length === 1 ? WEEKDAY_NAMES[day.getDay()] : WEEKDAY_SHORT[day.getDay()]}</Text>
                <View style={[styles.headNumber, key === today ? { backgroundColor: c.primary } : null]}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: key === today ? '#fff' : c.text }}>{day.getDate()}</Text>
                </View>
              </Pressable>
              <Pressable onPress={() => p.onNewAt(day, true)} style={{ minHeight: maxAllDay * 19 + 4 }} accessibilityLabel="New all-day entry">
                {allDay.slice(0, 3).map((o) => <Chip key={o.key + key} o={o} p={p} compact={days.length > 1} />)}
                {allDay.length > 3 && <Text style={{ fontSize: 10.5, color: c.text, opacity: 0.7, paddingHorizontal: 4 }}>+{allDay.length - 3} more</Text>}
              </Pressable>
            </View>
          );
        })}
      </View>
      {/* ---- hours ---- */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ flexDirection: 'row', height: 24 * HOUR_H }}>
        <View style={{ width: GUTTER }}>
          {Array.from({ length: 24 }, (_, h) => (
            <Text key={h} style={{ position: 'absolute', top: h * HOUR_H - 7, right: 6, fontSize: 10.5, color: c.text, opacity: 0.65 }}>{h ? `${String(h).padStart(2, '0')}:00` : ''}</Text>
          ))}
        </View>
        {days.map((day) => {
          const key = dayKey(day);
          const dayStart = day.getTime();
          const items = layoutDay(map[key] || [], dayStart);
          return (
            <Pressable
              key={key}
              testID={`user-calendar-timegrid-day-${key}`}
              accessibilityLabel={`New entry on ${day.getDate()} ${MONTH_NAMES[day.getMonth()]}`}
              style={{ flex: 1, minWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: c.border }}
              onPress={(e) => {
                // half-hour slot under the finger
                const minutes = Math.max(0, Math.min(23 * 60 + 30, Math.floor(((e.nativeEvent as any).locationY ?? (e.nativeEvent as any).offsetY ?? 0) / (HOUR_H / 2)) * 30));
                p.onNewAt(new Date(dayStart + minutes * 60000), false);
              }}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <View key={h} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: h * HOUR_H, height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />
              ))}
              {items.map(({ o, s, e, col, cols }) => {
                const top = ((s - dayStart) / 3600000) * HOUR_H;
                const height = Math.max(18, ((e - s) / 3600000) * HOUR_H - 2);
                const bg = p.colorOf(o.row);
                return (
                  <Pressable
                    key={o.key}
                    testID={`user-calendar-block-${o.key}`}
                    accessibilityRole="button"
                    accessibilityLabel={o.row.rowJSON.title}
                    onPress={() => p.onOpen(o)}
                    style={[styles.block, { top, height, left: `${(col / cols) * 100}%`, width: `${100 / cols}%`, backgroundColor: bg, opacity: isDone(o) ? 0.55 : 1 }]}
                  >
                    <Text numberOfLines={height > 34 ? 2 : 1} style={{ color: '#fff', fontSize: 11.5, fontWeight: '600', textDecorationLine: isDone(o) ? 'line-through' : 'none' }}>
                      {isTaskLike(o) ? '✓ ' : ''}
                      {o.row.rowJSON.title || '(No title)'}
                    </Text>
                    {height > 34 && <Text numberOfLines={1} style={{ color: '#fff', fontSize: 10, opacity: 0.9 }}>{timeText(o.startMs)}{o.row.rowJSON.kind === 'task' ? '' : ` – ${timeText(o.endMs)}`}</Text>}
                  </Pressable>
                );
              })}
              {key === today && (
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ((nowMs - dayStart) / 3600000) * HOUR_H - 1, height: 2, backgroundColor: c.error }} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------------------------
export function UserCalendarAgendaView({ from, days, ...p }: UserCalendarViewProps & { from: Date; days: number }) {
  const c = p.color;
  const map = useMemo(() => byDay(p.occurrences), [p.occurrences]);
  const today = dayKey(new Date());
  const list = useMemo(() => {
    const out: { day: Date; key: string; items: UserCalendarOccurrence[] }[] = [];
    for (let i = 0; i < days; i++) {
      const day = addDays(from, i);
      const key = dayKey(day);
      if (map[key]?.length) out.push({ day, key, items: map[key] });
    }
    return out;
  }, [map, from, days]);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, paddingBottom: 90 }} testID="user-calendar-agenda">
      {list.length === 0 && <Text style={{ color: c.text, opacity: 0.6, textAlign: 'center', marginTop: 40 }}>Nothing planned in the next {days} days.</Text>}
      {list.map(({ day, key, items }) => (
        <View key={key} style={{ flexDirection: 'row', marginBottom: 12 }}>
          <Pressable onPress={() => p.onShowDay(day)} style={{ width: 54, alignItems: 'center' }}>
            <Text style={{ fontSize: 11, color: key === today ? c.primary : c.text, opacity: key === today ? 1 : 0.7 }}>{WEEKDAY_SHORT[day.getDay()]}</Text>
            <View style={[styles.headNumber, key === today ? { backgroundColor: c.primary } : null]}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: key === today ? '#fff' : c.text }}>{day.getDate()}</Text>
            </View>
            <Text style={{ fontSize: 10, color: c.text, opacity: 0.6 }}>{MONTH_NAMES[day.getMonth()].slice(0, 3)}</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            {items.map((o) => (
              <Pressable key={o.key + key} testID={`user-calendar-agenda-${o.key}`} accessibilityRole="button" onPress={() => p.onOpen(o)} style={[styles.agendaItem, { backgroundColor: p.colorOf(o.row), opacity: isDone(o) ? 0.55 : 1 }]}>
                {o.row.rowJSON.kind === 'task' && (
                  <Pressable hitSlop={8} onPress={() => p.onToggleDone(o.row)} accessibilityRole="checkbox" accessibilityState={{ checked: !!o.row.rowJSON.done }} accessibilityLabel="Completed" style={{ marginRight: 8 }}>
                    <IconApp name={o.row.rowJSON.done ? 'check_circle' : 'radio_button_unchecked'} size={20} color="#fff" />
                  </Pressable>
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ color: '#fff', fontWeight: '600', fontSize: 14, textDecorationLine: isDone(o) ? 'line-through' : 'none' }}>{o.row.rowJSON.title || '(No title)'}</Text>
                  <Text numberOfLines={1} style={{ color: '#fff', fontSize: 12, opacity: 0.9 }}>
                    {o.allDay ? 'All day' : `${timeText(o.startMs)}${o.row.rowJSON.kind === 'task' ? '' : ` – ${timeText(o.endMs)}`}`}
                    {o.row.rowJSON.projectTitle ? ` · ${o.row.rowJSON.projectTitle}` : ''}
                    {o.row.rowJSON.location ? ` · ${o.row.rowJSON.location}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, opacity: 0.7, paddingVertical: 4 },
  monthCell: { flex: 1, minWidth: 0, borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, overflow: 'hidden', paddingHorizontal: 1 },
  dayNumber: { alignSelf: 'center', minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  headNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', height: 16, borderRadius: 4, paddingHorizontal: 3, marginBottom: 1, marginHorizontal: 1, overflow: 'hidden' },
  chipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 3 },
  block: { position: 'absolute', borderRadius: 5, paddingHorizontal: 4, paddingVertical: 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  agendaItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 5 },
});
