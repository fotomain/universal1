// PMTaskTemplateWindows - mount ONCE per screen (PMProjectDashboard, PMProjectTaskInfo):
//   * "Save to template" / "Rename template"   title + description
//   * "Fill from template"                     the picker: the templates of the ORGANIZATION (search), "Replace what the row has now", rename / delete of your own templates

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import IconApp from '../../../ui/components/common/IconApp';
import { PMDialogButton } from '../../inner/buttons/PMDialogButton';
import { pmT } from '../../i18n/pmT';
import { usePMStore } from '../../store/store_pm';
import { usePMTaskTemplateStore } from '../store/store_task_template';
import { PMTaskTemplateCommands, useTaskTemplateCommands, useTaskTemplatesQuery } from '../crud/useTaskTemplates';
import {
  describeTaskTemplate,
  PM_TASK_TEMPLATE_BIG_FROM,
  PM_TASK_TEMPLATE_DESCRIPTION_MAX,
  PM_TASK_TEMPLATE_TITLE_MAX,
  PMTaskTemplateRow,
  templateCreatorLabel,
} from '../model/taskTemplateTypes';

export default function PMTaskTemplateWindows({ ownerGUID, projectGUID }: { ownerGUID: string; projectGUID: string | null }) {
  const commands = useTaskTemplateCommands(ownerGUID, projectGUID);
  return (
    <>
      <SavePromptWindow commands={commands} />
      <FillPickerWindow commands={commands} ownerGUID={ownerGUID} />
    </>
  );
}

