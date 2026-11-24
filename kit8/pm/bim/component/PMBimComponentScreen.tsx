// PMBimComponentScreen - ONE component of a BIM model: /pm/bim/component?projectGUID=…&elementGUID=<IFC GlobalId>&taskGUID=…&returnTo=…
//   header   ← Back · the name + class / type · Share (image + details) · Full screen
//   image    the 3D view with ONLY this element drawn (only the chunk file that holds it is fetched); orbit / pan / zoom like the project view
//   under it the IFC properties of the component, then the EDIT TABLES of its task (PMTaskEditView: the Time / Material / Expense / Revenue lines) - the same tables as the Plan tab of the task window
//   Full screen  the image takes the whole window (on the web the browser's full screen too); the button (or Escape) brings the rest back
//   Back         `returnTo` (the place "Go to component" came from), else the previous screen; a link opened in a fresh browser tab has no history: the dashboard at the task
// It loads the project like the task window does (a deep link works after a reload).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSystem } from '../../../providers/WithDesignSystem';
import { useSupabase } from '../../../providers/WithSupabase';
import IconApp from '../../../ui/components/common/IconApp';
import ActivityIndicatorCircleApp from '../../../ui/components/activityindicator/ActivityIndicatorCircleApp';
import { shareScreenshotResultText } from '../../../lib/shareScreenshot';
import { usePMStore } from '../../store/store_pm';
import { usePMOwnerGUID, useProjectRealtime, useReadProjectDataQuery, useReadProjectsQuery, useReadProjectUserSettingsQuery } from '../../crud/queries';
import { usePMCrud } from '../../crud/usePMCrud';
import { makePMPalette } from '../../view/theme';
import PMUndoProvider from '../../view/undo/PMUndoProvider';
import PMApproveYesNoCancelModalWindow from '../../inner/PMApproveYesNoCancelModalWindow';
import { PMDialogButton } from '../../inner/buttons';
import { PMTooltipLayer } from '../../inner/tooltip/PMTooltip';
import { PMTaskTemplateWindows } from '../../tasktemplate';
import { pmT, usePMLanguage } from '../../i18n/pmT';
import PMTaskEditView from '../../view/task/finances/PMTaskEditView';
import { createBimCloud } from '../cloud/bimCloud';
import BimViewer from '../view/BimViewer';
import { useBimModel } from '../view/useBimModel';
import { DEFAULT_STATE_COLORS } from '../view/bimSceneBuilder';
import { hexToRgb } from '../view/PMProjectBimView';
import { bimComponentBackTarget, bimComponentLayout, propertyLines, type BimComponentLink } from './bimComponentModel';
import { makeBimViewRegistration } from './bimComponentRegistry';
import { shareBimComponent } from './shareBimComponent';

const HEADER_H = 52;
const NONE = new Set<string>();

export default function PMBimComponentScreen(props: { link: BimComponentLink | null }) {
  const language = usePMLanguage();
  return (
    <PMUndoProvider>
      <PMBimComponentScreenInner key={language} {...props} />
    </PMUndoProvider>
  );
}

