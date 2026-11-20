// BIMToProjectImport - imports a BIM model (IFC) into a project as stages + tasks + a 3D model (route /pm/bim/import; documentation/BIM_WBS.html).
//   source     BIM example 1 (Structure Walls, the viktor-platform sample) | an IFC file of the device | the address of an IFC (https, a host the converter allows)
//   options    one task per element / per (storey, class, type) group / automatic · skip the storeys without elements · the first working day of the plan
//   target     the project GUID (example 1: aabd1dde-97e6-4359-97e4-0efcb847589b); a project that does not exist is made; a project with tasks that is NOT a BIM project is refused
//   then       progress, the result, and "Open the BIM view" (the project is selected and the BIM button is shown)
// The conversion runs on the converter service (py/bim/server, .env EXPO_PUBLIC_BIM_SERVER_URL); the app writes the rows through the bim_ RPCs. React Native Paper, like the assistants.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, ProgressBar, RadioButton, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pmT } from '../../i18n/pmT';
import { usePMStore } from '../../store/store_pm';
import { usePMOwnerGUID } from '../../crud/queries';
import { BIM_EXAMPLE1_NAME, BIM_EXAMPLE1_PROJECT_GUID, BIM_EXAMPLE1_URL } from '../model/bimModel';
import { DEFAULT_BIM_IMPORT_OPTIONS, type BimGranularity } from './bimImportModel';
import type { BimConvertSource } from './bimServerClient';
import { bimServerUrl } from './bimServerClient';
import { useBimImport } from './useBimImport';

type SourceKind = 'example1' | 'file' | 'url';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BIMToProjectImportProps {
  /** tests: the project to import into instead of the route parameter */
  projectGUID?: string;
}

