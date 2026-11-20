// ImportNewProjectAssistant - "Import Project" of the Create New Project Assistant (route /pm/project/assistant/import). React Native Paper.
//   1. File    choose / drop a project file (project_data_….json); the assistant reads it and says what it holds
//   2. Name    the name of the NEW project (default: the name in the file)
//   3. Import  the project is created with the default settings of the organization, then the file is loaded into it (tasks + dependencies + planning settings)
// Same top (back arrow, navigation line, progress) as the Create New Project Assistant. A project made and not filled because the import failed is deleted again.
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Button, Card, HelperText, List, Text, TextInput, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { pmT } from '../../../../pm/i18n/pmT';
import { usePMStore } from '../../../../pm/store/store_pm';
import { usePMOwnerGUID } from '../../../../pm/crud/queries';
import { useBuildProjectRow, useCreateProjectMutation, useDeleteProjectMutation, useReadProjectsQuery } from '../../../../pm/crud/project/projectQueries';
import { useProjectExchange } from '../../../../pm/crud/exchange/project/useProjectExchange';
import { pickProjectDataFile } from '../../../../pm/crud/exchange/project/import/importProjectFromFile';
import { readDroppedFileText } from '../../../../pm/crud/exchange/project/import/readDroppedFileText';
import { readDroppedFileBytes } from '../../../../pm/crud/exchange/project/package/binaryFiles';
import { useMyOrganization } from '../../../../catalog/organization/useMyOrganization';
import { newProjectPatchFrom } from '../../../../catalog/organization/defaultProjectSettings';
import { useBusinessUnitData } from '../../../../catalog/business_unit/useBusinessUnitData';
import { defaultProjectCenters } from '../../../../catalog/business_unit/businessUnitModel';
import { projectsOfOrganization } from '../../../../catalog/organization/switch/organizationSwitchModel';
import { useActiveOrganizationGUID } from '../../../../catalog/organization/switch/useActiveOrganizationGUID';
import { ReceiveDraggableFilesComponent } from '../../../components/common/ReceiveDraggableFilesComponent';
import type { DroppedFileItem } from '../../../components/common/ReceiveDraggableFilesComponent.types';
import AssistantNavigationBar, { type AssistantNavStep } from '../components/AssistantNavigationBar';
import ExpertTipCard from '../components/ExpertTipCard';
import { IMPORT_STEPS, importHasError, importStepNotes, summarizeProjectFile, summarizeProjectPackage, type ImportFileSummary, type ImportStepId } from './importAssistantModel';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function ImportNewProjectAssistant() {
  const router = useRouter();
  const theme = useTheme();
  const win = useWindowDimensions();
  const ownerGUID = usePMOwnerGUID();
  const organizationGUID = useActiveOrganizationGUID();
  const projectsQuery = useReadProjectsQuery(ownerGUID); // also puts the projects into the store: the import reads the new project from there
  const existingNames = useMemo(() => projectsOfOrganization(projectsQuery.data || [], organizationGUID).map((p) => String(p.rowJSON?.name || '')).filter(Boolean), [projectsQuery.data, organizationGUID]);
  const organization = useMyOrganization();
  const units = useBusinessUnitData(true);
  const buildRow = useBuildProjectRow(ownerGUID);
  const createProject = useCreateProjectMutation(ownerGUID);
  const deleteProject = useDeleteProjectMutation(ownerGUID);
  const { importProject } = useProjectExchange(ownerGUID);

  const [step, setStep] = useState<ImportStepId>('file');
  const [reached, setReached] = useState<ImportStepId[]>(['file']);
  const [files, setFiles] = useState<DroppedFileItem[]>([]);
  const [summary, setSummary] = useState<ImportFileSummary | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFiles = useCallback(async (dropped: DroppedFileItem[]) => {
    setFileError(null);
    setSummary(null);
    const picked = pickProjectDataFile(dropped);
    if (!picked) return setFileError(pmT('No file.'));
    try {
      const isZip = /\.zip$/i.test(picked.name) || /zip/i.test(picked.mimeType || '');
      const r = isZip ? summarizeProjectPackage(await readDroppedFileBytes(picked), picked.name) : summarizeProjectFile(await readDroppedFileText(picked), picked.name);
      if (!r.ok) return setFileError(r.error);
      setFiles([picked]);
      setSummary(r.summary);
      setName((n) => n || r.summary.sourceProjectName);
    } catch (e: any) {
      setFileError(e?.message || String(e));
    }
  }, []);

  const notes = importStepNotes(step, summary, name, existingNames);
  const canNext = step !== 'import' && !importHasError(notes);
  const index = IMPORT_STEPS.findIndex((s) => s.id === step);

  const go = (id: ImportStepId) => setStep(id);
  const next = () => {
    const to = IMPORT_STEPS[index + 1]?.id;
    if (!to || !canNext) return;
    setReached((r) => (r.includes(to) ? r : [...r, to]));
    setStep(to);
  };
  const back = () => {
    if (index > 0) setStep(IMPORT_STEPS[index - 1].id);
    else router.canGoBack?.() ? router.back() : router.replace('/pm/project/assistant' as any);
  };

  const run = async () => {
    if (!summary || files.length === 0) return;
    setError(null);
    setBusy(pmT('Creating the project ...'));
    let created: string | null = null;
    try {
      const row = buildRow(name.trim(), summary.startMs || undefined);
      // the settings of every new project: the organization's defaults and its four business units (as the New project window does)
      Object.assign(row.rowJSON, newProjectPatchFrom(organization.defaults), defaultProjectCenters(units.rows, units.cfrRows), { projectBusinessUnitsRequired: true });
      await createProject.mutateAsync(row);
      created = row.rowGUID;
      // the import reads the project from the store: wait until the projects query has put it there
      for (let i = 0; i < 40 && !usePMStore.getState().projectsById[row.rowGUID]; i += 1) await sleep(150);
      if (!usePMStore.getState().projectsById[row.rowGUID]) throw new Error(pmT('The new project did not appear in the list. Open the dashboard and try again.'));
      setBusy(pmT('Importing the tasks ...'));
      const plan = await importProject(row.rowGUID, files, async () => true);
      if (!plan) throw new Error(pmT('The file could not be imported.'));
      usePMStore.getState().selectProject(row.rowGUID);
      router.replace('/pm/project/dashboard' as any);
    } catch (e: any) {
      if (created) deleteProject.mutate(created); // an empty project left by a failed import is not wanted
      setError(e?.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const navSteps: AssistantNavStep[] = IMPORT_STEPS.map((s, i) => ({
    id: s.id,
    label: s.title,
    state: s.id === step ? 'current' : reached.includes(s.id) && i < index ? 'done' : 'todo',
    enabled: reached.includes(s.id) || s.id === step,
  }));
  const def = IMPORT_STEPS[index];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]} testID="import-new-project-assistant">
      <AssistantNavigationBar title="Import project" subtitle={summary?.fileName} steps={navSteps} onBack={back} onJump={(id) => go(id as ImportStepId)} />
      <ScrollView contentContainerStyle={[styles.content, win.width > 760 && styles.wide]} keyboardShouldPersistTaps="handled">
        <Text variant="headlineSmall" style={styles.stepTitle}>{`${index + 1}. ${pmT(def.title)}`}</Text>
        <ExpertTipCard tip={def.tip} notes={notes} />

        {step === 'file' && (
          <View>
            <ReceiveDraggableFilesComponent folderName={pmT('the new project')} onFilesDropped={onFiles} compact pickable accept=".json,.zip,application/json,application/zip" pickMimeTypes={['application/json', 'application/zip', 'application/x-zip-compressed']} title={pmT('Drop the project file here')} testID="import-assistant-drop" />
            {!!fileError && <HelperText type="error" visible testID="import-assistant-file-error">{fileError}</HelperText>}
            {summary && (
              <Card mode="outlined" style={{ marginTop: 12 }} testID="import-assistant-summary">
                <Card.Title title={summary.sourceProjectName || pmT('Unnamed project')} subtitle={summary.fileName} />
                <Card.Content>
                  <List.Item title={pmT('Tasks')} description={String(summary.tasks)} />
                  <List.Item title={pmT('Dependencies')} description={String(summary.dependencies)} />
                  {!!summary.taskLines && <List.Item title={pmT('Task lines')} description={String(summary.taskLines)} testID="import-assistant-summary-lines" />}
                  {!!summary.bimElements && <List.Item title={pmT('BIM model')} description={pmT('{{n}} elements', { n: summary.bimElements })} testID="import-assistant-summary-bim" />}
                  {!!summary.startDate && <List.Item title={pmT('Start')} description={summary.startDate} />}
                </Card.Content>
              </Card>
            )}
          </View>
        )}

        {step === 'name' && <TextInput mode="outlined" label={pmT('Project name')} value={name} onChangeText={setName} maxLength={140} testID="import-assistant-name" />}

        {step === 'import' && summary && (
          <Card mode="outlined" testID="import-assistant-review">
            <Card.Title title={name.trim()} subtitle={pmT('{{tasks}} tasks, {{deps}} dependencies from {{file}}', { tasks: summary.tasks, deps: summary.dependencies, file: summary.fileName })} />
            <Card.Content>
              {!!busy && (
                <View style={styles.busy}>
                  <ActivityIndicator />
                  <Text style={{ marginLeft: 12 }}>{busy}</Text>
                </View>
              )}
              {!!error && <HelperText type="error" visible testID="import-assistant-error">{error}</HelperText>}
            </Card.Content>
          </Card>
        )}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
        <Button mode="outlined" onPress={back} disabled={!!busy} testID="import-assistant-back">{pmT('Back')}</Button>
        <View style={{ flex: 1 }} />
        {step === 'import' ? (
          <Button mode="contained" onPress={run} disabled={!!busy || !summary || !ownerGUID} loading={!!busy} testID="import-assistant-run">{pmT('Import project')}</Button>
        ) : (
          <Button mode="contained" onPress={next} disabled={!canNext} testID="import-assistant-next">{pmT('Next')}</Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  wide: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  stepTitle: { marginBottom: 12 },
  busy: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
});
