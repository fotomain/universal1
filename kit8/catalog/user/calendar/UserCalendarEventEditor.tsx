// Editor window of a calendar entry: Event / Task / Birthday (forai: CalendarEventDesktopScreen,
// CalendarAllDayMode, mobile_portrait "Add title" screens). Full screen on phones, a card on desktop.
//
//   title · kind chips · all-day · start / end (date + time) · repeat (presets + custom recurrence) ·
//   notifications · guests (+ e-mail invitations) · location · description · deadline (task) · color ·
//   more actions: duplicate / sql_for_delete
// Project tasks (kind 'projectTask') are copies made by the database: their title and dates are
// changed in the project; here the user adds reminders, guests and a color.

import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ModalWindowListToSelect, SelectDateApp, SwitchApp } from '../../../ui/components/common';
import IconApp from '../../../ui/components/common/IconApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import {
  addDays,
  dateAtTime,
  dayFromKey,
  dayKey,
  defaultNotifications,
  eventRange,
  isInvitationEmailConfigured,
  isValidEmail,
  MONTH_SHORT,
  parseTimeText,
  recurrenceLabel,
  recurrencePresets,
  timeText,
  USER_CALENDAR_COLORS,
  USER_CALENDAR_KIND_COLORS,
  USER_CALENDAR_KIND_LABELS,
  UserCalendarEventJSON,
  UserCalendarKind,
  UserCalendarNotification,
  WEEKDAY_SHORT,
  withEventDates,
} from '../../../register/user_calendar';
import { CalButton, CalChip, CalDivider, CalIconButton, CalInput, CalRow, CalValueButton, CalWindow, CalendarColors } from './calendarUi';
import UserCalendarRecurrenceModal from './UserCalendarRecurrenceModal';
import { useUserCalendarActions } from './useUserCalendarActions';
import { useUserCalendarUiStore } from './userCalendarUiStore';

