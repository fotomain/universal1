// PMFactNewDocumentModal - "New document" of the Actuals list: the project and the task, then task_fact_document_create makes the document with ALL the lines of the task.
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useDesignSystem } from '../../providers/WithDesignSystem';
import ButtonApp from '../../ui/components/common/ButtonApp';
import SelectItemFromListApp from '../../ui/components/common/SelectItemFromListApp';
import { pmT } from '../i18n/pmT';
import { useFactProjects } from './useFactDocumentList';
import { useFactTasks } from './useFactTasks';

export interface PMFactNewDocumentModalProps {
  visible: boolean;
  /** the project is fixed (the list of one project) */
  projectGUID?: string | null;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onCreate: (taskGUID: string, projectGUID: string) => void;
  testID?: string;
}

export default function PMFactNewDocumentModal({ visible, projectGUID, busy = false, error, onCancel, onCreate, testID = 'fact-new' }: PMFactNewDocumentModalProps) {
  const { themeColors: c } = useDesignSystem();
  const projects = useFactProjects();
  const [project, setProject] = useState(projectGUID || '');
  const [task, setTask] = useState('');
  const tasks = useFactTasks(project);
  useEffect(() => { if (visible) { setProject(projectGUID || ''); setTask(''); } }, [visible, projectGUID]);
  useEffect(() => setTask(''), [project]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View testID={testID} style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{pmT('New fact document')}</Text>
          <Text style={{ color: c.text, opacity: 0.7, fontSize: 12 }}>{pmT('All the lines of the task go into the new document.')}</Text>
          {!projectGUID && (
            <SelectItemFromListApp testID={`${testID}-project`} label={pmT('Project')} items={projects.map((p) => ({ value: p.guid, label: p.name }))} value={project} onSelect={setProject} placeholder={pmT('Project')} />
          )}
          <SelectItemFromListApp testID={`${testID}-task`} label={pmT('Task')} items={tasks.map((t) => ({ value: t.guid, label: t.name }))} value={task} onSelect={setTask} placeholder={pmT('Task')} disabled={!project} />
          {!!error && <Text testID={`${testID}-error`} style={{ color: c.error, fontSize: 12 }}>{error}</Text>}
          <View style={styles.buttons}>
            <ButtonApp testID={`${testID}-cancel`} title={pmT('Cancel')} variant="text" onPress={onCancel} />
            <ButtonApp testID={`${testID}-create`} title={pmT('Create')} icon="add" disabled={!task || busy} loading={busy} onPress={() => onCreate(task, project)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
});