export default function BIMToProjectImport(props: BIMToProjectImportProps) {
  const params = useLocalSearchParams<{ projectGUID?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const ownerGUID = usePMOwnerGUID();
  const { run, status, busy } = useBimImport(ownerGUID ?? '');
  const given = props.projectGUID ?? (typeof params?.projectGUID === 'string' ? params.projectGUID : '');
  const [source, setSource] = useState<SourceKind>('example1');
  const [projectGUID, setProjectGUID] = useState(given || BIM_EXAMPLE1_PROJECT_GUID);
  const [projectName, setProjectName] = useState(BIM_EXAMPLE1_NAME);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<{ name: string; uri: string; file?: any } | null>(null);
  const [granularity, setGranularity] = useState<BimGranularity>(DEFAULT_BIM_IMPORT_OPTIONS.granularity);
  const [skipEmpty, setSkipEmpty] = useState(DEFAULT_BIM_IMPORT_OPTIONS.skipEmptyStoreys);
  const [startDate, setStartDate] = useState('');
  const projectExists = usePMStore((s) => !!s.projectsById[projectGUID]);
  const converterUrl = bimServerUrl();

  const problem = useMemo(() => {
    if (!GUID.test(projectGUID.trim())) return pmT('The project GUID is not valid.');
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return pmT('The start date must be YYYY-MM-DD.');
    if (source === 'file' && !file) return pmT('Choose an IFC file.');
    if (source === 'url' && !/^https:\/\/\S+$/i.test(url.trim())) return pmT('Give the https address of an IFC file.');
    if (!converterUrl) return pmT('The converter is not set up: add EXPO_PUBLIC_BIM_SERVER_URL to .env and restart Expo (see kit8/pm/bim/README.md).');
    if (!ownerGUID) return pmT('Sign in first.');
    return null;
  }, [projectGUID, startDate, source, file, url, converterUrl, ownerGUID]);

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: false, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setFile({ name: a.name, uri: a.uri, file: (a as any).file });
  };

  const start = async () => {
    if (problem) return;
    let src: BimConvertSource;
    if (source === 'example1') src = { kind: 'url', url: BIM_EXAMPLE1_URL };
    else if (source === 'url') src = { kind: 'url', url: url.trim() };
    else {
      const blob: Blob = file!.file ?? (await (await fetch(file!.uri)).blob());
      src = { kind: 'bytes', bytes: blob, name: file!.name };
    }
    const out = await run({
      projectGUID: projectGUID.trim().toLowerCase(),
      projectName: projectName.trim() || BIM_EXAMPLE1_NAME,
      source: src,
      options: { granularity, skipEmptyStoreys: skipEmpty, startDate: startDate || undefined },
    });
    if (out && out.status === 'imported') usePMStore.getState().selectProject(out.projectGUID);
  };

  const openView = () => {
    const s = usePMStore.getState();
    if (status.kind === 'done') {
      s.setNetworkViewSettings({ ganttVsNetworkView: 'showBimView' });
      router.replace(`/pm/project/dashboard?projectGUID=${status.outcome.projectGUID}` as any);
    }
  };

  return (
    <ScrollView testID="bim-import" contentContainerStyle={styles.page} style={{ backgroundColor: theme.colors.background }}>
      <Card style={styles.card}>
        <Card.Title title={pmT('Import a BIM model (IFC)')} subtitle={pmT('Stages and tasks only - no costs, no lines. The 3D model is kept next to them.')} />
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleSmall">{pmT('Source')}</Text>
          <RadioButton.Group value={source} onValueChange={(v) => setSource(v as SourceKind)}>
            <RadioButton.Item testID="bim-import-source-example1" label={pmT('BIM example 1 - Structure Walls (58 walls, 4 storeys)')} value="example1" />
            <RadioButton.Item testID="bim-import-source-file" label={pmT('An IFC file of this device')} value="file" />
            <RadioButton.Item testID="bim-import-source-url" label={pmT('The address (https) of an IFC file')} value="url" />
          </RadioButton.Group>
          {source === 'file' ? (
            <View style={styles.row}>
              <Button testID="bim-import-pick" mode="outlined" onPress={pick}>{pmT('Choose file…')}</Button>
              <Text testID="bim-import-file">{file?.name ?? ''}</Text>
            </View>
          ) : null}
          {source === 'url' ? <TextInput testID="bim-import-url" label={pmT('Address of the IFC')} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} /> : null}

          <Text variant="titleSmall">{pmT('Project')}</Text>
          <TextInput testID="bim-import-guid" label={pmT('Project GUID')} value={projectGUID} onChangeText={setProjectGUID} autoCapitalize="none" autoCorrect={false} />
          <HelperText type="info" visible>
            {projectExists ? pmT('The project exists: a BIM project asks before its tasks are replaced; a project with tasks that is not a BIM project is refused.') : pmT('The project does not exist yet: it is made.')}
          </HelperText>
          {!projectExists ? <TextInput testID="bim-import-name" label={pmT('Name of the new project')} value={projectName} onChangeText={setProjectName} /> : null}

          <Text variant="titleSmall">{pmT('Tasks')}</Text>
          <RadioButton.Group value={granularity} onValueChange={(v) => setGranularity(v as BimGranularity)}>
            <RadioButton.Item testID="bim-import-gran-auto" label={pmT('Automatic: one task per element up to 1 500 elements, else per group')} value="auto" />
            <RadioButton.Item testID="bim-import-gran-element" label={pmT('One task per element')} value="element" />
            <RadioButton.Item testID="bim-import-gran-group" label={pmT('One task per group (storey, class, type)')} value="group" />
          </RadioButton.Group>
          <View style={styles.row}>
            <Switch testID="bim-import-skip-empty" value={skipEmpty} onValueChange={setSkipEmpty} />
            <Text>{pmT('Skip storeys that hold no element')}</Text>
          </View>
          <TextInput testID="bim-import-start" label={pmT('First working day of the plan (YYYY-MM-DD, empty = today)')} value={startDate} onChangeText={setStartDate} autoCapitalize="none" />

          {problem ? <HelperText testID="bim-import-problem" type="error" visible>{problem}</HelperText> : null}
          <Button testID="bim-import-start-button" mode="contained" disabled={busy || !!problem} onPress={start}>{pmT('Import')}</Button>

          {status.kind === 'busy' ? (
            <View testID="bim-import-progress" style={{ gap: 6 }}>
              <ProgressBar progress={Math.max(0.02, status.percent / 100)} />
              <Text>{status.text} ({status.percent}%)</Text>
            </View>
          ) : null}
          {status.kind === 'error' ? <HelperText testID="bim-import-error" type="error" visible>{status.text}</HelperText> : null}
          {status.kind === 'cancelled' ? <Text testID="bim-import-cancelled">{pmT('Cancelled - nothing was changed.')}</Text> : null}
          {status.kind === 'done' ? (
            <View style={{ gap: 8 }}>
              <Text testID="bim-import-done">{status.text}</Text>
              <Button testID="bim-import-open" mode="contained-tonal" onPress={openView}>{pmT('Open the BIM view')}</Button>
            </View>
          ) : null}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 720 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