// ---- Save to template / Rename template ------------------------------------------------------------------------------------------------------------------------------------------
function SavePromptWindow({ commands }: { commands: PMTaskTemplateCommands }) {
  const { themeColors: c } = useDesignSystem();
  const prompt = usePMTaskTemplateStore((s) => s.savePrompt);
  const busy = usePMTaskTemplateStore((s) => s.busy);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(prompt?.title ?? '');
    setDescription(prompt?.description ?? '');
    setError(null);
  }, [prompt]);

  if (!prompt) return null;
  const renaming = prompt.mode === 'rename';
  const close = () => commands.closeSavePrompt();
  const submit = async () => {
    if (busy) return;
    const problem = commands.validateTitle(title);
    if (problem) {
      setError(problem);
      return;
    }
    const ok = renaming && prompt.templateGUID ? await commands.renameTemplate(prompt.templateGUID, title, description) : !!(prompt.taskGUID && (await commands.saveTemplate(prompt.taskGUID, title, description)));
    if (ok) close();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={pmT('Cancel')} />
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} testID="pm-task-template-save-window">
          <View style={styles.header}>
            <View style={[styles.iconBubble, { backgroundColor: `${c.primary}1f` }]}>
              <IconApp testID="pm-task-template-save-icon" name={renaming ? 'edit' : 'library_add'} size={20} color={c.primary} />
            </View>
            <Text style={[styles.title, { color: c.text }]} testID="pm-task-template-save-heading">
              {renaming ? 'Rename template' : 'Save to template'}
            </Text>
          </View>
          <Text style={[styles.label, { color: c.text }]}>{pmT('Template title')}</Text>
          <TextInput
            testID="pm-task-template-title-input"
            value={title}
            onChangeText={(t) => {
              setTitle(t.slice(0, PM_TASK_TEMPLATE_TITLE_MAX));
              setError(null);
            }}
            placeholder={pmT('e.g. Concrete foundation')}
            placeholderTextColor={`${c.text}66`}
            autoFocus
            selectTextOnFocus
            maxLength={PM_TASK_TEMPLATE_TITLE_MAX}
            onSubmitEditing={submit}
            onKeyPress={(e) => {
              if ((e.nativeEvent as any).key === 'Escape') close();
            }}
            style={[styles.input, { color: c.text, borderColor: error ? c.error : c.border, backgroundColor: c.background }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          />
          {!!error && (
            <Text testID="pm-task-template-title-error" style={[styles.error, { color: c.error }]}>
              {error}
            </Text>
          )}
          <Text style={[styles.label, { color: c.text }]}>{pmT('Description (optional)')}</Text>
          <TextInput
            testID="pm-task-template-description-input"
            value={description}
            onChangeText={(t) => setDescription(t.slice(0, PM_TASK_TEMPLATE_DESCRIPTION_MAX))}
            multiline
            maxLength={PM_TASK_TEMPLATE_DESCRIPTION_MAX}
            placeholder={pmT('What is it for?')}
            placeholderTextColor={`${c.text}66`}
            style={[styles.input, styles.multiline, { color: c.text, borderColor: c.border, backgroundColor: c.background }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          />
          {!renaming && (
            <Text style={[styles.hint, { color: c.text }]}>
              {pmT('The row, everything inside it, its dependencies and its task lines are stored for every user of your organization. Dates, posted plans, documents and the sums in the project currencies are not.')}
            </Text>
          )}
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-task-template-save-cancel" kind="secondary" title={pmT('Cancel')} color={c.text} onPress={close} />
            <PMDialogButton testID="pm-task-template-save-ok" kind="primary" icon={renaming ? 'check' : 'library_add'} title={renaming ? 'Rename' : 'Save template'} loading={busy} disabled={busy} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Fill from template ----------------------------------------------------------------------------------------------------------------------------------------------------------
function FillPickerWindow({ commands, ownerGUID }: { commands: PMTaskTemplateCommands; ownerGUID: string }) {
  const { themeColors: c } = useDesignSystem();
  const fillGUID = usePMTaskTemplateStore((s) => s.fillPickerTaskGUID);
  const savedGUID = usePMTaskTemplateStore((s) => s.savedListTaskGUID);
  // "Templates saved" = the same window as a LIST of the templates saved from this task (no Replace, no Fill)
  const saved = !!savedGUID;
  const taskGUID = savedGUID ?? fillGUID;
  const busy = usePMTaskTemplateStore((s) => s.busy);
  const task = usePMStore((s) => (taskGUID ? s.tasksById[taskGUID] : undefined));
  const query = useTaskTemplatesQuery(!!taskGUID);
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [replace, setReplace] = useState(false);

  useEffect(() => {
    if (taskGUID) {
      setText('');
      setSelected(null);
      setReplace(false);
    }
  }, [taskGUID]);

  const allRows = query.data?.rows ?? [];
  const rows = useMemo(() => (saved ? allRows.filter((r) => r.rowJSON.templateSourceTaskGUID === taskGUID) : allRows), [allRows, saved, taskGUID]);
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.rowJSON.templateTitle} ${r.rowJSON.templateDescription ?? ''} ${describeTaskTemplate(r)}`.toLowerCase().includes(q));
  }, [rows, text]);

  if (!taskGUID) return null;
  const close = () => (saved ? commands.closeSavedList() : commands.closeFillPicker());
  const chosen: PMTaskTemplateRow | undefined = rows.find((r) => r.rowGUID === selected);
  const fill = async () => {
    if (!chosen || busy) return;
    const result = await commands.fillTask(chosen, taskGUID, replace);
    if (result) close();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={pmT('Cancel')} />
        <View style={[styles.card, styles.pickerCard, { backgroundColor: c.surface, borderColor: c.border }]} testID={saved ? 'pm-task-template-saved-window' : 'pm-task-template-fill-window'}>
          <View style={styles.header}>
            <View style={[styles.iconBubble, { backgroundColor: `${c.primary}1f` }]}>
              <IconApp testID="pm-task-template-fill-icon" name="content_paste_go" size={20} color={c.primary} />
            </View>
            <Text style={[styles.title, { color: c.text }]} testID={saved ? 'pm-task-template-saved-heading' : 'pm-task-template-fill-heading'}>
              {saved ? pmT('Templates saved') : pmT('Fill from template')}
            </Text>
          </View>
          <Text style={[styles.hint, { color: c.text }]}>
            {saved
              ? `${task ? `${task.rowJSON.taskDescription}: ` : ''}${pmT('the templates saved from this task, for every user of the organization.')}`
              : `${task ? `${pmT('Into')}: ${task.rowJSON.taskDescription}. ` : ''}${pmT('A template of one task adds its lines and data to the row; a template of a stage creates its rows inside the row.')}`}
          </Text>
          <TextInput
            testID="pm-task-template-search"
            value={text}
            onChangeText={setText}
            placeholder={pmT('Search a template…')}
            placeholderTextColor={`${c.text}66`}
            style={[styles.input, { marginTop: 10, color: c.text, borderColor: c.border, backgroundColor: c.background }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          />
          <ScrollView style={styles.list} testID="pm-task-template-list">
            {query.isLoading && <Text style={[styles.empty, { color: c.text }]}>{pmT('Loading…')}</Text>}
            {query.data?.missing && <Text style={[styles.empty, { color: c.error }]}>{pmT('The task template tables are missing: run start1_sql_tables.sql and start2_sql_code.sql (PART 40).')}</Text>}
            {!query.isLoading && !query.data?.missing && shown.length === 0 && (
              <Text testID="pm-task-template-empty" style={[styles.empty, { color: c.text }]}>
                {rows.length === 0 ? (saved ? pmT('Nothing was saved from this task yet. Use Templates → Save to template.') : pmT('No task templates saved yet. Use "Save to template" in the menu of a task.')) : pmT('Nothing found')}
              </Text>
            )}
            {shown.map((r) => {
              const mine = r.rowOwnerGUID === ownerGUID;
              const on = r.rowGUID === selected;
              return (
                <Pressable
                  key={r.rowGUID}
                  testID={`pm-task-template-row-${r.rowGUID}`}
                  onPress={() => setSelected(r.rowGUID)}
                  style={[styles.row, { borderColor: on ? c.primary : c.border, backgroundColor: on ? `${c.primary}14` : 'transparent' }]}
                >
                  <IconApp name={r.rowJSON.templateKind === 'stage' ? 'folder' : r.rowJSON.templateKind === 'milestone' ? 'flag' : 'task_alt'} size={20} color={c.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.rowTitle, { color: c.text }]} numberOfLines={1}>{r.rowJSON.templateTitle}</Text>
                    <Text style={[styles.rowSub, { color: c.text }]} numberOfLines={2}>
                      {[describeTaskTemplate(r), templateCreatorLabel(r, ownerGUID)].filter(Boolean).join(' · ')}
                    </Text>
                    {!!r.rowJSON.templateDescription && <Text style={[styles.rowSub, { color: c.text }]} numberOfLines={2}>{r.rowJSON.templateDescription}</Text>}
                  </View>
                  {mine && (
                    <>
                      <Pressable testID={`pm-task-template-rename-${r.rowGUID}`} accessibilityLabel={pmT('Rename')} hitSlop={8} onPress={() => commands.openRename(r)} style={styles.rowIcon}>
                        <IconApp name="edit" size={18} color={c.text} />
                      </Pressable>
                      <Pressable testID={`pm-task-template-delete-${r.rowGUID}`} accessibilityLabel={pmT('Delete')} hitSlop={8} onPress={async () => { if (await commands.removeTemplate(r) && selected === r.rowGUID) setSelected(null); }} style={styles.rowIcon}>
                        <IconApp name="delete" size={18} color={c.error} />
                      </Pressable>
                    </>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
          {!saved && !!chosen && chosen.rowJSON.templateRowCount > PM_TASK_TEMPLATE_BIG_FROM && (
            <Text testID="pm-task-template-big-note" style={[styles.hint, { color: c.text }]}>
              {pmT('A big template: filling it takes a few seconds.')}
            </Text>
          )}
          {!saved && (
            <Pressable testID="pm-task-template-replace" onPress={() => setReplace(!replace)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: replace }}>
              <IconApp name={replace ? 'check_box' : 'check_box_outline_blank'} size={22} color={replace ? c.primary : c.text} />
              <Text style={[styles.checkText, { color: c.text }]}>{pmT('Replace what the row has now')}</Text>
            </Pressable>
          )}
          <View style={styles.actions}>
            <View style={{ flex: 1 }} />
            <PMDialogButton testID="pm-task-template-fill-cancel" kind="secondary" title={saved ? pmT('Close') : pmT('Cancel')} color={c.text} onPress={close} />
            {!saved && <PMDialogButton testID="pm-task-template-fill-ok" kind="primary" icon="content_paste_go" title={pmT('Fill')} loading={busy} disabled={busy || !chosen} onPress={fill} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  pickerCard: { maxWidth: 520, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'center' },
  iconBubble: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 16, fontWeight: '700' },
  label: { marginTop: 14, marginBottom: 6, fontSize: 12, fontWeight: '600', opacity: 0.7 },
  input: { height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 14 },
  multiline: { height: 72, paddingTop: 8, textAlignVertical: 'top' },
  error: { marginTop: 6, fontSize: 12 },
  hint: { marginTop: 8, fontSize: 12, opacity: 0.6 },
  list: { marginTop: 10, minHeight: 120, maxHeight: 320 },
  empty: { padding: 16, fontSize: 13, opacity: 0.7, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, opacity: 0.65, marginTop: 2 },
  rowIcon: { padding: 6, marginLeft: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  checkText: { marginLeft: 8, fontSize: 14 },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
});