function PMBimComponentScreenInner({ link }: { link: BimComponentLink | null }) {
  const { themeColors, isDark } = useDesignSystem();
  const router = useRouter();
  const { supabase } = useSupabase();
  const cloud = useMemo(() => createBimCloud(supabase), [supabase]);
  const ownerGUID = usePMOwnerGUID();
  const projectGUID = link?.projectGUID ?? null;
  const elementGUID = link?.elementGUID ?? null;
  // the size of the screen: the window until the layout of the screen itself has been measured (no empty first frame)
  const win = useWindowDimensions();
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  const size = measured ?? { w: win.width || 360, h: win.height || 640 }; // (0 = not known yet)
  const [full, setFull] = useState(false);
  const [note, setNote] = useState('');
  const [props, setProps] = useState<Record<string, any> | null>(null);
  const captureRef = useRef<((box: number[] | null) => string | null) | null>(null);

  const criticalColor = usePMStore((s) => s.criticalPathTaskColor);
  const selectedProjectGUID = usePMStore((s) => s.selectedProjectGUID);
  const palette = useMemo(() => makePMPalette(themeColors, isDark, criticalColor), [themeColors, isDark, criticalColor]);

  // the project of the link: select it and load its data (like the task window); the component is read from the model
  useReadProjectsQuery(ownerGUID);
  useReadProjectUserSettingsQuery(ownerGUID);
  useEffect(() => {
    if (projectGUID && projectGUID !== selectedProjectGUID) usePMStore.getState().selectProject(projectGUID);
  }, [projectGUID, selectedProjectGUID]);
  const dataQuery = useReadProjectDataQuery(projectGUID);
  useProjectRealtime(ownerGUID, projectGUID);
  const crud = usePMCrud(ownerGUID, projectGUID);

  const { model, reload } = useBimModel(projectGUID, null, elementGUID);
  const manifest = model.state === 'ready' ? model.manifest : null;
  const element = useMemo(() => (model.state === 'ready' ? model.elements.find((e) => e.ifcGuid === elementGUID) : undefined), [model, elementGUID]);
  const taskGUID = link?.taskGUID || element?.taskGUID || null;
  const task = usePMStore((s) => (taskGUID ? s.tasksById[taskGUID] : undefined));
  const taskReady = usePMStore((s) => !!taskGUID && !!s.tasksById[taskGUID] && !!s.schedule[taskGUID]);

  // the edit tables show the SELECTED task: it is the task of this component
  useEffect(() => {
    if (task && taskGUID && usePMStore.getState().selectedGUID !== taskGUID) usePMStore.getState().setSelected(taskGUID);
  }, [task, taskGUID]);

  // the IFC properties (read once per component; the client is read through a ref, so a new client object never starts a new read)
  const cloudRef = useRef(cloud);
  cloudRef.current = cloud;
  const modelGUID = manifest?.model.modelGUID ?? null;
  useEffect(() => {
    if (!modelGUID || !elementGUID) return;
    let off = false;
    cloudRef.current.property(modelGUID, elementGUID).then((j) => !off && setProps(j)).catch(() => !off && setProps(null));
    return () => {
      off = true;
    };
  }, [modelGUID, elementGUID]);

  // full screen: the image alone; on the web the browser's full screen too (Escape leaves it: the event brings the state back)
  const setFullScreen = useCallback((on: boolean) => {
    setFull(on);
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    try {
      if (on) void (document.documentElement as any).requestFullscreen?.();
      else if ((document as any).fullscreenElement) void (document as any).exitFullscreen?.();
    } catch {
      // the browser refused: the image still fills the window
    }
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onChange = () => {
      if (!(document as any).fullscreenElement) setFull(false);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if ((document as any).fullscreenElement) void (document as any).exitFullscreen?.();
    };
  }, []);

  const goBack = useCallback(() => {
    // like the app bar: `returnTo` = exactly the place the user came from; else the previous screen; else (a fresh browser tab) the dashboard
    if (link?.returnTo) router.navigate(link.returnTo as any);
    else if (router.canGoBack?.()) router.back();
    else if (link) router.replace(bimComponentBackTarget(link, taskGUID) as any);
  }, [router, link, taskGUID]);

  const colors = useMemo(() => ({ ...DEFAULT_STATE_COLORS, highlight: hexToRgb(palette.primary) }), [palette.primary]);
  const box = element?.bbox ?? [0, 0, 0, 1, 1, 1];
  const boxKey = box.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modelBox = useMemo(() => box, [boxKey]);

  const onShare = useCallback(async () => {
    if (!element || !manifest || !projectGUID) return;
    const view = makeBimViewRegistration({
      projectGUID,
      modelGUID: manifest.model.modelGUID,
      elements: [element],
      storeys: manifest.storeys,
      properties: async () => props,
      capture: async () => (captureRef.current ? captureRef.current(element.bbox) : null),
    });
    setNote(pmT(shareScreenshotResultText(await shareBimComponent(view, element), false)));
  }, [element, manifest, projectGUID, props]);

  const layout = bimComponentLayout(size.h - (full ? 0 : HEADER_H), full);
  const loading = model.state === 'loading' || (model.state === 'ready' && model.chunks.length < model.chunksTotal);

  const missing = !link
    ? pmT('No component in the link.')
    : model.state === 'none'
      ? pmT('This project has no BIM model. Import one: Project settings -> BIM, or Import / Export -> Import BIM (IFC).')
      : model.state === 'error'
        ? model.text
        : model.state === 'ready' && !element
          ? pmT('This component is not in the model (a new import?).')
          : '';

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }} testID="pm-bim-component" onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width > 0 && height > 0) setMeasured({ w: width, h: height }); // a screen that is not shown (Drawer) reports 0 x 0: keep the window size
      }}>
      {!full ? (
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <IconButton testID="pm-bim-component-back" icon="arrow_back" label={pmT('Back')} onPress={goBack} color={themeColors.text} />
          <View style={{ flex: 1 }}>
            <Text testID="pm-bim-component-title" numberOfLines={1} style={{ color: themeColors.text, fontWeight: '700', fontSize: 16 }}>{element?.name || elementGUID || ''}</Text>
            <Text numberOfLines={1} style={{ color: palette.textMuted, fontSize: 12 }}>{[element?.ifcClass, element?.typeName, task?.rowJSON.taskDescription].filter(Boolean).join(' · ')}</Text>
          </View>
          <IconButton testID="pm-bim-component-share" icon="share" label={pmT('Share (image + details)')} onPress={onShare} color={themeColors.text} disabled={!element || loading} />
          <IconButton testID="pm-bim-component-fullscreen" icon="fullscreen" label={pmT('Full screen')} onPress={() => setFullScreen(true)} color={themeColors.text} disabled={!element} />
        </View>
      ) : null}

      {missing ? (
        <View style={styles.center} testID="pm-bim-component-missing">
          <Text style={{ color: themeColors.text, textAlign: 'center', maxWidth: 420, marginBottom: 12 }}>{missing}</Text>
          {model.state === 'error' ? <PMDialogButton testID="pm-bim-component-retry" kind="primary" title={pmT('Try again')} onPress={reload} /> : null}
        </View>
      ) : !element || size.w <= 0 ? (
        <View style={styles.center} testID="pm-bim-component-loading"><ActivityIndicatorCircleApp size="large" color={themeColors.primary} /></View>
      ) : (
        <>
          <View style={{ width: size.w, height: layout.viewerH }}>
            <BimViewer
              testID="pm-bim-component-viewer"
              width={size.w}
              height={layout.viewerH}
              chunks={model.state === 'ready' ? model.chunks : []}
              modelBox={modelBox}
              highlighted={NONE}
              dimRest={false}
              colors={colors}
              background={palette.background}
              isolateGuid={element.ifcGuid}
              captureRef={captureRef}
              onElementPress={() => undefined}
            />
            {loading ? <View style={styles.loadingOverlay} pointerEvents="none"><ActivityIndicatorCircleApp size="small" color={themeColors.primary} /></View> : null}
            {full ? (
              <View style={styles.fullBar}>
                <IconButton testID="pm-bim-component-exit-fullscreen" icon="fullscreen_exit" label={pmT('Exit full screen')} onPress={() => setFullScreen(false)} color={themeColors.text} background={themeColors.surface} />
              </View>
            ) : null}
          </View>

          {!full ? (
            <ScrollView testID="pm-bim-component-lower" style={{ flex: 1 }} nestedScrollEnabled contentContainerStyle={{ paddingBottom: 16 }}>
              <View testID="pm-bim-component-props" style={[styles.props, { height: layout.propsH, borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <Text style={{ color: themeColors.text, fontWeight: '700', marginBottom: 2 }}>{pmT('Properties')}</Text>
                <ScrollView nestedScrollEnabled>
                  {propertyLines(props).length === 0 ? <Text style={{ color: palette.textMuted, fontSize: 12 }}>{pmT('No IFC properties.')}</Text> : null}
                  {propertyLines(props).map((l, i) => (
                    <Text key={i} style={{ color: l.head ? themeColors.text : palette.textMuted, fontSize: 12, fontWeight: l.head ? '700' : '400' }}>{l.text}</Text>
                  ))}
                </ScrollView>
              </View>
              <View testID="pm-bim-component-edit" style={{ height: layout.editH }}>
                {taskGUID && taskReady && projectGUID ? (
                  <PMTaskEditView projectGUID={projectGUID} width={size.w} height={layout.editH} palette={palette} crud={crud} />
                ) : !taskGUID ? (
                  <View style={styles.center}><Text testID="pm-bim-component-notask" style={{ color: themeColors.text }}>{pmT('This component has no task.')}</Text></View>
                ) : (
                  <View style={styles.center}>{dataQuery.isLoading || !dataQuery.isFetched ? <ActivityIndicatorCircleApp size="small" color={themeColors.primary} /> : <Text style={{ color: themeColors.text }}>{pmT('This task does not exist (deleted?).')}</Text>}</View>
                )}
              </View>
            </ScrollView>
          ) : null}
        </>
      )}
      {note ? <Text testID="pm-bim-component-note" onPress={() => setNote('')} style={[styles.note, { color: themeColors.text, backgroundColor: themeColors.surface }]}>{note}</Text> : null}
      <PMApproveYesNoCancelModalWindow />
      <PMTaskTemplateWindows ownerGUID={ownerGUID} projectGUID={projectGUID} />
      <PMTooltipLayer />
    </View>
  );
}

function IconButton({ testID, icon, label, onPress, color, disabled, background }: { testID: string; icon: string; label: string; onPress: () => void; color: string; disabled?: boolean; background?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} aria-label={label} {...(Platform.OS === 'web' ? ({ title: label } as any) : null)} disabled={disabled} onPress={onPress} style={[styles.iconButton, background ? { backgroundColor: background } : null, disabled ? { opacity: 0.4 } : null]}>
      <IconApp name={icon} size={22} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, height: HEADER_H, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  props: { margin: 8, padding: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  loadingOverlay: { position: 'absolute', right: 12, top: 12 },
  fullBar: { position: 'absolute', right: 12, top: 12 },
  note: { position: 'absolute', left: 12, bottom: 12, padding: 6, borderRadius: 6, fontSize: 12, overflow: 'hidden' },
});
