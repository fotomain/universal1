// Quick view of a calendar entry (forai: CalendarEventOn1ClickView): opened by a tap on an entry and
// by a reminder ("auto notifications": the entry opens as a modal window on web and mobile).
// Buttons: edit · sql_for_delete (this one / all, for repeating entries) · e-mail the guests · more · close.

import React, { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ModalWindowListToSelect } from '../../../ui/components/common';
import IconApp from '../../../ui/components/common/IconApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { colorOfEvent, eventWhenText, notificationLabel, recurrenceLabel, USER_CALENDAR_KIND_LABELS } from '../../../register/user_calendar';
import { CalButton, CalIconButton, CalWindow } from './calendarUi';
import { useUserCalendarActions } from './useUserCalendarActions';
import { useUserCalendarUiStore } from './userCalendarUiStore';

export default function UserCalendarEventView() {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const view = useUserCalendarUiStore((s) => s.view);
  const close = useUserCalendarUiStore((s) => s.closeView);
  const openEditor = useUserCalendarUiStore((s) => s.openEditor);
  const actions = useUserCalendarActions();
  const [menu, setMenu] = useState<'delete' | 'more' | null>(null);
  if (!view) return null;

  const { occurrence, reminder } = view;
  const row = occurrence.row;
  const j = row.rowJSON;
  const isProjectTask = j.kind === 'projectTask';
  const isTask = j.kind === 'task';
  const guests = j.guests || [];
  const link = j.intent?.intentURL || '';

  const edit = () => openEditor({ row, draft: j });
  const openProjectTask = () => {
    close();
    router.push({ pathname: '/pm/project/task', params: { taskGUID: j.projectTaskGUID || '', projectGUID: j.projectGUID || '' } } as any);
  };
  const onDelete = () => {
    if (j.recurrence) return setMenu('delete');
    close();
    void actions.remove(row);
  };
  const info = (icon: string, text: string, key?: string) => (
    <View key={key || icon} style={styles.info}>
      <IconApp name={icon} size={18} color={c.text} />
      <Text selectable style={{ color: c.text, fontSize: 14, marginLeft: 14, flex: 1 }}>{text}</Text>
    </View>
  );

  return (
    <CalWindow
      visible
      onClose={close}
      color={c}
      maxWidth={460}
      testID="user-calendar-view"
      header={
        <>
          {!!reminder && (
            <View style={[styles.reminder, { backgroundColor: `${c.primary}22` }]}>
              <IconApp name="notifications_active" size={16} color={c.primary} />
              <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12.5, marginLeft: 6 }}>Reminder · {reminder.label}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <CalIconButton icon="edit" label="Edit" onPress={edit} color={c} testID="user-calendar-view-edit" />
          {!isProjectTask && <CalIconButton icon="delete" label="Delete" onPress={onDelete} color={c} testID="user-calendar-view-delete" />}
          {guests.length > 0 && (
            <CalIconButton
              icon="mail"
              label="E-mail the invitation to the guests"
              color={c}
              testID="user-calendar-view-invite"
              onPress={() => {
                close();
                void actions.invite(row, true);
              }}
            />
          )}
          <CalIconButton icon="more_vert" label="More actions" onPress={() => setMenu('more')} color={c} testID="user-calendar-view-more" />
          <CalIconButton icon="close" label="Close" onPress={close} color={c} testID="user-calendar-view-close" />
        </>
      }
      footer={
        isTask || isProjectTask || reminder ? (
          <>
            {isProjectTask && <CalButton label="Open task" onPress={openProjectTask} color={c} testID="user-calendar-view-open-task" />}
            {isTask && (
              <CalButton
                label={j.done ? 'Mark uncompleted' : 'Mark completed'}
                primary={!j.done}
                color={c}
                testID="user-calendar-view-done"
                onPress={() => {
                  close();
                  void actions.setDone(row, !j.done);
                }}
              />
            )}
            {!!reminder && <CalButton label="OK" primary={!isTask} onPress={close} color={c} testID="user-calendar-view-ok" />}
          </>
        ) : undefined
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={[styles.square, { backgroundColor: colorOfEvent(j) }]} />
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: c.text, fontSize: 21, fontWeight: '500', textDecorationLine: j.done && j.kind !== 'event' ? 'line-through' : 'none' }}>
            {j.title || '(No title)'}
          </Text>
          <Text style={{ color: c.text, fontSize: 14, marginTop: 4 }}>{eventWhenText(row, occurrence.startMs, occurrence.endMs)}</Text>
          {!!j.recurrence && <Text style={{ color: c.text, fontSize: 14, opacity: 0.8 }}>{recurrenceLabel(j.recurrence, new Date(occurrence.startMs))}</Text>}
        </View>
      </View>
      <View style={{ marginTop: 14 }}>
        {info('event', `${USER_CALENDAR_KIND_LABELS[j.kind]}${isProjectTask && j.projectTitle ? ` · ${j.projectTitle}` : ''}${isProjectTask ? ` · ${Math.round(Number(j.rowProgress) || 0)}%` : ''}`)}
        {!!j.deadline && info('flag', `Deadline: ${j.deadline}`)}
        {!!j.location && info('location_on', j.location)}
        {(j.notifications || []).map((n, i) => info('notifications', notificationLabel(n, j.allDay), `n${i}`))}
        {guests.length > 0 && info('group', guests.map((g) => `${g.email}${g.status === 'sent' ? ' (invited)' : g.status === 'failed' ? ' (not sent)' : ''}`).join('\n'))}
        {!!j.description && info('notes', j.description)}
        {!!link && (
          <Pressable testID="user-calendar-view-link" accessibilityRole="link" onPress={() => Linking.openURL(link).catch(() => {})} style={styles.info}>
            <IconApp name="link" size={18} color={c.primary} />
            <Text numberOfLines={2} style={{ color: c.primary, fontSize: 14, marginLeft: 14, flex: 1 }}>{link}</Text>
          </Pressable>
        )}
        {!!j.googleEventId && info('sync', 'Synchronised with Google Calendar')}
      </View>

      <ModalWindowListToSelect
        testID="user-calendar-view-delete-list"
        visible={menu === 'delete'}
        title="Delete the repeating entry"
        items={[
          { id: 'one', title: 'This one', icon: 'event_busy' },
          { id: 'all', title: 'All of them', icon: 'delete_sweep', color: c.error },
        ]}
        onSelect={(id) => {
          setMenu(null);
          close();
          void actions.remove(row, id === 'one' ? occurrence.startMs : undefined);
        }}
        onClose={() => setMenu(null)}
      />
      <ModalWindowListToSelect
        testID="user-calendar-view-more-list"
        visible={menu === 'more'}
        title="More actions"
        items={[
          { id: 'duplicate', title: isProjectTask ? 'Copy as a calendar task' : 'Duplicate', icon: 'content_copy' },
          ...(isProjectTask ? [{ id: 'openTask', title: 'Open the project task', icon: 'open_in_new' }] : [{ id: 'delete', title: 'Delete', icon: 'delete', color: c.error }]),
        ]}
        onSelect={(id) => {
          setMenu(null);
          if (id === 'duplicate') {
            close();
            void actions.duplicate(row);
          } else if (id === 'openTask') openProjectTask();
          else onDelete();
        }}
        onClose={() => setMenu(null)}
      />
    </CalWindow>
  );
}

const styles = StyleSheet.create({
  square: { width: 16, height: 16, borderRadius: 4, marginTop: 7, marginRight: 14 },
  info: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7 },
  reminder: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 30, borderRadius: 15, marginLeft: 6 },
});
