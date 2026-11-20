// BIMToProjectImport - imports a BIM model (IFC) into a project as stages + tasks + a 3D model (route /pm/bim/import; documentation/BIM_WBS.html).
//   source     BIM example 1 (Structure Walls, the viktor-platform sample) | BIM example 2 (Duplex Apartment, buildingSMART) | BIM example 3 (Schependomlaan residential building, 49 MB, about 3 500 elements: grouped tasks) | BIM example 4 (Sixty5, 343 MB, about 16 600 elements: the large model) | an IFC file of the device | the address of an IFC (https, a host the converter allows)
//   options    one task per element / per (storey, class, type) group / automatic · skip the storeys without elements · the first working day of the plan
//   target     the project GUID (example 1: aabd1dde-97e6-4359-97e4-0efcb847589b); a project that does not exist is made; a project with tasks that is NOT a BIM project is refused
//   then       progress, the result, and "Open the BIM view" (the project is selected and the BIM button is shown)
// The conversion runs on the converter service (py/bim/server, .env EXPO_PUBLIC_BIM_SERVER_URL); the app writes the rows through the bim_ RPCs. React Native Paper, like the assistants.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, HelperText, ProgressBar, RadioButton, Switch, Text, TextInput, useTheme } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { pmT } from '../../i18n/pmT';
import { usePMStore } from '../../store/store_pm';
import { usePMOwnerGUID } from '../../crud/queries';
import { BIM_EXAMPLE1_NAME, BIM_EXAMPLE1_PROJECT_GUID, BIM_EXAMPLES } from '../model/bimModel';
import { DEFAULT_BIM_IMPORT_OPTIONS, bimProgressFraction, bimProgressLabel, type BimGranularity } from './bimImportModel';
import type { BimConvertSource } from './bimServerClient';
import { bimServerUrl } from './bimServerClient';
import { useBimImport } from './useBimImport';

