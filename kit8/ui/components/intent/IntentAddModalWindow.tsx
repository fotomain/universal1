// "What to add?" - opens when another app shared something into this app (uxui.intentInfo with
// intentStatus 'new', set by kit8/providers/WithIntent.tsx). RadioSetApp asks what to add:
//
//   Project task / Project stage  -> the new task screen (/pm/project/task/new): asks the project and
//                                    the stage, adds the row with rowJSON.intent, then opens the
//                                    dashboard scrolled to it
//   Calendar task                 -> the calendar with the editor open (rowJSON.intent kept)
//   Media post                    -> the post is created and the media posts list opens on it; the
//                                    post type (YouTube / web page / local file / text) is detected
//                                    and can be corrected here before adding
// Mounted once in app/_layout.tsx. Works on every platform (the share itself is mobile only).

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RadioSetApp, { RadioSetOption } from '../RadioSetApp';
import IconApp from '../common/IconApp';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { SystemMetaData } from '../../../redux/SystemMetaData';
import { setIntentInfo, showSnackbar, updateIntentInfo, UxuiIntentInfo, UxuiIntentPostType, UxuiIntentTarget } from '../../../redux/uxuiSlice';
import { newEventJSON } from '../../../register/user_calendar/userCalendarModel';
import { useUserCalendarUiStore } from '../../../catalog/user/calendar/userCalendarUiStore';
import { intentLinkOf, intentMediaPostRow, intentTitleAndNotes } from './intentInfo';

const TARGETS: RadioSetOption<UxuiIntentTarget>[] = [
  { id: 'projectTask', label: 'Project task', description: 'Choose the project and the stage on the next screen', icon: 'task_alt' },
  { id: 'projectStage', label: 'Project stage', description: 'A new stage of a project', icon: 'create_new_folder' },
  { id: 'calendarTask', label: 'Calendar task', description: 'A to-do in your calendar, with a reminder', icon: 'event_available' },
  { id: 'mediaPost', label: 'Media post', description: 'Keep it in the media posts list', icon: 'perm_media' },
];

const POST_TYPES: RadioSetOption<UxuiIntentPostType>[] = [
  { id: 'youtube', label: 'YouTube', icon: 'smart_display' },
  { id: 'webpage', label: 'Web page', icon: 'language' },
  { id: 'file', label: 'Local file', icon: 'attach_file' },
  { id: 'text', label: 'Text', icon: 'notes' },
];

export default function IntentAddModalWindow() {
  const { themeColors: c } = useDesignSystem();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useDispatch();
  const info = useSelector((s: any) => (s.uxuiState?.intentInfo as UxuiIntentInfo | null) || null);
  const postOwnerGUID = useSelector((s: any) => String(s.activeUserState?.activeUserGUID || ''));
  const [target, setTarget] = useState<UxuiIntentTarget>('projectTask');
  const [postType, setPostType] = useState<UxuiIntentPostType>('webpage');

  const visible = !!info && info.intentStatus === 'new';
  const intentGUID = info?.intentGUID;
  useEffect(() => {
    if (!info) return;
    setPostType(info.intentPostType);
    // a video link or a file is most often kept as a media post; plain text as a task
    setTarget(info.intentPostType === 'text' ? 'projectTask' : 'mediaPost');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentGUID]);

  if (!visible || !info) return null;

  const hasURL = !!info.intentURL && /^https?:\/\//i.test(info.intentURL);
  const hasFiles = info.intentFiles.length > 0;
  // only the types the shared content can be
  const postTypes = POST_TYPES.map((o) => ({ ...o, disabled: (o.id === 'youtube' || o.id === 'webpage' ? !hasURL : o.id === 'file' ? !hasFiles : false) }));
  const cancel = () => dispatch(setIntentInfo(null));

  const add = () => {
    if (target === 'projectTask' || target === 'projectStage') {
      dispatch(updateIntentInfo({ intentStatus: 'routed', intentTarget: target }));
      router.push('/pm/project/task/new' as any);
      return;
    }
    if (target === 'calendarTask') {
      const { title, notes } = intentTitleAndNotes(info);
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      const draft = { ...newEventJSON('task', start), title, description: notes, intent: intentLinkOf(info) };
      dispatch(setIntentInfo(null));
      router.push('/user/calendar' as any);
      useUserCalendarUiStore.getState().openEditor({ draft });
      return;
    }
    // media post
    const createOne = (SystemMetaData as any)?.mediaPostReusable?.actions?.createOne;
    if (!createOne) {
      dispatch(showSnackbar('Media posts are not available.'));
      return;
    }
    const row = intentMediaPostRow(info, postType, postOwnerGUID);
    dispatch(createOne(row));
    dispatch(setIntentInfo(null));
    router.push({ pathname: '/posts/mediapostcrud', params: { scrollToGUID: row.rowGUID } } as any);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={cancel} statusBarTranslucent supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} accessibilityLabel="Cancel" />
        <View testID="intent-add-window" style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border, paddingBottom: 14 + insets.bottom }]}>
          <View style={styles.header}>
            <IconApp name="ios_share" size={20} color={c.primary} />
            <Text style={{ color: c.text, fontSize: 17, fontWeight: '700', marginLeft: 10, flex: 1 }}>Add to the app</Text>
            <Pressable testID="intent-add-close" onPress={cancel} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
              <IconApp name="close" size={22} color={c.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 6 }}>
            <View style={[styles.shared, { borderColor: c.border, backgroundColor: c.background }]}>
              {!!info.intentTitle && <Text numberOfLines={2} style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{info.intentTitle}</Text>}
              {!!info.intentURL && <Text numberOfLines={2} style={{ color: c.primary, fontSize: 12.5, marginTop: 2 }}>{info.intentURL}</Text>}
              <Text style={{ color: c.text, opacity: 0.6, fontSize: 11.5, marginTop: 3 }}>
                {info.intentMIME || ''}
                {hasFiles ? ` · ${info.intentFiles.length} file${info.intentFiles.length === 1 ? '' : 's'}` : ''}
              </Text>
            </View>
            <RadioSetApp testID="intent-add-target" title="What to add?" options={TARGETS} value={target} onChange={setTarget} />
            {target === 'mediaPost' && <RadioSetApp testID="intent-add-post-type" title="Post type" options={postTypes} value={postType} onChange={setPostType} horizontal style={{ marginTop: 6 }} />}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable testID="intent-add-cancel" onPress={cancel} accessibilityRole="button" style={[styles.button, { borderWidth: 1, borderColor: c.border }]}>
              <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable testID="intent-add-ok" onPress={add} accessibilityRole="button" style={[styles.button, { backgroundColor: c.primary }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{target === 'mediaPost' ? 'Add' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  shared: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 14 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  button: { height: 40, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
