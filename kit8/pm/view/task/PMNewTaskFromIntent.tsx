// New task screen (route /pm/project/task/new). Opened by the share intent window ("Project task" /
// "Project stage" in RadioSetApp) and usable on its own:
//   asks the name, task or stage, the PROJECT and the STAGE (may be empty = directly under the project),
//   adds the row to the project (rowJSON.intent = { intentURL, intentMIME, ... } when it comes from a
//   share), then opens the dashboard with the new row selected and scrolled into view.

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import RadioSetApp from '../../../components/RadioSetApp';
import { ButtonPrimaryApp, ButtonTextApp, ModalWindowListToSelect } from '../../../components/common';
import { intentLinkOf, intentTitleAndNotes } from '../../../components/intent/intentInfo';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { setIntentInfo, showSnackbar, UxuiIntentInfo } from '../../../redux/uxuiSlice';
import { errorMessage } from '../../crud/api/apiUtils';
import { pmKeys, usePMApi, usePMOwnerGUID, useReadProjectsQuery } from '../../crud/queries';
import { PM_ROUTES } from '../../model/constants';
import { usePMStore } from '../../store/store_pm';

type Kind = 'task' | 'stage';

export default function PMNewTaskFromIntent() {
  const { themeColors: c } = useDesignSystem();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const api = usePMApi();
  const ownerGUID = usePMOwnerGUID();
  const intent = useSelector((s: any) => (s.uxuiState?.intentInfo as UxuiIntentInfo | null) || null);
  const projectsQuery = useReadProjectsQuery(ownerGUID || null);
  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const [projectGUID, setProjectGUID] = useState<string | null>(usePMStore.getState().selectedProjectGUID);
  const [stageGUID, setStageGUID] = useState<string | null>(null);
  const [menu, setMenu] = useState<'project' | 'stage' | null>(null);
  const [saving, setSaving] = useState(false);

  // prefill from the shared content (once per share)
  const intentGUID = intent?.intentGUID;
  useEffect(() => {
    if (!intent) return;
    const t = intentTitleAndNotes(intent);
    setName(t.title);
    setNotes(t.notes);
    setKind(intent.intentTarget === 'projectStage' ? 'stage' : 'task');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentGUID]);

  // the remembered project may be gone / belong to another user
  useEffect(() => {
    if (!projects.length) return;
    if (!projectGUID || !projects.some((p) => p.rowGUID === projectGUID)) setProjectGUID(projects.length === 1 ? projects[0].rowGUID : null);
  }, [projects, projectGUID]);

  const dataQuery = useQuery({
    queryKey: ['pm', 'newTaskStages', projectGUID],
    queryFn: () => api.readProjectData(projectGUID as string),
    enabled: !!projectGUID,
  });
  const tasks = useMemo(() => dataQuery.data?.tasks || [], [dataQuery.data]);
  const stages = useMemo(
    () =>
      tasks
        .filter((t) => t.rowJSON.rowKind === 'stage')
        .sort((a, b) => a.treePath.localeCompare(b.treePath))
        // treePath = project.stage.substage ... -> indent by depth
        .map((t) => ({ id: t.rowGUID, title: `${'    '.repeat(Math.max(0, t.treePath.split('.').length - 2))}${t.rowJSON.name || 'Stage'}`, icon: 'folder' })),
    [tasks]
  );
  useEffect(() => {
    if (stageGUID && !tasks.some((t) => t.rowGUID === stageGUID)) setStageGUID(null);
  }, [tasks, stageGUID]);

  const project = projects.find((p) => p.rowGUID === projectGUID);
  const stage = tasks.find((t) => t.rowGUID === stageGUID);
  const canSave = !!ownerGUID && !!projectGUID && !!name.trim() && !saving && !dataQuery.isLoading;

  const cancel = () => {
    if (intent) dispatch(setIntentInfo(null));
    if (router.canGoBack()) router.back();
    else router.replace(PM_ROUTES.dashboard as any);
  };

  const save = async () => {
    if (!canSave || !projectGUID) return;
    setSaving(true);
    try {
      // last among its siblings (the children of the stage, or the rows directly under the project)
      const parentPath = stage ? stage.treePath : null;
      const depth = (stage ? stage.treePath.split('.').length : 1) + 1;
      const siblings = tasks.filter((t) => t.treePath.split('.').length === depth && (stage ? t.treePath.startsWith(`${stage.treePath}.`) : true));
      const orderInList = Math.max(0, ...siblings.map((t) => Number(t.orderInList) || 0)) + 1024;
      const row = api.buildTaskRow({ ownerGUID, projectGUID, parentTreePath: parentPath, rowKind: kind, name: name.trim(), durationDays: kind === 'stage' ? 0 : 1, orderInList });
      if (notes.trim()) row.rowJSON.notes = notes.trim();
      if (intent) row.rowJSON.intent = intentLinkOf(intent);
      const created = await api.createTask(row);
      await queryClient.invalidateQueries({ queryKey: pmKeys.projectData(projectGUID) });
      if (intent) dispatch(setIntentInfo(null));
      // dashboard: this project, the new row selected and scrolled into view
      const store = usePMStore.getState();
      store.selectProject(projectGUID);
      store.requestFocus(created.rowGUID);
      router.replace(PM_ROUTES.dashboard as any);
    } catch (e) {
      dispatch(showSnackbar(`The ${kind} was not added: ${errorMessage(e)}`));
    } finally {
      setSaving(false);
    }
  };

  const field = [styles.field, { borderColor: c.border, backgroundColor: c.surface }];
  const label = (text: string) => <Text style={[styles.label, { color: c.text }]}>{text}</Text>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" testID="pm-new-task-screen">
      {!ownerGUID ? (
        <Text style={{ color: c.text, fontSize: 15 }}>Sign in to add a task to a project.</Text>
      ) : (
        <>
          <RadioSetApp
            testID="pm-new-task-kind"
            title="Add"
            horizontal
            value={kind}
            onChange={setKind}
            options={[
              { id: 'task', label: 'Task', icon: 'task_alt' },
              { id: 'stage', label: 'Stage', icon: 'create_new_folder' },
            ]}
          />

          {label('Name')}
          <TextInput testID="pm-new-task-name" value={name} onChangeText={setName} placeholder={kind === 'stage' ? 'Stage name' : 'Task name'} placeholderTextColor={`${c.text}77`} style={[field, styles.input, { color: c.text }]} />

          {label('Project')}
          <Text testID="pm-new-task-project" accessibilityRole="button" onPress={() => setMenu('project')} style={[field, styles.select, { color: project ? c.text : c.error }]}>
            {project ? project.rowJSON.name : projectsQuery.isLoading ? 'Loading…' : projects.length ? 'Choose the project…' : 'You have no projects yet - create one on the dashboard'}
          </Text>

          {label(kind === 'stage' ? 'Inside the stage (may be empty)' : 'Stage (may be empty)')}
          <Text
            testID="pm-new-task-stage"
            accessibilityRole="button"
            onPress={() => projectGUID && setMenu('stage')}
            style={[field, styles.select, { color: c.text, opacity: projectGUID ? 1 : 0.5 }]}
          >
            {stage ? stage.rowJSON.name : dataQuery.isLoading ? 'Loading…' : 'No stage - directly under the project'}
          </Text>

          {label('Notes')}
          <TextInput testID="pm-new-task-notes" value={notes} onChangeText={setNotes} multiline placeholder="Notes" placeholderTextColor={`${c.text}77`} style={[field, styles.input, { color: c.text, minHeight: 90, textAlignVertical: 'top' }]} />

          {!!intent?.intentURL && (
            <Text numberOfLines={2} style={{ color: c.primary, fontSize: 12.5, marginTop: 8 }}>
              Link kept with the {kind}: {intent.intentURL}
            </Text>
          )}

          <View style={styles.actions}>
            <ButtonTextApp testID="pm-new-task-cancel" title="Cancel" onPress={cancel} />
            <ButtonPrimaryApp testID="pm-new-task-save" title={saving ? 'Adding…' : `Add ${kind} to the project`} onPress={save} disabled={!canSave} loading={saving} />
          </View>
        </>
      )}

      <ModalWindowListToSelect
        testID="pm-new-task-project-list"
        visible={menu === 'project'}
        title="Project"
        searchable
        items={projects.map((p) => ({ id: p.rowGUID, title: p.rowJSON.name || 'Project', icon: 'account_tree' }))}
        selectedId={projectGUID}
        emptyText="No projects"
        onSelect={(id) => {
          setProjectGUID(id);
          setStageGUID(null);
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />
      <ModalWindowListToSelect
        testID="pm-new-task-stage-list"
        visible={menu === 'stage'}
        title="Stage"
        searchable
        items={[{ id: '', title: 'No stage - directly under the project', icon: 'horizontal_rule' }, ...stages]}
        selectedId={stageGUID || ''}
        onSelect={(id) => {
          setStageGUID(id || null);
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontSize: 13, fontWeight: '700', opacity: 0.75, marginTop: 14, marginBottom: 6 },
  field: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  input: { minHeight: 44, fontSize: 15, paddingVertical: 10 },
  select: { minHeight: 44, fontSize: 15, paddingVertical: 12, overflow: 'hidden' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 22 },
});