type SourceKind = keyof typeof BIM_EXAMPLES | 'file' | 'url';
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
  // a Drawer screen stays mounted: when the importer is opened again for ANOTHER project (Project settings -> BIM -> Import ...), the GUID of the route wins over the one of the last visit
  useEffect(() => {
    if (given) setProjectGUID(given);
  }, [given]);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<{ name: string; uri: string; file?: any } | null>(null);
  const [granularity, setGranularity] = useState<BimGranularity>(DEFAULT_BIM_IMPORT_OPTIONS.granularity);
  const [skipEmpty, setSkipEmpty] = useState(DEFAULT_BIM_IMPORT_OPTIONS.skipEmptyStoreys);
  const [openings, setOpenings] = useState(DEFAULT_BIM_IMPORT_OPTIONS.includeOpenings === true);
  const [startDate, setStartDate] = useState('');
  const projectExists = usePMStore((s) => !!s.projectsById[projectGUID]);
  const converterUrl = bimServerUrl();

  const problem = useMemo(() => {
    if (!GUID.test(projectGUID.trim())) return pmT('The project GUID is not valid.');
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return pmT('The start date must be YYYY-MM-DD.');
    if (source === 'file' && !file) return pmT('Choose an IFC file.');
    if (source === 'url' && !/^https:\/\/\S+$/i.test(url.trim())) return pmT('Give the https address of an IFC file.');
    if (!converterUrl) return pmT('The converter is not set up: add EXPO_PUBLIC_BIM_SERVER_URL to .env and restart Expo (see kit8/pm/bim/README.md).');
    if (!ownerGUID) return pmT('There is no valid Supabase session on this device (the sign-in expired, or Supabase could not be reached to renew it). Sign in again.');
    return null;
  }, [projectGUID, startDate, source, file, url, converterUrl, ownerGUID]);

  // an example brings its own project GUID and name; only a project of the route that EXISTS keeps its GUID (it is the target of the import)
  const chooseSource = (v: SourceKind) => {
    setSource(v);
    const ex = BIM_EXAMPLES[v as keyof typeof BIM_EXAMPLES];
    if (!ex) return;
    const keepGuid = !!given && !!usePMStore.getState().projectsById[given];
    if (!keepGuid) setProjectGUID(ex.projectGUID);
    setProjectName(ex.name);
  };

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['*/*'], copyToCacheDirectory: false, multiple: false });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    setFile({ name: a.name, uri: a.uri, file: (a as any).file });
  };

  const start = async () => {
    if (problem) return;
    let src: BimConvertSource;
    if (source in BIM_EXAMPLES) src = { kind: 'url', url: BIM_EXAMPLES[source as keyof typeof BIM_EXAMPLES].url };
    else if (source === 'url') src = { kind: 'url', url: url.trim() };
    else {
      const blob: Blob = file!.file ?? (await (await fetch(file!.uri)).blob());
      src = { kind: 'bytes', bytes: blob, name: file!.name };
    }
    const out = await run({
      projectGUID: projectGUID.trim().toLowerCase(),
      projectName: projectName.trim() || BIM_EXAMPLE1_NAME,
      source: src,
      options: { granularity, skipEmptyStoreys: skipEmpty, startDate: startDate || undefined, includeOpenings: openings },
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
    <View testID="bim-import" style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* the action bar stays at the top of the screen while the options below scroll: Import, the progress, the result */}
      <View testID="bim-import-bar" style={[styles.bar, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={styles.barInner}>
          {problem ? <HelperText testID="bim-import-problem" type="error" visible>{problem}</HelperText> : null}
          {!ownerGUID ? (
            <Button testID="bim-import-signin" mode="contained-tonal" onPress={() => router.push({ pathname: '/user/signin', params: { returnTo: '/pm/bim/import' } } as any)}>{pmT('Sign in')}</Button>
          ) : null}
          <Button testID="bim-import-start-button" mode="contained" disabled={busy || !!problem} onPress={start}>{pmT('Import')}</Button>

          {status.kind === 'busy' ? (
            <View testID="bim-import-progress" style={styles.progress}>
              <View style={styles.progressTrack}><ProgressBar progress={bimProgressFraction(status.percent)} /></View>
              <Text testID="bim-import-progress-text" style={styles.progressText}>{bimProgressLabel(status.percent, status.text)}</Text>
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
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.page} style={styles.scroll}>
      <Card style={styles.card}>
        <Card.Title title={pmT('Import a BIM model (IFC)')} subtitle={pmT('Stages and tasks only - no costs, no lines. The 3D model is kept next to them.')} />
        <Card.Content style={{ gap: 12 }}>
          <Text variant="titleSmall">{pmT('Source')}</Text>
          <RadioButton.Group value={source} onValueChange={(v) => chooseSource(v as SourceKind)}>
            <RadioButton.Item testID="bim-import-source-example1" label={pmT('BIM example 1 - Structure Walls (58 walls, 4 storeys)')} value="example1" />
            <RadioButton.Item testID="bim-import-source-example2" label={pmT('BIM example 2 - Duplex Apartment (215 elements, 4 storeys)')} value="example2" />
            <RadioButton.Item testID="bim-import-source-example3" label={pmT('BIM example 3 - Schependomlaan, residential building (49 MB, about 3 500 elements: grouped tasks; takes about a minute)')} value="example3" />
            <RadioButton.Item testID="bim-import-source-example4" label={pmT('BIM example 4 - Sixty5, a large ArchiCAD model (343 MB, about 16 600 elements, 19 storeys: grouped tasks; takes about 3 minutes)')} value="example4" />
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
            <Switch testID="bim-import-openings" value={openings} onValueChange={setOpenings} />
            <Text>{pmT('Openings of windows and doors as elements and tasks (translucent blue in the 3D view)')}</Text>
          </View>
          <View style={styles.row}>
            <Switch testID="bim-import-skip-empty" value={skipEmpty} onValueChange={setSkipEmpty} />
            <Text>{pmT('Skip storeys that hold no element')}</Text>
          </View>
          <TextInput testID="bim-import-start" label={pmT('First working day of the plan (YYYY-MM-DD, empty = today)')} value={startDate} onChangeText={setStartDate} autoCapitalize="none" />

        </Card.Content>
      </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { flexShrink: 0, alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  barInner: { width: '100%', maxWidth: 720, gap: 8 },
  progress: { flexShrink: 0, paddingBottom: 4 },
  // the bar has a box of its own with a fixed height; the text follows it with a margin (a gap + a shrinking bar put the text OVER the divider line)
  progressTrack: { height: 6, flexShrink: 0, overflow: 'hidden', justifyContent: 'center' },
  progressText: { flexShrink: 0, marginTop: 8 },
  scroll: { flex: 1 },
  page: { padding: 16, alignItems: 'center' },
  card: { width: '100%', maxWidth: 720 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