const KINDS: UserCalendarKind[] = ['event', 'task', 'birthday'];
const UNITS: UserCalendarNotification['unit'][] = ['minutes', 'hours', 'days', 'weeks'];
/** start and end date buttons have one width, so they form one column */
const DATE_BUTTON_WIDTH = 176;
const dateLabel = (d: Date) => `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;

/** 'HH:MM' field: accepts 9, 930, 9:30 ...; the value is applied when the field loses focus. */
function TimeField({ value, onChange, color, testID }: { value: string; onChange: (hhmm: string) => void; color: CalendarColors; testID: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const apply = () => {
    const t = parseTimeText(text);
    if (t && t !== value) onChange(t);
    else setText(value);
  };
  return <CalInput testID={testID} color={color} value={text} onChangeText={setText} onBlur={apply} onSubmitEditing={apply} keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'} selectTextOnFocus maxLength={5} style={{ width: 70, textAlign: 'center', marginRight: 8, marginBottom: 6 }} />;
}

export default function UserCalendarEventEditor() {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const editor = useUserCalendarUiStore((s) => s.editor);
  const close = useUserCalendarUiStore((s) => s.closeEditor);
  const actions = useUserCalendarActions();
  const [draft, setDraft] = useState<UserCalendarEventJSON | null>(null);
  const [guestText, setGuestText] = useState('');
  const [sendInvitations, setSendInvitations] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menu, setMenu] = useState<'repeat' | 'more' | { unitOf: number } | null>(null);
  const [customRepeat, setCustomRepeat] = useState(false);

  useEffect(() => {
    setDraft(editor ? { ...editor.draft } : null);
    setGuestText('');
    setSendInvitations(true);
    setSaving(false);
    setMenu(null);
    setCustomRepeat(false);
  }, [editor]);

  const range = useMemo(() => (draft ? eventRange(draft) : { startMs: 0, endMs: 0 }), [draft]);
  if (!editor || !draft) return null;

  const existing = editor.row;
  const isProjectTask = draft.kind === 'projectTask';
  const start = new Date(range.startMs);
  const endExclusive = new Date(range.endMs);
  /** last day shown to the user (all-day entries end on an inclusive day) */
  const lastDay = draft.allDay ? addDays(endExclusive, -1) : endExclusive;
  const patch = (p: Partial<UserCalendarEventJSON>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const setDates = (s: Date, e: Date, allDay = draft.allDay) => setDraft((d) => (d ? withEventDates(d, s, e, allDay) : d));

  const setKind = (kind: UserCalendarKind) => {
    if (kind === draft.kind) return;
    const allDay = kind === 'birthday' ? true : draft.kind === 'birthday' ? false : draft.allDay;
    let next: UserCalendarEventJSON = { ...draft, kind };
    const s = allDay ? start : draft.allDay ? dateAtTime(start, '09:00') : start;
    next = withEventDates(next, s, allDay ? addDays(s, 1) : new Date(s.getTime() + (kind === 'task' ? 30 : 60) * 60000), allDay);
    next.recurrence = kind === 'birthday' ? { freq: 'year', interval: 1, end: { type: 'never' } } : draft.kind === 'birthday' ? null : draft.recurrence;
    next.notifications = defaultNotifications(kind, allDay);
    if (kind === 'task') next.done = !!draft.done;
    setDraft(next);
  };

  const setAllDay = (allDay: boolean) => {
    if (allDay) setDates(start, addDays(dayFromKey(dayKey(lastDay)), 1), true);
    else {
      const s = dateAtTime(start, '09:00');
      setDates(s, new Date(s.getTime() + 3600000), false);
    }
    patch({ notifications: defaultNotifications(draft.kind, allDay) });
  };
  const setStartDay = (d: Date) => {
    const s = draft.allDay ? d : dateAtTime(d, timeText(start));
    setDates(s, new Date(s.getTime() + (range.endMs - range.startMs)));
  };
  const setEndDay = (d: Date) => {
    if (draft.allDay) return setDates(d < start ? d : start, addDays(d < start ? start : d, 1));
    const e = dateAtTime(d, timeText(endExclusive));
    setDates(start, e > start ? e : new Date(start.getTime() + 3600000));
  };
  const setStartTime = (t: string) => {
    const s = dateAtTime(start, t);
    setDates(s, new Date(s.getTime() + (range.endMs - range.startMs)));
  };
  const setEndTime = (t: string) => {
    let e = dateAtTime(endExclusive, t);
    // an end before the start means "the same day" or, when that is still too early, the next day
    if (e <= start) e = dateAtTime(start, t);
    if (e <= start) e = dateAtTime(addDays(start, 1), t);
    setDates(start, e);
  };

  const notifications = draft.notifications || [];
  const setNotification = (i: number, p: Partial<UserCalendarNotification>) => patch({ notifications: notifications.map((n, k) => (k === i ? { ...n, ...p } : n)) });
  const addNotification = () => patch({ notifications: [...notifications, draft.allDay ? { amount: 1, unit: 'days', atTime: '09:00' } : { amount: 10, unit: 'minutes' }] });

  const guests = draft.guests || [];
  const addGuest = () => {
    const emails = guestText.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(isValidEmail);
    if (!emails.length) return;
    const known = new Set(guests.map((g) => g.email.toLowerCase()));
    patch({ guests: [...guests, ...emails.filter((e) => !known.has(e)).map((email) => ({ email, status: 'new' as const }))] });
    setGuestText('');
  };
  const newGuests = guests.filter((g) => g.status !== 'sent').length + (isValidEmail(guestText) ? 1 : 0);

  const presets = recurrencePresets(start);
  const repeatText = recurrenceLabel(draft.recurrence, start);

  const save = async () => {
    if (saving) return;
    // a guest typed but not added yet still counts
    let json = draft;
    const typed = guestText.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(isValidEmail);
    if (typed.length) {
      const known = new Set(guests.map((g) => g.email.toLowerCase()));
      json = { ...json, guests: [...guests, ...typed.filter((e) => !known.has(e)).map((email) => ({ email, status: 'new' as const }))] };
    }
    json = { ...json, title: json.title.trim() || (json.kind === 'birthday' ? 'Birthday' : '(No title)') };
    // web: ask once for the permission to show reminders as browser notifications (needs a user action)
    if (Platform.OS === 'web' && typeof Notification !== 'undefined' && Notification.permission === 'default' && (json.notifications || []).length) {
      void Notification.requestPermission().catch(() => {});
    }
    setSaving(true);
    const saved = await actions.save(json, existing, { sendInvitations: sendInvitations && (json.guests || []).some((g) => g.status !== 'sent') });
    setSaving(false);
    if (saved) close();
  };

  const moreItems = [
    ...(isProjectTask ? [{ id: 'openTask', title: 'Open the project task', icon: 'open_in_new' }] : []),
    { id: 'duplicate', title: isProjectTask ? 'Copy as a calendar task' : 'Duplicate', icon: 'content_copy' },
    ...(isProjectTask ? [] : [{ id: 'delete', title: 'Delete', icon: 'delete', color: c.error }]),
  ];
  const onMore = async (id: string) => {
    setMenu(null);
    if (!existing) return;
    if (id === 'openTask') {
      close();
      router.push({ pathname: '/pm/project/task', params: { taskGUID: draft.projectTaskGUID || '', projectGUID: draft.projectGUID || '' } } as any);
    } else if (id === 'duplicate') {
      close();
      await actions.duplicate(existing);
    } else if (id === 'delete') {
      close();
      await actions.remove(existing);
    }
  };

  return (
    <CalWindow
      visible
      onClose={close}
      color={c}
      testID="user-calendar-editor"
      header={
        <>
          <CalIconButton icon="close" label="Close without saving" onPress={close} color={c} testID="user-calendar-editor-close" />
          <View style={{ flex: 1 }} />
          {!!existing && <CalIconButton icon="more_vert" label="More actions" onPress={() => setMenu('more')} color={c} testID="user-calendar-editor-more" />}
          <CalButton label={saving ? 'Saving…' : 'Save'} primary disabled={saving} onPress={save} color={c} testID="user-calendar-editor-save" />
        </>
      }
    >
      <CalInput
        testID="user-calendar-editor-title"
        color={c}
        value={draft.title}
        onChangeText={(title) => patch({ title })}
        placeholder={draft.kind === 'birthday' ? 'Add name' : 'Add title'}
        editable={!isProjectTask}
        autoFocus={!existing && Platform.OS === 'web'}
        style={{ fontSize: 22, minHeight: 46, borderWidth: 0, borderBottomWidth: 1, borderRadius: 0, backgroundColor: 'transparent', marginBottom: 10 }}
      />

      <View style={styles.wrap}>
        {isProjectTask ? (
          <CalChip label={`Project task${draft.projectTitle ? ` · ${draft.projectTitle}` : ''}`} selected color={c} dot={USER_CALENDAR_KIND_COLORS.projectTask} />
        ) : (
          KINDS.map((k) => <CalChip key={k} testID={`user-calendar-editor-kind-${k}`} label={USER_CALENDAR_KIND_LABELS[k]} selected={draft.kind === k} onPress={() => setKind(k)} color={c} />)
        )}
      </View>
      {isProjectTask && <Text style={{ color: c.text, opacity: 0.65, fontSize: 12.5, marginBottom: 4 }}>The name and the dates follow the project plan. Reminders, guests and the color are yours.</Text>}
      <CalDivider color={c} />

      {/* ---- when ---- */}
      <CalRow icon="schedule" color={c}>
        {draft.kind !== 'birthday' && !isProjectTask && (
          <View style={[styles.line, { justifyContent: 'space-between', marginBottom: 6 }]}>
            <Text style={{ color: c.text, fontSize: 15 }}>All-day</Text>
            <SwitchApp testID="user-calendar-editor-allday" value={draft.allDay} onValueChange={setAllDay} />
          </View>
        )}
        <View style={styles.wrap} pointerEvents={isProjectTask ? 'none' : 'auto'}>
          <SelectDateApp testID="user-calendar-editor-start-date" value={start} onSelect={(d) => d && setStartDay(d)}>
            {({ open }) => <CalValueButton testID="user-calendar-editor-start-date-btn" label={dateLabel(start)} onPress={open} color={c} icon="calendar_today" width={DATE_BUTTON_WIDTH} />}
          </SelectDateApp>
          {!draft.allDay && <TimeField testID="user-calendar-editor-start-time" value={timeText(start)} onChange={setStartTime} color={c} />}
          {/* "to" closes the start line, so the two dates stay one under the other (one column) */}
          {(draft.kind === 'event' || isProjectTask) && <Text style={{ color: c.text, opacity: 0.7, marginBottom: 6, alignSelf: 'center' }}>to</Text>}
        </View>
        {(draft.kind === 'event' || isProjectTask) && (
          <View style={styles.wrap} pointerEvents={isProjectTask ? 'none' : 'auto'}>
            <SelectDateApp testID="user-calendar-editor-end-date" value={lastDay} validRange={{ startDate: dayFromKey(dayKey(start)) }} onSelect={(d) => d && setEndDay(d)}>
              {({ open }) => <CalValueButton testID="user-calendar-editor-end-date-btn" label={dateLabel(lastDay)} onPress={open} color={c} icon="calendar_today" width={DATE_BUTTON_WIDTH} />}
            </SelectDateApp>
            {!draft.allDay && <TimeField testID="user-calendar-editor-end-time" value={timeText(endExclusive)} onChange={setEndTime} color={c} />}
          </View>
        )}
      </CalRow>

      {!isProjectTask && (
        <CalRow icon="repeat" color={c}>
          <View style={styles.wrap}>
            <CalValueButton testID="user-calendar-editor-repeat" label={repeatText} onPress={() => setMenu('repeat')} color={c} />
          </View>
        </CalRow>
      )}

      {draft.kind === 'task' && (
        <CalRow icon="flag" color={c}>
          <View style={styles.wrap}>
            <SelectDateApp testID="user-calendar-editor-deadline" value={draft.deadline ? dayFromKey(draft.deadline) : start} onSelect={(d) => d && patch({ deadline: dayKey(d) })}>
              {({ open }) => <CalValueButton label={draft.deadline ? `Deadline: ${dateLabel(dayFromKey(draft.deadline))}` : 'Add deadline'} onPress={open} color={c} icon="calendar_today" />}
            </SelectDateApp>
            {!!draft.deadline && <CalIconButton icon="close" label="Remove the deadline" onPress={() => patch({ deadline: null })} color={c} />}
          </View>
          <View style={[styles.line, { justifyContent: 'space-between' }]}>
            <Text style={{ color: c.text, fontSize: 15 }}>Completed</Text>
            <SwitchApp testID="user-calendar-editor-done" value={!!draft.done} onValueChange={(done) => patch({ done })} />
          </View>
        </CalRow>
      )}
      <CalDivider color={c} />

      {/* ---- notifications ---- */}
      <CalRow icon="notifications" color={c}>
        {notifications.map((n, i) => (
          <View key={i} style={styles.wrap}>
            <CalInput
              testID={`user-calendar-editor-notification-amount-${i}`}
              color={c}
              value={String(n.amount)}
              onChangeText={(t) => setNotification(i, { amount: Math.min(999, Number(t.replace(/[^0-9]/g, '')) || 0) })}
              keyboardType="numeric"
              selectTextOnFocus
              style={{ width: 56, textAlign: 'center', marginRight: 8, marginBottom: 6 }}
            />
            <CalValueButton testID={`user-calendar-editor-notification-unit-${i}`} label={n.unit} onPress={() => setMenu({ unitOf: i })} color={c} />
            {draft.allDay && (
              <>
                <Text style={{ color: c.text, opacity: 0.7, marginRight: 8, marginBottom: 6, alignSelf: 'center' }}>before at</Text>
                <TimeField testID={`user-calendar-editor-notification-time-${i}`} value={n.atTime || '09:00'} onChange={(atTime) => setNotification(i, { atTime })} color={c} />
              </>
            )}
            <CalIconButton icon="close" label="Remove the notification" onPress={() => patch({ notifications: notifications.filter((_, k) => k !== i) })} color={c} testID={`user-calendar-editor-notification-remove-${i}`} />
          </View>
        ))}
        {notifications.length < 5 && (
          <Pressable testID="user-calendar-editor-notification-add" accessibilityRole="button" onPress={addNotification} style={{ paddingVertical: 8 }}>
            <Text style={{ color: c.primary, fontWeight: '600' }}>Add notification</Text>
          </Pressable>
        )}
      </CalRow>
      <CalDivider color={c} />

      {/* ---- guests + e-mail invitations ---- */}
      <CalRow icon="group" color={c}>
        <View style={styles.line}>
          <CalInput
            testID="user-calendar-editor-guest-input"
            color={c}
            value={guestText}
            onChangeText={setGuestText}
            onSubmitEditing={addGuest}
            placeholder={draft.kind === 'event' ? 'Add guests (e-mail)' : 'Invite by e-mail'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1 }}
          />
          <CalIconButton icon="add" label="Add the guest" onPress={addGuest} color={c} tint={c.primary} disabled={!guestText.trim()} testID="user-calendar-editor-guest-add" />
        </View>
        {guests.map((g) => (
          <View key={g.email} style={[styles.line, { marginTop: 4 }]}>
            <IconApp name={g.status === 'sent' ? 'mark_email_read' : g.status === 'failed' ? 'error' : 'mail'} size={16} color={g.status === 'failed' ? c.error : g.status === 'sent' ? c.primary : c.text} />
            <Text numberOfLines={1} style={{ color: c.text, flex: 1, marginLeft: 8, fontSize: 14 }}>
              {g.email}
              <Text style={{ opacity: 0.6, fontSize: 12 }}>{g.status === 'sent' ? '  · invited' : g.status === 'failed' ? '  · not sent' : ''}</Text>
            </Text>
            <CalIconButton icon="close" label={`Remove ${g.email}`} onPress={() => patch({ guests: guests.filter((x) => x.email !== g.email) })} color={c} />
          </View>
        ))}
        {newGuests > 0 && (
          <View style={[styles.line, { justifyContent: 'space-between', marginTop: 6 }]}>
            <Text style={{ color: c.text, fontSize: 14, flex: 1 }}>
              Send the invitation by e-mail on save{isInvitationEmailConfigured() ? '' : ' (EXPO_PUBLIC_RESEND_API_KEY is missing in .env)'}
            </Text>
            <SwitchApp testID="user-calendar-editor-send-invitations" value={sendInvitations} onValueChange={setSendInvitations} />
          </View>
        )}
      </CalRow>
      <CalDivider color={c} />

      {draft.kind === 'event' && (
        <CalRow icon="location_on" color={c}>
          <CalInput testID="user-calendar-editor-location" color={c} value={draft.location || ''} onChangeText={(location) => patch({ location })} placeholder="Add location" />
        </CalRow>
      )}
      <CalRow icon="notes" color={c}>
        <CalInput
          testID="user-calendar-editor-description"
          color={c}
          value={draft.description || ''}
          onChangeText={(description) => patch({ description })}
          placeholder={draft.kind === 'event' ? 'Add description' : 'Add details'}
          multiline
          editable={!isProjectTask}
          style={{ minHeight: 84, textAlignVertical: 'top' }}
        />
      </CalRow>
      {!!draft.intent && (draft.intent.intentURL || draft.intent.intentText) && (
        <CalRow icon="link" color={c}>
          <Text selectable numberOfLines={3} style={{ color: c.primary, fontSize: 13, paddingTop: 8 }}>{draft.intent.intentURL || draft.intent.intentText}</Text>
        </CalRow>
      )}
      <CalRow icon="palette" color={c}>
        <View style={[styles.wrap, { paddingTop: 4 }]}>
          <Pressable testID="user-calendar-editor-color-default" accessibilityLabel="Default color" onPress={() => patch({ color: null })} style={[styles.swatch, { backgroundColor: USER_CALENDAR_KIND_COLORS[draft.kind], borderColor: !draft.color ? c.text : 'transparent' }]}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>A</Text>
          </Pressable>
          {USER_CALENDAR_COLORS.map((color) => (
            <Pressable key={color} testID={`user-calendar-editor-color-${color}`} accessibilityLabel={`Color ${color}`} onPress={() => patch({ color })} style={[styles.swatch, { backgroundColor: color, borderColor: draft.color === color ? c.text : 'transparent' }]} />
          ))}
        </View>
      </CalRow>

      {/* ---- menus ---- */}
      <ModalWindowListToSelect
        testID="user-calendar-editor-repeat-list"
        visible={menu === 'repeat'}
        title="Repeat"
        items={[...presets.map((p) => ({ id: p.id, title: p.label })), { id: 'custom', title: 'Custom…' }]}
        selectedId={presets.find((p) => recurrenceLabel(p.recurrence, start) === repeatText)?.id || 'custom'}
        onSelect={(id) => {
          setMenu(null);
          if (id === 'custom') return setCustomRepeat(true);
          patch({ recurrence: presets.find((p) => p.id === id)?.recurrence || null, exDates: [] });
        }}
        onClose={() => setMenu(null)}
      />
      <ModalWindowListToSelect
        testID="user-calendar-editor-unit-list"
        visible={!!menu && typeof menu === 'object'}
        title="Notification"
        items={(draft.allDay ? UNITS.slice(2) : UNITS).map((u) => ({ id: u, title: `${u} before` }))}
        selectedId={menu && typeof menu === 'object' ? notifications[menu.unitOf]?.unit : null}
        onSelect={(id) => {
          if (menu && typeof menu === 'object') setNotification(menu.unitOf, { unit: id as UserCalendarNotification['unit'] });
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />
      <ModalWindowListToSelect testID="user-calendar-editor-more-list" visible={menu === 'more'} title="More actions" items={moreItems} onSelect={onMore} onClose={() => setMenu(null)} />
      <UserCalendarRecurrenceModal
        visible={customRepeat}
        start={start}
        value={draft.recurrence}
        onClose={() => setCustomRepeat(false)}
        onDone={(recurrence) => {
          setCustomRepeat(false);
          patch({ recurrence, exDates: [] });
        }}
      />
    </CalWindow>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  swatch: { width: 26, height: 26, borderRadius: 13, marginRight: 8, marginBottom: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
